import { getRoleLabel } from "@/data/roles";
import { getNetworkLabel } from "@/data/social-networks";
import type { ParticipationRole, SocialNetwork } from "@/gen/mreza/v1/survey_pb";

const EMPTY = "—";

export function formatRoles(roles: ParticipationRole[]): string {
  if (roles.length === 0) return EMPTY;
  return roles.map(getRoleLabel).join(", ");
}

export function formatNetworks(networks: SocialNetwork[]): string {
  if (networks.length === 0) return EMPTY;
  return networks.map(getNetworkLabel).join(", ");
}

/**
 * Vraca href samo za http(s) linkove; za sve ostalo vraca undefined.
 *
 * Linkovi u admin panelu dolaze iz javne forme, dakle od nepoznatog korisnika.
 * Backend ih vec normalizuje i odbija sve sto nije http(s), ali admin panel
 * renderuje <a href> sa tom vrednoscu — a "javascript:" link tu bi bio XSS ka
 * nalogu sa najvise prava u sistemu. Zato se provera ponavlja i ovde: sadrzaj
 * u bazi je podatak, ne poverenje.
 */
export function safeExternalHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}
