package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/markbates/goth/gothic"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	appconnect "git.izbori.xyz/trsr/mreza-anketa/cmd/rpcapi/connect"
	"git.izbori.xyz/trsr/mreza-anketa/internal/config"
	"git.izbori.xyz/trsr/mreza-anketa/internal/db"
	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	mrezav1connect "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1/mrezav1connect"
	"git.izbori.xyz/trsr/mreza-anketa/internal/middleware"
	"git.izbori.xyz/trsr/mreza-anketa/internal/ratelimit"
	"git.izbori.xyz/trsr/mreza-anketa/internal/session"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.RunMigrations(cfg.DatabaseURL, "internal/db/migrations"); err != nil {
		return err
	}

	q := dbgen.New(pool)

	sessionStore := session.NewStore(cfg.SessionSecret, cfg.Env == "prod")
	if cfg.GoogleEnabled {
		initGoth(cfg)
		gothic.Store = sessionStore
		slog.Info("google oauth enabled")
	} else {
		slog.Info("google oauth disabled (no GOOGLE_OAUTH_* env vars); password login only")
	}

	if err := bootstrapInitialAdmins(ctx, q, cfg.InitialAdminEmails, cfg.InitialAdminPassword); err != nil {
		return err
	}

	// Rate limiteri — per-IP token bucket (in-memory).
	// MVP: jedna instanca; za multi-instance migrirati na Redis backend.
	loginLimiter := ratelimit.New(5, 5)    // 5 login pokusaja / IP / min
	submitLimiter := ratelimit.New(3, 3)   // 3 prijave / IP / min
	publicLimiter := ratelimit.New(60, 60) // 60 / IP / min za ostalo

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := pool.Ping(r.Context()); err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	authInterceptor := appconnect.NewAuthInterceptor()
	// Rate-limit interceptor: per-procedure limiteri za Connect RPC.
	// IP cita iz context-a (postavi ga ClientIPMiddleware ispod).
	rpcRateLimit := appconnect.NewRateLimitInterceptor(map[string]*ratelimit.Limiter{
		mrezav1connect.SurveyServiceSubmitProcedure: submitLimiter,
	}, publicLimiter)
	connectOpts := connect.WithInterceptors(rpcRateLimit, authInterceptor)

	surveyPath, surveyHandler := mrezav1connect.NewSurveyServiceHandler(
		appconnect.NewSurveyHandler(pool),
		connectOpts,
	)
	mux.Handle(surveyPath, surveyHandler)

	adminPath, adminHandler := mrezav1connect.NewAdminServiceHandler(
		appconnect.NewAdminHandler(pool, q),
		connectOpts,
	)
	mux.Handle(adminPath, adminHandler)

	mux.HandleFunc("GET /auth/methods", publicLimiter.WrapFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"password":true,"google":` + boolJSON(cfg.GoogleEnabled) + `}`))
	}))
	if cfg.GoogleEnabled {
		mux.HandleFunc("GET /auth/google/start", publicLimiter.WrapFunc(oauthStartHandler))
		mux.HandleFunc("GET /auth/google/callback", publicLimiter.WrapFunc(func(w http.ResponseWriter, r *http.Request) {
			oauthCallbackHandler(w, r, sessionStore, q, cfg)
		}))
	}
	mux.HandleFunc("POST /auth/password/login", loginLimiter.WrapFunc(func(w http.ResponseWriter, r *http.Request) {
		passwordLoginHandler(w, r, sessionStore, q)
	}))
	mux.HandleFunc("POST /auth/logout", publicLimiter.WrapFunc(func(w http.ResponseWriter, r *http.Request) {
		logoutHandler(w, r, sessionStore, cfg)
	}))

	// Middleware chain (vani → unutra):
	//   RequestID → ClientIPToContext → MaxBodySize → SessionMiddleware → RequestLogger → mux
	root := middleware.RequestID(
		middleware.ClientIPToContext(cfg.TrustProxyHeaders)(
			middleware.MaxBodySize(middleware.DefaultMaxBodyBytes)(
				middleware.SessionMiddleware(sessionStore, q)(
					middleware.RequestLogger(mux),
				),
			),
		),
	)
	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           h2c.NewHandler(root, &http2.Server{}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-sigCh:
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func boolJSON(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
