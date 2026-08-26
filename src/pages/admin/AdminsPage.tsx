import { createConnectQueryKey, useMutation, useQuery } from "@connectrpc/connect-query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  inviteAdmin,
  listAdmins,
  reactivateAdmin,
  revokeAdmin,
} from "@/gen/mreza/v1/admin-AdminService_connectquery";
import { AdminRole } from "@/gen/mreza/v1/admin_pb";
import { useCurrentAdmin } from "@/lib/auth";
import { getAdminErrorMessage } from "@/lib/admin-errors";
import { formatTimestamp } from "@/lib/format-timestamp";
import { transport } from "@/lib/transport";

function roleBadgeVariant(role: AdminRole): "admin" | "viewer" | "default" {
  if (role === AdminRole.ADMIN) return "admin";
  if (role === AdminRole.VIEWER) return "viewer";
  return "default";
}

function roleLabel(role: AdminRole): string {
  if (role === AdminRole.ADMIN) return "Admin";
  if (role === AdminRole.VIEWER) return "Viewer";
  return "—";
}

export function AdminsPage() {
  const queryClient = useQueryClient();
  const { admin: currentAdmin } = useCurrentAdmin();
  const adminsQ = useQuery(listAdmins, {});

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  function invalidateList() {
    void queryClient.invalidateQueries({
      queryKey: createConnectQueryKey({
        schema: listAdmins,
        transport,
        cardinality: "finite",
      }),
    });
  }

  const inviteMut = useMutation(inviteAdmin, {
    onSuccess: () => {
      invalidateList();
      setInviteOpen(false);
      setInviteEmail("");
      setInvitePassword("");
      setInviteError(undefined);
    },
    onError: (err) => setInviteError(getAdminErrorMessage(err)),
  });

  const revokeMut = useMutation(revokeAdmin, {
    onSuccess: () => {
      invalidateList();
      setRevokeTargetId(null);
      setActionError(undefined);
    },
    onError: (err) => {
      setActionError(getAdminErrorMessage(err));
      setRevokeTargetId(null);
    },
  });

  const reactivateMut = useMutation(reactivateAdmin, {
    onSuccess: () => {
      invalidateList();
      setActionError(undefined);
    },
    onError: (err) => setActionError(getAdminErrorMessage(err)),
  });

  const isAdminRole = currentAdmin?.role === AdminRole.ADMIN;
  const allAdmins = adminsQ.data?.admins ?? [];
  const admins = showOnlyActive
    ? allAdmins.filter((a) => a.active)
    : allAdmins;
  const hiddenCount = allAdmins.length - admins.length;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(undefined);
    if (invitePassword !== "" && invitePassword.length < 8) {
      setInviteError("Lozinka mora imati bar 8 karaktera (ili ostavi prazno).");
      return;
    }
    try {
      await inviteMut.mutateAsync({
        email: inviteEmail.trim().toLowerCase(),
        role: AdminRole.ADMIN,
        initialPassword: invitePassword || undefined,
      });
    } catch {
      // inviteError set in onError
    }
  }

  function handleRevoke(id: string) {
    setActionError(undefined);
    setRevokeTargetId(id);
  }

  function confirmRevoke() {
    if (!revokeTargetId) return;
    revokeMut.mutate({ id: revokeTargetId });
  }

  function handleReactivate(id: string) {
    setActionError(undefined);
    reactivateMut.mutate({ id });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-sans text-lg font-semibold text-slate-900">Admini</h2>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-mreza-600"
            />
            Prikaži samo aktivne
            {showOnlyActive && hiddenCount > 0 && (
              <span className="text-xs text-slate-500">
                ({hiddenCount} {hiddenCount === 1 ? "skriven" : "skriveno"})
              </span>
            )}
          </label>
          {isAdminRole && (
            <Button onClick={() => setInviteOpen(true)}>Pozovi admina</Button>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="font-sans text-sm text-red-600">
          {actionError}
        </p>
      )}

      {adminsQ.isPending && (
        <div className="flex justify-center py-12">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-mreza-500 border-t-transparent"
            role="status"
            aria-label="Učitavanje"
          />
        </div>
      )}

      {adminsQ.isError && (
        <p role="alert" className="font-sans text-sm text-red-600">
          {getAdminErrorMessage(adminsQ.error)}
        </p>
      )}

      {adminsQ.isSuccess && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Email</TableHead>
              <TableHead>Uloga</TableHead>
              <TableHead>Aktivan</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Poslednja prijava</TableHead>
              <TableHead>Akcije</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(a.role)}>
                    {roleLabel(a.role)}
                  </Badge>
                </TableCell>
                <TableCell>{a.active ? "Da" : "Ne"}</TableCell>
                <TableCell className="text-xs text-slate-600">
                  {a.hasPassword ? "Lozinka" : "Samo Google"}
                </TableCell>
                <TableCell>{formatTimestamp(a.lastLoginAt)}</TableCell>
                <TableCell>
                  {a.active ? (
                    <Button
                      variant="secondary"
                      className="text-red-700 hover:bg-red-50"
                      disabled={
                        !isAdminRole ||
                        a.id === currentAdmin?.id ||
                        revokeMut.isPending
                      }
                      onClick={() => handleRevoke(a.id)}
                    >
                      Ukloni
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="text-green-700 hover:bg-green-50"
                      disabled={!isAdminRole || reactivateMut.isPending}
                      onClick={() => handleReactivate(a.id)}
                    >
                      Aktiviraj
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteError(undefined);
        }}
        title="Pozovi admina"
      >
        <form className="space-y-4" onSubmit={(e) => void handleInvite(e)}>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-password">
              Inicijalna lozinka (opciono, min 8)
            </Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              placeholder="Ostavi prazno za samo Google login"
            />
            <p className="mt-1 font-sans text-xs text-slate-500">
              Ako postaviš, admin može odmah da se prijavi sa email + lozinkom.
              Inače može samo preko Google (ako je Gmail).
            </p>
          </div>
          {inviteError && (
            <p role="alert" className="font-sans text-sm text-red-600">
              {inviteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setInviteOpen(false)}
            >
              Otkaži
            </Button>
            <Button type="submit" disabled={inviteMut.isPending}>
              {inviteMut.isPending ? "Šaljemo…" : "Pozovi"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={revokeTargetId !== null}
        onClose={() => setRevokeTargetId(null)}
        title="Ukloni admina"
      >
        <p className="font-sans text-sm text-slate-600">
          Da li ste sigurni da želite da uklonite ovog admina?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRevokeTargetId(null)}>
            Otkaži
          </Button>
          <Button
            className="bg-red-700 hover:bg-red-800"
            disabled={revokeMut.isPending}
            onClick={confirmRevoke}
          >
            {revokeMut.isPending ? "Uklanjamo…" : "Ukloni"}
          </Button>
        </div>
      </Dialog>

    </div>
  );
}
