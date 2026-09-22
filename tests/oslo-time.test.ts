import { describe, expect, it } from "vitest";
import {
  osloDateTimeToUtc,
  tradingDayCloseInstant,
  isWeekday,
  previousPureDate,
  todayOsloPureDate,
} from "@/lib/accounting/oslo-time";

describe("Europe/Oslo tidssone-håndtering", () => {
  it("bruker UTC+2 om sommeren (sommertid)", () => {
    // 11. juni 2025, kl 12:00 Oslo-tid, skal være 10:00 UTC (UTC+2).
    const utc = osloDateTimeToUtc(2025, 6, 11, 12, 0);
    expect(utc.toISOString()).toBe("2025-06-11T10:00:00.000Z");
  });

  it("bruker UTC+1 om vinteren (normaltid)", () => {
    // 11. januar 2025, kl 12:00 Oslo-tid, skal være 11:00 UTC (UTC+1).
    const utc = osloDateTimeToUtc(2025, 1, 11, 12, 0);
    expect(utc.toISOString()).toBe("2025-01-11T11:00:00.000Z");
  });

  it("beregner riktig stengetidspunkt (16:30 Oslo-tid) for en handelsdag", () => {
    const tradingDate = new Date(Date.UTC(2025, 5, 11)); // 11. juni 2025 (onsdag, sommertid)
    const close = tradingDayCloseInstant(tradingDate);
    expect(close.toISOString()).toBe("2025-06-11T14:30:00.000Z"); // 16:30 UTC+2
  });

  it("gjenkjenner helg korrekt", () => {
    expect(isWeekday(new Date(Date.UTC(2025, 5, 14)))).toBe(false); // lørdag
    expect(isWeekday(new Date(Date.UTC(2025, 5, 15)))).toBe(false); // søndag
    expect(isWeekday(new Date(Date.UTC(2025, 5, 13)))).toBe(true); // fredag
  });

  it("previousPureDate går nøyaktig én dag tilbake, også over månedsskifte", () => {
    const date = new Date(Date.UTC(2025, 6, 1)); // 1. juli
    const prev = previousPureDate(date);
    expect(prev.toISOString().slice(0, 10)).toBe("2025-06-30");
  });

  it("todayOsloPureDate returnerer en gyldig ren dato", () => {
    const today = todayOsloPureDate(new Date());
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
  });
});
