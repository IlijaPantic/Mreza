import { SocialNetwork } from "@/gen/mreza/v1/survey_pb";

/**
 * Fiksna lista drustvenih mreza koje prijavljeni moze staviti na raspolaganje.
 *
 * Kao i kod uloga: wire format je proto enum, a slug-ovi u bazi zive u
 * `internal/catalog/catalog.go`. Dodavanje mreze zahteva izmenu na oba mesta
 * (plus novu ikonicu u `src/components/survey/NetworkIcon.tsx`).
 */

export type NetworkDef = {
  network: SocialNetwork;
  label: string;
};

export const SOCIAL_NETWORKS: NetworkDef[] = [
  { network: SocialNetwork.FACEBOOK, label: "Facebook" },
  { network: SocialNetwork.INSTAGRAM, label: "Instagram" },
  { network: SocialNetwork.TIKTOK, label: "TikTok" },
  { network: SocialNetwork.YOUTUBE, label: "YouTube" },
  { network: SocialNetwork.TELEGRAM, label: "Telegram" },
  { network: SocialNetwork.X, label: "X / Twitter" },
  { network: SocialNetwork.BLOG, label: "Blog / web stranica" },
];

export function getNetworkLabel(network: SocialNetwork): string {
  return SOCIAL_NETWORKS.find((n) => n.network === network)?.label ?? "—";
}
