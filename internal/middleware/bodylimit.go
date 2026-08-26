package middleware

import "net/http"

// DefaultMaxBodyBytes — 1 MB. Forme su male (par KB); cak i PDF download je
// response-side, ne request-side. 1 MB je vise nego dovoljno.
const DefaultMaxBodyBytes int64 = 1 << 20 // 1 MiB

// MaxBodySize wraps body sa http.MaxBytesReader. Ako klijent posalje vise od
// `max` bajtova, sledece Read vraca gresku i Connect/JSON dekoder odbija request.
func MaxBodySize(max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil && r.ContentLength != 0 {
				r.Body = http.MaxBytesReader(w, r.Body, max)
			}
			next.ServeHTTP(w, r)
		})
	}
}
