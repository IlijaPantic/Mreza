// Package ratelimit — per-IP token bucket za HTTP endpoint-e.
// MVP-friendly (in-memory, single instance). Ako se skalira na vise instanci,
// migrirati na Redis backend.
package ratelimit

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Limiter — per-IP token bucket. Goroutine-safe.
type Limiter struct {
	mu         sync.Mutex
	visitors   map[string]*visitor
	rate       rate.Limit
	burst      int
	retryAfter int // seconds, za Retry-After header
}

// New kreira limiter koji dozvoljava `perMinute` requests po IP-u u proseku,
// sa `burst` instant kapacitetom.
// Primer: New(5, 5) = 5 req/min sa burst od 5 (token se regenerise svakih 12s).
func New(perMinute, burst int) *Limiter {
	l := &Limiter{
		visitors:   make(map[string]*visitor),
		rate:       rate.Limit(float64(perMinute) / 60.0),
		burst:      burst,
		retryAfter: 60,
	}
	go l.cleanupLoop()
	return l
}

// AllowIP vraca true ako je IP imao raspolozive tokene; false ako je rate-limited.
// Koristi se direktno (npr. iz Connect interceptor-a) kad nije zgodno wrap-ovati HTTP handler.
func (l *Limiter) AllowIP(ip string) bool {
	return l.getLimiter(ip).Allow()
}

// getLimiter vraca per-IP limiter (lazy create).
func (l *Limiter) getLimiter(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	v, ok := l.visitors[ip]
	if !ok {
		v = &visitor{
			limiter:  rate.NewLimiter(l.rate, l.burst),
			lastSeen: time.Now(),
		}
		l.visitors[ip] = v
		return v.limiter
	}
	v.lastSeen = time.Now()
	return v.limiter
}

// cleanupLoop uklanja IP-ove koji se nisu javili duze od 10 min.
func (l *Limiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-10 * time.Minute)
		l.mu.Lock()
		for ip, v := range l.visitors {
			if v.lastSeen.Before(cutoff) {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

// Wrap vraca http.Handler koji proverava limit pre nego sto pozove next.
// IP se cita iz context-a — jedno mesto odlucuje kako se IP izvodi, pa HTTP
// ruta i Connect procedura ne mogu da se raziju oko toga ko je klijent.
func (l *Limiter) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := IPFromRequestContext(r)
		if !l.getLimiter(ip).Allow() {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", strconv.Itoa(l.retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"rate_limited","retry_after_seconds":` + strconv.Itoa(l.retryAfter) + `}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// WrapFunc je shortcut za http.HandlerFunc.
func (l *Limiter) WrapFunc(next http.HandlerFunc) http.HandlerFunc {
	wrapped := l.Wrap(next)
	return wrapped.ServeHTTP
}

// ClientIP vraca IP klijenta za potrebe rate limita.
//
// X-Forwarded-For / X-Real-IP se postuju SAMO kad trustProxy = true, tj. kad je
// backend zaista iza reverse proxy-ja koji te headere prepisuje. Ako bi se
// verovalo bezuslovno, svako ko dodje direktno do backend porta mogao bi da
// obori rate limit rotiranjem izmisljenog X-Forwarded-For — a to je upravo
// zastita koju limiter treba da pruzi.
func ClientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			// Lista formata "client, proxy1, proxy2" — prvi je pravi klijent.
			parts := strings.Split(xff, ",")
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
		if xri := r.Header.Get("X-Real-IP"); xri != "" {
			return strings.TrimSpace(xri)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type ipContextKey struct{}

// ContextWithIP upisuje razreseni IP klijenta u context. Poziva ga
// middleware.ClientIPToContext jednom po zahtevu.
func ContextWithIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, ipContextKey{}, ip)
}

// IPFromContext vraca IP koji je middleware upisao, ili "" ako ga nema
// (npr. test koji zove handler bez middleware lanca).
func IPFromContext(ctx context.Context) string {
	ip, _ := ctx.Value(ipContextKey{}).(string)
	return ip
}

// IPFromRequestContext je isto, ali za HTTP handlere. Pada nazad na RemoteAddr
// tako da limiter nikad ne svrsta sve pozivaoce u jedan "" bucket.
func IPFromRequestContext(r *http.Request) string {
	if ip := IPFromContext(r.Context()); ip != "" {
		return ip
	}
	return ClientIP(r, false)
}
