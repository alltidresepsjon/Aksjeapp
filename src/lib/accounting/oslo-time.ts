// Tidssone-hjelpere uten ekstern avhengighet. All lagring skjer i UTC;
// dette laget konverterer til/fra Europe/Oslo for visning og
// børsåpningstider (håndterer sommertid automatisk via Intl).

export const MARKET_CLOSE_HOUR = 16;
export const MARKET_CLOSE_MINUTE = 30;

function osloOffsetMinutes(utcInstant: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    timeZoneName: "shortOffset",
  });
  const tzPart = fmt.formatToParts(utcInstant).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = /GMT([+-]\d+)/.exec(tzPart);
  const hours = match ? parseInt(match[1], 10) : 1;
  return hours * 60;
}

/**
 * Konverterer en kalenderdato + klokkeslett i Europe/Oslo til et UTC-tidspunkt.
 * Kjent forenkling: bruker ett offset-gjett basert på datoen selv, uten
 * iterasjon rundt sommertidsovergangen — kan i sjeldne tilfeller (selve
 * omstillingsdøgnet) avvike med opptil en time. Se docs/kjente-begrensninger.md.
 */
export function osloDateTimeToUtc(year: number, month1to12: number, day: number, hour: number, minute: number): Date {
  const guessUtc = new Date(Date.UTC(year, month1to12 - 1, day, hour, minute));
  const offsetMin = osloOffsetMinutes(guessUtc);
  return new Date(guessUtc.getTime() - offsetMin * 60_000);
}

/** Henter (år, måned, dag) for en `@db.Date`-verdi fra Prisma (UTC-midnatt). */
export function dateParts(pureDate: Date): { year: number; month: number; day: number } {
  return {
    year: pureDate.getUTCFullYear(),
    month: pureDate.getUTCMonth() + 1,
    day: pureDate.getUTCDate(),
  };
}

/** Handelsdagens (Europe/Oslo) stengetidspunkt som et UTC-tidspunkt. */
export function tradingDayCloseInstant(pureDate: Date): Date {
  const { year, month, day } = dateParts(pureDate);
  return osloDateTimeToUtc(year, month, day, MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE);
}

/** Dagen før, som en ren dato (UTC-midnatt, ingen klokkeslettdel). */
export function previousPureDate(pureDate: Date): Date {
  const d = new Date(pureDate.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function todayOsloPureDate(now: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }); // en-CA => YYYY-MM-DD
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isWeekday(pureDate: Date): boolean {
  const weekday = pureDate.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}
