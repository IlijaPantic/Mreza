package config

import (
	"encoding/base64"
	"log"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL             string
	HTTPAddr                string
	GoogleEnabled           bool
	GoogleOAuthClientID     string
	GoogleOAuthClientSecret string
	GoogleOAuthCallbackURL  string
	SessionSecret           []byte
	InitialAdminEmails      []string
	InitialAdminPassword    string // plaintext iz env; hash-uje se pri bootstrapu
	PublicBaseURL           string
	Env                     string
	// TrustProxyHeaders: postuj X-Forwarded-For / X-Real-IP pri odredjivanju
	// IP-a klijenta. Ukljuciti SAMO iza reverse proxy-ja koji te headere
	// prepisuje (Caddy/Nginx). Vidi internal/ratelimit.ClientIP.
	TrustProxyHeaders bool
}

func Load() Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = ":8080"
	}

	// Google OAuth je opcionalan. Enabled kad su CLIENT_ID i CLIENT_SECRET oba postavljena.
	// CALLBACK_URL ima razuman default i nije signal za enabled.
	clientID := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"))
	callbackURL := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CALLBACK_URL"))
	googleEnabled := clientID != "" && clientSecret != ""
	if (clientID != "") != (clientSecret != "") {
		log.Fatal("GOOGLE_OAUTH_CLIENT_ID i GOOGLE_OAUTH_CLIENT_SECRET: postavi oba ili nijedan (OAuth disabled)")
	}
	if googleEnabled && callbackURL == "" {
		log.Fatal("GOOGLE_OAUTH_CALLBACK_URL je obavezan kada je Google OAuth enabled")
	}

	sessionSecret := parseSessionSecret(os.Getenv("SESSION_SECRET"))

	initialAdminPassword := os.Getenv("INITIAL_ADMIN_PASSWORD")
	if initialAdminPassword != "" && len(initialAdminPassword) < 8 {
		log.Fatalf("INITIAL_ADMIN_PASSWORD mora imati bar 8 karaktera, dobio %d", len(initialAdminPassword))
	}

	publicBaseURL := os.Getenv("PUBLIC_BASE_URL")
	if publicBaseURL == "" {
		publicBaseURL = "http://localhost:5173"
	}
	publicBaseURL = strings.TrimRight(publicBaseURL, "/")

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "dev"
	}
	if appEnv != "dev" && appEnv != "prod" {
		log.Fatalf("APP_ENV must be dev or prod, got %q", appEnv)
	}

	return Config{
		DatabaseURL:             dbURL,
		HTTPAddr:                httpAddr,
		GoogleEnabled:           googleEnabled,
		GoogleOAuthClientID:     clientID,
		GoogleOAuthClientSecret: clientSecret,
		GoogleOAuthCallbackURL:  callbackURL,
		SessionSecret:           sessionSecret,
		InitialAdminEmails:      parseInitialAdminEmails(os.Getenv("INITIAL_ADMIN_EMAILS")),
		InitialAdminPassword:    initialAdminPassword,
		PublicBaseURL:           publicBaseURL,
		TrustProxyHeaders:       os.Getenv("TRUST_PROXY_HEADERS") == "true",
		Env:                     appEnv,
	}
}

func parseSessionSecret(raw string) []byte {
	if raw == "" {
		log.Fatal("SESSION_SECRET is required")
	}
	var secret []byte
	if strings.HasPrefix(raw, "base64:") {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(raw, "base64:"))
		if err != nil {
			log.Fatalf("SESSION_SECRET base64 decode: %v", err)
		}
		secret = decoded
	} else {
		secret = []byte(raw)
	}
	if len(secret) < 32 {
		log.Fatalf("SESSION_SECRET must be at least 32 bytes, got %d", len(secret))
	}
	return secret
}

func parseInitialAdminEmails(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		email := strings.ToLower(strings.TrimSpace(p))
		if email != "" {
			out = append(out, email)
		}
	}
	return out
}
