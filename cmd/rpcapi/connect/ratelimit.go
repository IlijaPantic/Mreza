package connect

import (
	"context"
	"errors"
	"strconv"

	"connectrpc.com/connect"

	"git.izbori.xyz/trsr/mreza-anketa/internal/middleware"
	"git.izbori.xyz/trsr/mreza-anketa/internal/ratelimit"
)

// NewRateLimitInterceptor — per-procedure rate limit za Connect RPC.
//   - perProcedure: mapping procedure path -> limiter (strogi za vruce metode)
//   - fallback: limiter za sve ostale procedure
//
// IP se cita iz request context-a (postavlja middleware.ClientIPToContext).
// Ako IP nije dostupan (npr. test bez middleware-a), koristi se "unknown".
func NewRateLimitInterceptor(
	perProcedure map[string]*ratelimit.Limiter,
	fallback *ratelimit.Limiter,
) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			ip := middleware.ClientIPFromContext(ctx)
			if ip == "" {
				ip = "unknown"
			}
			limiter := fallback
			if l, ok := perProcedure[req.Spec().Procedure]; ok {
				limiter = l
			}
			if limiter != nil && !limiter.AllowIP(ip) {
				err := connect.NewError(connect.CodeResourceExhausted, errors.New("rate_limited"))
				err.Meta().Set("Retry-After", strconv.Itoa(60))
				return nil, err
			}
			return next(ctx, req)
		}
	}
}
