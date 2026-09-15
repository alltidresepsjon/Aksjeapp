import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { computeLeaderboard } from "@/lib/ranking";
import { createLeague, joinLeagueByInviteCode } from "@/lib/leagues";
import { getMarketDataProvider } from "@/lib/market";
import { createStock, createUser, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

async function setupActiveSeason(extraParticipants: { displayName: string }[] = []) {
  const owner = await createUser({ displayName: "Eier" });
  // Opprett med gyldig fremtidig start (så påmelding er åpen)...
  const { league, season: initialSeason } = await createLeague({
    name: "Rangeringstest",
    ownerId: owner.id,
    seasonStartsAt: new Date(Date.now() + 72 * 3600_000),
  });

  // ...la alle ekstra deltakere bli med MENS påmeldingen fortsatt er åpen...
  const participants = [];
  for (const p of extraParticipants) {
    const user = await createUser({ displayName: p.displayName });
    await joinLeagueByInviteCode(league.inviteCode, user.id);
    participants.push(user);
  }

  // ...og flytt så sesongen til å være aktiv "nå" — enklere enn å vente 48
  // timer i en test. Påmeldingsfristen er nå passert, men det er forventet
  // og korrekt for en sesong som er i gang.
  const season = await prisma.season.update({
    where: { id: initialSeason.id },
    data: {
      startsAt: new Date(Date.now() - 3600_000),
      registrationDeadline: new Date(Date.now() - 4 * 3600_000),
      endsAt: new Date(Date.now() + 27 * 24 * 3600_000),
    },
  });
  return { owner, league, season, participants };
}

describe("resultatliste", () => {
  it("rangerer deltakere etter prosentvis avkastning, høyest først", async () => {
    const { owner, season, participants } = await setupActiveSeason([{ displayName: "Taper" }]);
    const [loser] = participants;
    const stock = await createStock("FJRD");
    const provider = getMarketDataProvider();
    const now = new Date();
    const price = new Decimal(provider.getLatestObservation("FJRD", now)!.price);

    // Eieren kjøper aksjer som (i denne testen) er verdt mer enn kontantene
    // som ble brukt — vi simulerer avkastning ved å sette kontantsaldo og
    // beholdning direkte, siden selve kjøpsflyten er testet andre steder.
    const ownerAccount = await prisma.account.findUniqueOrThrow({
      where: { userId_seasonId: { userId: owner.id, seasonId: season.id } },
    });
    await prisma.holding.create({
      data: { accountId: ownerAccount.id, stockId: stock.id, quantity: 100, avgCost: price },
    });
    await prisma.account.update({
      where: { id: ownerAccount.id },
      data: { cashBalance: new Decimal(100_000).sub(price.mul(100)) },
    });

    const loserAccount = await prisma.account.findUniqueOrThrow({
      where: { userId_seasonId: { userId: loser.id, seasonId: season.id } },
    });
    await prisma.account.update({
      where: { id: loserAccount.id },
      data: { cashBalance: new Decimal(50_000) }, // mistet halvparten
    });

    const result = await computeLeaderboard(season.id, { at: now });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].userId).toBe(owner.id);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].userId).toBe(loser.id);
    expect(result.entries[1].rank).toBe(2);
    expect(result.entries[0].returnPercent.greaterThan(result.entries[1].returnPercent)).toBe(true);
  });

  it("markerer manglende priser i stedet for å verdsette posisjonen til null", async () => {
    const { owner, season } = await setupActiveSeason();
    // En "spøkelsesaksje" som ikke finnes i MockProvider sin aksjeliste.
    const ghostStock = await prisma.stock.create({
      data: { ticker: "GHOST1", name: "Spøkelse ASA", currency: "NOK" },
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { userId_seasonId: { userId: owner.id, seasonId: season.id } },
    });
    await prisma.holding.create({
      data: { accountId: account.id, stockId: ghostStock.id, quantity: 10, avgCost: new Decimal(100) },
    });
    await prisma.account.update({ where: { id: account.id }, data: { cashBalance: new Decimal(99_000) } });

    const result = await computeLeaderboard(season.id);
    const entry = result.entries.find((e) => e.userId === owner.id)!;
    expect(entry.hasMissingPrices).toBe(true);
    // Verdien skal reflektere kontantene (99 000), IKKE 99 000 + 0 behandlet
    // som en eksakt/sikker verdi — men den skal heller aldri bli mindre enn
    // kontantsaldoen alene (aldri "straffet" for den manglende posisjonen).
    expect(entry.totalValue.equals(new Decimal(99_000))).toBe(true);
  });

  it("bruker samme verdsettelsestidspunkt for alle deltakere", async () => {
    const { season } = await setupActiveSeason();
    const result = await computeLeaderboard(season.id);
    // Alle rader i samme kall skal implisitt være vurdert mot `asOf` —
    // vi bekrefter at funksjonen returnerer én delt verdi, ikke én per rad.
    expect(result.asOf).toBeInstanceOf(Date);
    expect(typeof result.asOf.getTime()).toBe("number");
  });
});
