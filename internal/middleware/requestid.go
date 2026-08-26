package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type requestIDKey struct{}

// HeaderRequestID — naziv HTTP header-a kroz koji se nosi/prihvata request ID.
const HeaderRequestID = "X-Request-ID"

// RequestID middleware:
//   - ako klijent (ili reverse proxy) prosledi X-Request-ID, koristi taj
//   - inace generise nov UUID v4
//
// ID se postavlja u response header i u request context (RequestIDFromContext).
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get(HeaderRequestID)
		if rid == "" {
			rid = uuid.NewString()
		}
		w.Header().Set(HeaderRequestID, rid)
		ctx := context.WithValue(r.Context(), requestIDKey{}, rid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequestIDFromContext vraca request ID iz context-a, ili prazan string.
func RequestIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(requestIDKey{}).(string)
	return v
}
