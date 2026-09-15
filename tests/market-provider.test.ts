import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/market/mock-provider";

const config = {
  seed: "unit-test-seed",
  tickIntervalMs: 1000,
  latencyMs: 50,
  openHour: 9,
  closeHour: 17,
};

describe("MockProvider", () => {
  it("er deterministisk: samme seed/ticker/tidspunkt gir alltid samme pris", () => {
    const providerA = createMockProvider(config);
    const providerB = createMockProvider(config);
    const at = new Date("2025-06-11T10:00:00Z");

    const obsA = providerA.getLatestObservation("FJRD", at);
    const obsB = providerB.getLatestObservation("FJRD", at);
    expect(obsA?.price).toBe(obsB?.price);
    expect(obsA?.observedAt.getTime()).toBe(obsB?.observedAt.getTime());
  });

  it("gir en annen pris for en annen seed", () => {
    const providerA = createMockProvider(config);
    const providerB = createMockProvider({ ...config, seed: "annen-seed" });
    const at = new Date("2025-06-11T10:00:00Z");

    const obsA = providerA.getLatestObservation("FJRD", at);
    const obsB = providerB.getLatestObservation("FJRD", at);
    expect(obsA?.price).not.toBe(obsB?.price);
  });

  it("getNextObservationAfter returnerer alltid en observasjon med observedAt STRIKT etter `after`", () => {
    const provider = createMockProvider(config);
    const after = new Date("2025-06-11T10:00:00.123Z");
    const { observation, availableAt } = provider.getNextObservationAfter("FJRD", after);

    expect(observation.observedAt.getTime()).toBeGreaterThan(after.getTime());
    expect(availableAt.getTime()).toBe(observation.observedAt.getTime() + config.latencyMs);
  });

  it("skiller markedsdatatidspunkt (observedAt) fra mottakstidspunkt (receivedAt)", () => {
    const provider = createMockProvider(config);
    const at = new Date("2025-06-11T10:00:00Z");
    const observation = provider.getLatestObservation("FJRD", at)!;
    expect(observation.receivedAt.getTime()).toBe(observation.observedAt.getTime() + config.latencyMs);
  });

  it("markedet er stengt i helger uansett klokkeslett", () => {
    const provider = createMockProvider(config);
    const saturday = new Date("2025-06-14T12:00:00Z"); // lørdag, midt på dagen
    expect(provider.isMarketOpen(saturday)).toBe(false);
  });

  it("markedet er åpent på hverdager innenfor åpningstidene", () => {
    const provider = createMockProvider(config);
    const wednesdayNoon = new Date("2025-06-11T11:00:00Z"); // ca. kl 13 i Oslo (sommertid)
    expect(provider.isMarketOpen(wednesdayNoon)).toBe(true);
  });

  it("markedet er stengt utenfor åpningstidene på en hverdag", () => {
    const provider = createMockProvider(config);
    const wednesdayNight = new Date("2025-06-11T22:00:00Z");
    expect(provider.isMarketOpen(wednesdayNight)).toBe(false);
  });
});
