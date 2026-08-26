package connect

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	"git.izbori.xyz/trsr/mreza-anketa/internal/auth"
	mrezav1connect "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1/mrezav1connect"
)

// publicProcedures su jedine procedure dostupne bez sesije. Sve sto nije
// ovde ili pod AdminService prefiksom dobija Unauthenticated (deny by default).
var publicProcedures = map[string]bool{
	mrezav1connect.SurveyServiceSubmitProcedure: true,
}

var adminOnlyProcedures = map[string]bool{
	mrezav1connect.AdminServiceInviteAdminProcedure:     true,
	mrezav1connect.AdminServiceRevokeAdminProcedure:     true,
	mrezav1connect.AdminServiceReactivateAdminProcedure: true,
}

func NewAuthInterceptor() connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			proc := req.Spec().Procedure
			if publicProcedures[proc] {
				return next(ctx, req)
			}

			if strings.HasPrefix(proc, "/mreza.v1.AdminService/") {
				admin, ok := auth.AdminFromContext(ctx)
				if !ok {
					return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
				}
				if !admin.Active {
					return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
				}
				if adminOnlyProcedures[proc] && admin.Role != "admin" {
					return nil, connect.NewError(connect.CodePermissionDenied, errors.New("admin role required"))
				}
				return next(ctx, req)
			}

			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("authentication required"))
		}
	}
}
