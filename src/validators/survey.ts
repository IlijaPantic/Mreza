import type { ParticipationRole, SocialNetwork } from "@/gen/mreza/v1/survey_pb";

/**
 * Validacija javne forme.
 *
 * Ovo je UX sloj — pravila su namerno ista kao u `cmd/rpcapi/connect/survey.go`,
 * ali backend je jedini autoritet. Kad se pravilo menja, menja se na oba mesta.
 */

export const VALIDATION_COPY = {
  required: "Ovo polje je obavezno",
  email: "Unesi ispravnu email adresu",
  phone: "Unesi srpski broj (06…) ili međunarodni (+38…)",
  roles: "Izaberi bar jedan način učešća",
  largeReachUrl: "Unesi link ka mediju ili profilu",
  url: "Unesi ispravan link (npr. instagram.com/tvoj-profil)",
  gdpr: "Moraš dati saglasnost da bi poslao/la prijavu",
  maxLength: (max: number) => `Maksimalno ${max} karaktera`,
} as const;

// Ogranicenja moraju odgovarati konstantama u cmd/rpcapi/connect/survey.go.
export const LIMITS = {
  name: 100,
  email: 254,
  largeReachUrl: 500,
} as const;

const EMAIL_RE = /^.+@.+\..+$/;
const PHONE_LOCAL_RE = /^06\d{7,8}$/;
const PHONE_INTL_RE = /^\+38\d{8,12}$/;

export type SurveyFormValues = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  roles: ParticipationRole[];
  networks: SocialNetwork[];
  hasLargeReach: boolean;
  largeReachUrl: string;
  gdprConsent: boolean;
};

export function trimField(value: string): string {
  return value.trim();
}

export function validateName(value: string): string | undefined {
  const t = trimField(value);
  if (t === "") return VALIDATION_COPY.required;
  if (t.length > LIMITS.name) return VALIDATION_COPY.maxLength(LIMITS.name);
  return undefined;
}

/** Email je opcion; ako je unet, mora da ima oblik adrese. */
export function validateEmail(value: string): string | undefined {
  const t = trimField(value).toLowerCase();
  if (t === "") return undefined;
  if (t.length > LIMITS.email) return VALIDATION_COPY.maxLength(LIMITS.email);
  if (!EMAIL_RE.test(t)) return VALIDATION_COPY.email;
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  const normalized = normalizePhone(value);
  if (normalized === "") return VALIDATION_COPY.required;
  if (!PHONE_LOCAL_RE.test(normalized) && !PHONE_INTL_RE.test(normalized)) {
    return VALIDATION_COPY.phone;
  }
  return undefined;
}

export function validateRoles(roles: ParticipationRole[]): string | undefined {
  if (roles.length === 0) return VALIDATION_COPY.roles;
  return undefined;
}

/**
 * Link ka mediju veceg dometa. Obavezan je kad je opcija cekirana — inace
 * cekboks ne nosi nijednu upotrebljivu informaciju. Ko nece da ostavi link,
 * ostavlja opciju neoznacenu.
 */
export function validateLargeReachUrl(
  value: string,
  hasLargeReach: boolean,
): string | undefined {
  const t = trimField(value);
  if (!hasLargeReach) return undefined;
  if (t === "") return VALIDATION_COPY.largeReachUrl;
  if (t.length > LIMITS.largeReachUrl) {
    return VALIDATION_COPY.maxLength(LIMITS.largeReachUrl);
  }
  if (!looksLikeUrl(t)) return VALIDATION_COPY.url;
  return undefined;
}

export function validateGdpr(consent: boolean): string | undefined {
  if (!consent) return VALIDATION_COPY.gdpr;
  return undefined;
}

export function normalizePhone(value: string): string {
  return trimField(value).replace(/\s/g, "");
}

/**
 * Ista provera kao `optionalURL` na backendu: shema se dopisuje ako fali,
 * a prihvataju se samo http(s) i host sa tackom.
 */
export function looksLikeUrl(value: string): boolean {
  const raw = trimField(value);
  if (raw === "" || /\s/.test(raw)) return false;
  const withScheme = raw.includes("://") ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}
