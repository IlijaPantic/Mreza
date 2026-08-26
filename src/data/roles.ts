import { ParticipationRole } from "@/gen/mreza/v1/survey_pb";

/**
 * Fiksna lista nacina ucesca u kampanji.
 *
 * Wire format je proto enum — slug-ovi koji zavrse u bazi zive u
 * `internal/catalog/catalog.go`. Kad se ovde doda uloga, mora se dodati i tamo
 * (enum, slug, labela), inace backend odbija prijavu sa novom vrednoscu.
 */

export type RoleDef = {
  role: ParticipationRole;
  /** Kratka labela — nosi je kartica, tabela i CSV zaglavlje. */
  label: string;
  /** Puno objasnjenje sta uloga podrazumeva. */
  description: string;
};

export const ROLES: RoleDef[] = [
  {
    role: ParticipationRole.CONTENT_CREATOR,
    label: "Kreator medijskog sadržaja",
    description:
      "Pravim sadržaj na zadate teme — postove, video snimke i reelsove.",
  },
  {
    role: ParticipationRole.CONTENT_SHARER,
    label: "Prenosilac medijskog sadržaja",
    description:
      "Delim postove kampanje i pravim sopstvene objave na zadate teme.",
  },
  {
    role: ParticipationRole.MEDIA_OWNER,
    label: "Vlasnik društvenih medija i stranica",
    description:
      "Imam Facebook i Instagram stranice ili profile većeg dometa i spreman/na sam da preko njih delim i kreiram sadržaj.",
  },
  {
    role: ParticipationRole.WORD_OF_MOUTH,
    label: "Učesnik u usmenoj kampanji",
    description:
      "Razgovaram sa bliskim ljudima o temama kampanje, uz smernice kako da se priča.",
  },
];

export function getRoleLabel(role: ParticipationRole): string {
  return ROLES.find((r) => r.role === role)?.label ?? "—";
}
