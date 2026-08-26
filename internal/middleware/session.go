package middleware

import (
	"errors"
	"net/http"

	"github.com/gorilla/sessions"
	"github.com/jackc/pgx/v5"

	"git.izbori.xyz/trsr/mreza-anketa/internal/auth"
	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	"git.izbori.xyz/trsr/mreza-anketa/internal/session"
)

func SessionMiddleware(store *sessions.CookieStore, q dbgen.Querier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			if adminID, ok := session.GetAdminID(r, store); ok {
				admin, err := q.GetAdminByID(ctx, adminID)
				if err == nil && admin.Active {
					ctx = auth.AdminToContext(ctx, &admin)
				} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
					// invalid session — leave context without admin
				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
