import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";

import { AdminLogo } from "@/components/admin/AdminLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthMethods } from "@/lib/auth-methods";
import { useCurrentAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import {
  passwordLogin,
  passwordLoginErrorMessage,
} from "@/lib/password-login";

function AdminSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-mreza-500 border-t-transparent"
        role="status"
        aria-label="Učitavanje"
      />
    </div>
  );
}

export function AdminLoginPage() {
  const { admin, isLoading, isUnauthenticated, refetch } = useCurrentAdmin();
  const { methods, isLoading: methodsLoading } = useAuthMethods();
  const [searchParams] = useSearchParams();
  const notAuthorized = searchParams.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();

  useEffect(() => {
    document.title = "Mreža — Admin pristup";
  }, []);

  if (isLoading || methodsLoading) {
    return <AdminSpinner />;
  }

  if (admin && !isUnauthenticated) {
    return <Navigate to="/admin/submissions" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setLoginError(undefined);
    setSubmitting(true);
    const result = await passwordLogin(email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (result.ok) {
      await refetch();
      window.location.href = "/admin/submissions";
      return;
    }
    setLoginError(passwordLoginErrorMessage(result.error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div
        className={cn(
          "w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm",
        )}
      >
        <AdminLogo className="mx-auto mb-4 h-14 w-14" />
        <h1 className="font-sans text-xl font-semibold text-slate-900">
          Admin pristup
        </h1>

        {notAuthorized && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-mreza-200 bg-mreza-50 px-3 py-2 font-sans text-sm text-mreza-900"
          >
            Vaša email adresa nema admin pristup. Kontaktirajte administratora.
          </p>
        )}

        <form
          className="mt-6 space-y-3 text-left"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="login-password">Lozinka</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {loginError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-700"
            >
              {loginError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Prijavljujemo…" : "Prijavi se"}
          </Button>
        </form>

        {methods.google && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="font-sans text-xs uppercase tracking-wider text-slate-400">
                ili
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <a href="/auth/google/start" className="inline-block w-full">
              <Button type="button" variant="secondary" className="w-full">
                Login sa Google
              </Button>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
