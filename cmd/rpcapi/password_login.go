package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gorilla/sessions"
	"github.com/jackc/pgx/v5"

	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	"git.izbori.xyz/trsr/mreza-anketa/internal/password"
	"git.izbori.xyz/trsr/mreza-anketa/internal/session"
)

type passwordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type passwordLoginErrorResponse struct {
	Error string `json:"error"`
}

type passwordLoginOKResponse struct {
	OK bool `json:"ok"`
}

// passwordLoginHandler — POST /auth/password/login
// Body: {"email": "...", "password": "..."}
// Success: 200 + Set-Cookie session + {"ok": true}
// Bad creds: 401 + {"error": "invalid_credentials"}
// Bad input: 400 + {"error": "invalid_input"}
func passwordLoginHandler(w http.ResponseWriter, r *http.Request, store *sessions.CookieStore, q *dbgen.Queries) {
	w.Header().Set("Content-Type", "application/json")

	var body passwordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeLoginError(w, http.StatusBadRequest, "invalid_input")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		writeLoginError(w, http.StatusBadRequest, "invalid_input")
		return
	}

	admin, err := q.GetAdminByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeLoginError(w, http.StatusUnauthorized, "invalid_credentials")
			return
		}
		writeLoginError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	if !admin.Active {
		writeLoginError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}
	if admin.PasswordHash == nil || *admin.PasswordHash == "" {
		// Admin postoji ali nema postavljen password (samo OAuth path).
		writeLoginError(w, http.StatusUnauthorized, "password_not_set")
		return
	}
	if err := password.Compare(*admin.PasswordHash, body.Password); err != nil {
		writeLoginError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}

	if err := q.TouchAdminLastLogin(r.Context(), admin.ID); err != nil {
		writeLoginError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	if err := session.SetAdminID(w, r, store, admin.ID); err != nil {
		writeLoginError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	_ = json.NewEncoder(w).Encode(passwordLoginOKResponse{OK: true})
}

func writeLoginError(w http.ResponseWriter, status int, code string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(passwordLoginErrorResponse{Error: code})
}
