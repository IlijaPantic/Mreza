import { Code, ConnectError } from "@connectrpc/connect";

export const ADMIN_COPY = {
  generic: "Greška u komunikaciji.",
  unauthenticated: "Niste prijavljeni.",
  permissionDenied: "Nemate dozvolu za ovu akciju.",
  network: "Nema internet konekcije. Proveri vezu i pokušaj ponovo.",
} as const;

export function getAdminErrorMessage(err: unknown): string {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.Unauthenticated:
        return ADMIN_COPY.unauthenticated;
      case Code.PermissionDenied:
        return ADMIN_COPY.permissionDenied;
      case Code.FailedPrecondition:
      case Code.InvalidArgument:
        return err.message || ADMIN_COPY.generic;
      case Code.NotFound:
        return err.message || "Zapis nije pronađen.";
      default:
        return err.message || ADMIN_COPY.generic;
    }
  }
  if (err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"))) {
    return ADMIN_COPY.network;
  }
  return ADMIN_COPY.generic;
}
