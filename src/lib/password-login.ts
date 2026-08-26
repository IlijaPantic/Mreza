export type PasswordLoginErrorCode =
  | "invalid_credentials"
  | "password_not_set"
  | "invalid_input"
  | "internal_error"
  | "network";

export type PasswordLoginResult =
  | { ok: true }
  | { ok: false; error: PasswordLoginErrorCode };

export async function passwordLogin(
  email: string,
  password: string,
): Promise<PasswordLoginResult> {
  let res: Response;
  try {
    res = await fetch("/auth/password/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (res.ok) {
    return { ok: true };
  }
  try {
    const body = (await res.json()) as { error?: string };
    const code = body.error ?? "internal_error";
    if (
      code === "invalid_credentials" ||
      code === "password_not_set" ||
      code === "invalid_input" ||
      code === "internal_error"
    ) {
      return { ok: false, error: code };
    }
    return { ok: false, error: "internal_error" };
  } catch {
    return { ok: false, error: "internal_error" };
  }
}

export function passwordLoginErrorMessage(code: PasswordLoginErrorCode): string {
  switch (code) {
    case "invalid_credentials":
      return "Pogrešan email ili lozinka.";
    case "password_not_set":
      return "Za ovog admina lozinka nije postavljena. Prijavi se preko Google ili zatraži od drugog admina da ti postavi lozinku.";
    case "invalid_input":
      return "Email i lozinka su obavezni.";
    case "network":
      return "Nema internet konekcije. Proveri vezu i pokušaj ponovo.";
    case "internal_error":
    default:
      return "Greška na serveru. Pokušaj ponovo.";
  }
}
