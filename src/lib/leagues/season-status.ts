export type SeasonStatus = "REGISTRATION_OPEN" | "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface SeasonLike {
  registrationDeadline: Date;
  startsAt: Date;
  endsAt: Date;
}

export function getSeasonStatus(season: SeasonLike, now: Date = new Date()): SeasonStatus {
  if (now < season.registrationDeadline) return "REGISTRATION_OPEN";
  if (now < season.startsAt) return "UPCOMING";
  if (now < season.endsAt) return "ACTIVE";
  return "COMPLETED";
}

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  REGISTRATION_OPEN: "Påmelding åpen",
  UPCOMING: "Venter på start",
  ACTIVE: "Aktiv",
  COMPLETED: "Avsluttet",
};

export const SEASON_LENGTH_DAYS = 28;
export const REGISTRATION_LEAD_HOURS = 24;
// Minste tid fra nå til sesongstart når en sesong opprettes, slik at det
// alltid finnes et reelt påmeldingsvindu før sesongen starter.
export const MIN_SEASON_LEAD_HOURS = REGISTRATION_LEAD_HOURS + 24;

// Frittstående toppnivåfunksjon (ikke inline i en komponent) som beregner
// tidligste tillatte sesongstart som en yyyy-mm-dd-streng for <input type="date">.
export function minSeasonStartDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + MIN_SEASON_LEAD_HOURS * 3600_000).toISOString().slice(0, 10);
}
