import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet } from "react-router";

import { AdminLogo } from "@/components/admin/AdminLogo";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";
import { Button } from "@/components/ui/button";
import { logoutAdmin, useCurrentAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";

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

export function AdminLayout() {
  const { admin, isLoading, isUnauthenticated, refetch } = useCurrentAdmin();
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  useEffect(() => {
    document.title = "Mreža — Admin panel";
  }, []);

  if (isLoading) {
    return <AdminSpinner />;
  }

  if (isUnauthenticated || !admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
          <AdminLogo className="h-9 w-9" />
          <span className="font-display text-sm font-semibold tracking-wide text-slate-900">
            Mreža Admin
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <NavLink
            to="/admin/submissions"
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-2 font-sans text-sm font-medium transition",
                isActive
                  ? "bg-mreza-100 text-mreza-900"
                  : "text-slate-600 hover:bg-mreza-50 hover:text-slate-900",
              )
            }
          >
            Prijave
          </NavLink>
          <NavLink
            to="/admin/admins"
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-2 font-sans text-sm font-medium transition",
                isActive
                  ? "bg-mreza-100 text-mreza-900"
                  : "text-slate-600 hover:bg-mreza-50 hover:text-slate-900",
              )
            }
          >
            Admini
          </NavLink>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="md:hidden">
            <AdminLogo />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-sm font-semibold text-slate-900">
              Admin panel
            </h1>
            <p className="truncate font-sans text-xs text-slate-500">
              {admin.email}
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => setChangePwdOpen(true)}
          >
            Promeni lozinku
          </Button>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => void logoutAdmin()}
          >
            Odjavi se
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordDialog
        open={changePwdOpen}
        onClose={() => setChangePwdOpen(false)}
        hasPassword={admin.hasPassword}
        onSuccess={() => void refetch()}
      />
    </div>
  );
}
