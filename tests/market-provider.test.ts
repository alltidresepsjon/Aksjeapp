import { describe, expect, it } from "vitest";
import { createDemoProvider } from "@/lib/market/demo-provider";

describe("DemoProvider", () => {
  it("er deterministisk: samme seed/ticker/tidspunkt gir alltid samme pris", () => {
    const a = createDemoProvider("test-seed-A");
    const b = createDemoProvider("test-seed-A");
    const at = new Date("2025-06-11T10:00:00Z");
    const obsA = a.getLatestObservation("FJRD", at);
    const obsB = b.getLatestObservation("FJRD", at);
    expect(obsA?.price).toBe(obsB?.price);
    expect(obsA?.observedAt.getTime()).toBe(obsB?.observedAt.getTime());
  });

  it("gir en annen pris for en annen seed", () => {
    const a = createDemoProvider("seed-1");
    const b = createDemoProvider("seed-2");
    const at = new Date("2025-06-11T10:00:00Z");
    expect(a.getLatestObservation("FJRD", at)?.price).not.toBe(b.getLatestObservation("FJRD", at)?.price);
  });

  it("getNextObservationAfter returnerer alltid observedAt STRIKT etter `after`", () => {
    const provider = createDemoProvider("seed-x");
    const after = new Date("2025-06-11T10:00:00.123Z");
    const { observation, availableAt } = provider.getNextObservationAfter("FJRD", after);
    expect(observation.observedAt.getTime()).toBeGreaterThan(after.getTime());
    expect(availableAt.getTime()).toBeGreaterThan(observation.observedAt.getTime());
  });

  it("skiller markedsdatatidspunkt (observedAt) fra mottakstidspunkt (receivedAt)", () => {
    const provider = createDemoProvider("seed-x");
    const at = new Date("2025-06-11T10:00:00Z");
    const observation = provider.getLatestObservation("FJRD", at)!;
    expect(observation.receivedAt.getTime()).toBeGreaterThan(observation.observedAt.getTime());
  });

  it("markedet er stengt i helger uansett klokkeslett", () => {
    const provider = createDemoProvider("seed-x");
    const saturday = new Date("2025-06-14T12:00:00Z");
    expect(provider.isMarketOpen(saturday)).toBe(false);
  });

  it("markedet er åpent på hverdager innenfor åpningstidene", () => {
    const provider = createDemoProvider("seed-x");
    const wednesdayNoon = new Date("2025-06-11T11:00:00Z"); // ca. kl 13 i Oslo sommertid
    expect(provider.isMarketOpen(wednesdayNoon)).toBe(true);
  });

  it("markedet er stengt utenfor åpningstidene på en hverdag", () => {
    const provider = createDemoProvider("seed-x");
    const wednesdayNight = new Date("2025-06-11T22:00:00Z");
    expect(provider.isMarketOpen(wednesdayNight)).toBe(false);
  });

  it("returnerer en referanseindeksverdi som beveger seg med instrumentene", () => {
    const provider = createDemoProvider("seed-x");
    const t1 = new Date("2025-06-11T10:00:00Z");
    const t2 = new Date("2025-08-11T10:00:00Z");
    const b1 = provider.getLatestBenchmark(t1);
    const b2 = provider.getLatestBenchmark(t2);
    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b1!.value).not.toBe(b2!.value);
  });
});
