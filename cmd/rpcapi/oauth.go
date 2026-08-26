package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/sessions"
	"github.com/jackc/pgx/v5"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/google"

	"git.izbori.xyz/trsr/mreza-anketa/internal/config"
	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	"git.izbori.xyz/trsr/mreza-anketa/internal/password"
	"git.izbori.xyz/trsr/mreza-anketa/internal/session"
)

func initGoth(cfg config.Config) {
	goth.UseProviders(google.New(
		cfg.GoogleOAuthClientID,
		cfg.GoogleOAuthClientSecret,
		cfg.GoogleOAuthCallbackURL,
		"email", "profile",
	))
}

func oauthStartHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("provider") == "" {
		q.Set("provider", "google")
		r.URL.RawQuery = q.Encode()
	}
	gothic.BeginAuthHandler(w, r)
}

func oauthCallbackHandler(
	w http.ResponseWriter,
	r *http.Request,
	store *sessions.CookieStore,
	q *dbgen.Queries,
	cfg config.Config,
) {
	user, err := gothic.CompleteUserAuth(w, r)
	if err != nil {
		http.Redirect(w, r, loginErrorURL(cfg, "oauth_failed"), http.StatusFound)
		return
	}

	email := strings.ToLower(strings.TrimSpace(user.Email))
	admin, err := q.GetAdminByEmail(r.Context(), email)
	if errors.Is(err, pgx.ErrNoRows) || !admin.Active {
		http.Redirect(w, r, loginErrorURL(cfg, "not_authorized"), http.StatusFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := q.TouchAdminLastLogin(r.Context(), admin.ID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := session.SetAdminID(w, r, store, admin.ID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, cfg.PublicBaseURL+"/admin/submissions", http.StatusFound)
}

func logoutHandler(w http.ResponseWriter, r *http.Request, store *sessions.CookieStore, cfg config.Config) {
	_ = session.Clear(w, r, store)
	http.Redirect(w, r, cfg.PublicBaseURL+"/admin/login", http.StatusFound)
}

func loginErrorURL(cfg config.Config, code string) string {
	return fmt.Sprintf("%s/admin/login?error=%s", cfg.PublicBaseURL, url.QueryEscape(code))
}

// bootstrapInitialAdmins upsert-uje sve INITIAL_ADMIN_EMAILS sa role='admin' i active=true.
// Ako je initialPassword postavljen, hash-uje ga i postavlja za svaki od tih email-ova
// (tako da admin moze odmah password login). Ako nije, password ostaje (ili je) NULL —
// admin moze samo Google OAuth (ako je Google enabled i email je Gmail u Google projektu).
func bootstrapInitialAdmins(ctx context.Context, q *dbgen.Queries, emails []string, initialPassword string) error {
	if len(emails) == 0 {
		return nil
	}
	var hashPtr *string
	if initialPassword != "" {
		hash, err := password.Hash(initialPassword)
		if err != nil {
			return fmt.Errorf("hash initial password: %w", err)
		}
		hashPtr = &hash
	}
	for _, email := range emails {
		if _, err := q.UpsertInitialAdmin(ctx, dbgen.UpsertInitialAdminParams{
			Email: email,
			Role:  "admin",
		}); err != nil {
			return fmt.Errorf("upsert initial admin %q: %w", email, err)
		}
		if hashPtr != nil {
			if err := q.SetAdminPasswordHashByEmail(ctx, dbgen.SetAdminPasswordHashByEmailParams{
				PasswordHash: hashPtr,
				Email:        email,
			}); err != nil {
				return fmt.Errorf("set initial password for %q: %w", email, err)
			}
			slog.Info("bootstrap admin: password set", "email", email)
		}
	}
	return nil
}
