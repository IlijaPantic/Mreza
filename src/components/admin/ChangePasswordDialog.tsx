import { useMutation } from "@connectrpc/connect-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/gen/mreza/v1/admin-AdminService_connectquery";
import { getAdminErrorMessage } from "@/lib/admin-errors";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  /** true ako trenutni admin vec ima postavljenu lozinku (zahteva current_password). */
  hasPassword: boolean;
  onSuccess?: () => void;
}

export function ChangePasswordDialog({
  open,
  onClose,
  hasPassword,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mut = useMutation(changeMyPassword, {
    onSuccess: () => {
      reset();
      onSuccess?.();
      onClose();
    },
    onError: (err) => setError(getAdminErrorMessage(err)),
  });

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(undefined);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (newPassword.length < 8) {
      setError("Nova lozinka mora imati bar 8 karaktera.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Potvrda lozinke se ne poklapa.");
      return;
    }
    try {
      await mut.mutateAsync({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
    } catch {
      // error set in onError
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Promeni lozinku">
      <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        {hasPassword ? (
          <div>
            <Label htmlFor="cp-current">Trenutna lozinka</Label>
            <Input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-mreza-200 bg-mreza-50 px-3 py-2 font-sans text-sm text-mreza-900">
            Lozinka ti nije postavljena (samo Google login). Postavi je sada da bi mogao i preko forme.
          </p>
        )}
        <div>
          <Label htmlFor="cp-new">Nova lozinka (min 8)</Label>
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cp-confirm">Potvrdi novu lozinku</Label>
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="font-sans text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Otkaži
          </Button>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Čuvamo…" : "Sačuvaj"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
