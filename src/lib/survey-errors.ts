import { Code, ConnectError } from "@connectrpc/connect";

export const COPY = {
  duplicateEmail:
    "Već postoji prijava sa ovom email adresom. Ako misliš da je greška, javi nam se.",
  genericSubmit: "Greška u slanju. Pokušaj ponovo za par sekundi.",
  rateLimited:
    "Previše pokušaja u kratkom roku. Sačekaj minut pa probaj ponovo.",
  network: "Nema internet konekcije. Proveri vezu i pokušaj ponovo.",
} as const;

export function isDuplicateEmailError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.FailedPrecondition;
}

export function getSubmitErrorMessage(err: unknown): string {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.FailedPrecondition:
        return COPY.duplicateEmail;
      // Rate limiter vraca ResourceExhausted; generic poruka bi ovde navela
      // korisnika da odmah pokusa opet i ponovo udari u limit.
      case Code.ResourceExhausted:
        return COPY.rateLimited;
      case Code.InvalidArgument:
        return err.message || COPY.genericSubmit;
      default:
        return COPY.genericSubmit;
    }
  }
  if (isNetworkError(err)) {
    return COPY.network;
  }
  return COPY.genericSubmit;
}

export function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error &&
      (err.message.includes("fetch") || err.message.includes("network")))
  );
}
