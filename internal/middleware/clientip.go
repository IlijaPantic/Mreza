package middleware

import (
	"context"
	"net/http"

	"git.izbori.xyz/trsr/mreza-anketa/internal/ratelimit"
)

// ClientIPToContext razresava IP klijenta jednom po zahtevu i upisuje ga u
// context, tako da i HTTP handleri i Connect interceptori (koji nemaju pristup
// *http.Request) gledaju u istu vrednost.
//
// trustProxy dolazi iz TRUST_PROXY_HEADERS. Ukljucuje se SAMO kad je backend
// iza reverse proxy-ja koji prepisuje X-Forwarded-For; inace bi klijent mogao
// da izabere svoj "IP" i time obesmisli rate limit.
func ClientIPToContext(trustProxy bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := ratelimit.ClientIP(r, trustProxy)
			next.ServeHTTP(w, r.WithContext(ratelimit.ContextWithIP(r.Context(), ip)))
		})
	}
}

// ClientIPFromContext vraca IP iz context-a, ili "" ako nije postavljen.
func ClientIPFromContext(ctx context.Context) string {
	return ratelimit.IPFromContext(ctx)
}
