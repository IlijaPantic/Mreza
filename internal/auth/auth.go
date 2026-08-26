package auth

import (
	"context"

	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
)

type adminContextKey struct{}

func AdminFromContext(ctx context.Context) (*dbgen.AdminUser, bool) {
	admin, ok := ctx.Value(adminContextKey{}).(*dbgen.AdminUser)
	return admin, ok
}

func AdminToContext(ctx context.Context, admin *dbgen.AdminUser) context.Context {
	return context.WithValue(ctx, adminContextKey{}, admin)
}
