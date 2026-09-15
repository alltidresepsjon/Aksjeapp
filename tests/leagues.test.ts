import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import {
  createLeague,
  joinLeagueByInviteCode,
  ensurePracticeAccount,
  createNewSeason,
} from "@/lib/leagues";
import { NotFoundError, ForbiddenError, TradingError, ValidationError } from "@/lib/trading/errors";
import { createUser, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("opprette liga", () => {
  it("krever at sesongstart er minst MIN_SEASON_LEAD_HOURS frem i tid", async () => {
    const owner = await createUser();
    await expect(
      createLeague({ name: "For tidlig", ownerId: owner.id, seasonStartsAt: new Date(Date.now() + 3600_000) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("oppretter liga, sesong og en konto med 100 000 kr til eieren", async () => {
    const owner = await createUser();
    const startsAt = new Date(Date.now() + 72 * 3600_000);
    const { league, season, account } = await createLeague({
      name: "Testligaen",
      ownerId: owner.id,
      seasonStartsAt: startsAt,
    });

    expect(league.inviteCode).toHaveLength(7);
    expect(season.seasonNumber).toBe(1);
    expect(account.cashBalance.equals(new Decimal(100_000))).toBe(true);

    // Registreringsfristen skal ligge før sesongstart.
    expect(season.registrationDeadline.getTime()).toBeLessThanOrEqual(season.startsAt.getTime());
    // Sesongen skal vare i 4 uker.
    const durationDays = (season.endsAt.getTime() - season.startsAt.getTime()) / (24 * 3600_000);
    expect(durationDays).toBe(28);

    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId: owner.id, leagueId: league.id } },
    });
    expect(membership).not.toBeNull();
  });
});

describe("bli med i liga", () => {
  it("oppretter en konto for brukeren når påmelding er åpen", async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const { league } = await createLeague({
      name: "Åpen liga",
      ownerId: owner.id,
      seasonStartsAt: new Date(Date.now() + 72 * 3600_000),
    });

    const { account, alreadyJoined } = await joinLeagueByInviteCode(league.inviteCode, joiner.id);
    expect(alreadyJoined).toBe(false);
    expect(account.cashBalance.equals(new Decimal(100_000))).toBe(true);

    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId: joiner.id, leagueId: league.id } },
    });
    expect(membership).not.toBeNull();
  });

  it("er idempotent — å bli med to ganger gir samme konto, ikke en ny", async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const { league } = await createLeague({
      name: "Dobbel",
      ownerId: owner.id,
      seasonStartsAt: new Date(Date.now() + 72 * 3600_000),
    });

    const first = await joinLeagueByInviteCode(league.inviteCode, joiner.id);
    const second = await joinLeagueByInviteCode(league.inviteCode, joiner.id);
    expect(second.alreadyJoined).toBe(true);
    expect(second.account.id).toBe(first.account.id);

    const accounts = await prisma.account.findMany({
      where: { userId: joiner.id, seasonId: first.season.id },
    });
    expect(accounts).toHaveLength(1);
  });

  it("kaster NotFoundError for en ukjent invitasjonskode", async () => {
    const user = await createUser();
    await expect(joinLeagueByInviteCode("FINNESIKKE", user.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("nekter påmelding etter at registreringsfristen er passert", async () => {
    const owner = await createUser();
    const joiner = await createUser();

    // Opprett sesongen direkte i databasen med en registreringsfrist som
    // allerede er passert, for å simulere at påmeldingsvinduet er stengt.
    const league = await prisma.league.create({
      data: { name: "Stengt", inviteCode: "CLOSED1", ownerId: owner.id },
    });
    await prisma.season.create({
      data: {
        leagueId: league.id,
        seasonNumber: 1,
        startsAt: new Date(Date.now() + 3600_000),
        endsAt: new Date(Date.now() + 29 * 24 * 3600_000),
        registrationDeadline: new Date(Date.now() - 3600_000),
        startingCash: 100_000,
      },
    });

    const result = joinLeagueByInviteCode(league.inviteCode, joiner.id);
    await expect(result).rejects.toBeInstanceOf(TradingError);
    await expect(result).rejects.toThrow(/stengt/i);
  });
});

describe("øvingskonto", () => {
  it("oppretter nøyaktig én øvingskonto selv ved samtidige kall", async () => {
    const user = await createUser();
    const [a, b] = await Promise.all([ensurePracticeAccount(user.id), ensurePracticeAccount(user.id)]);
    expect(a.id).toBe(b.id);

    const accounts = await prisma.account.findMany({ where: { userId: user.id, seasonId: null } });
    expect(accounts).toHaveLength(1);
  });
});

describe("ny sesong", () => {
  it("bare ligaeieren kan opprette en ny sesong", async () => {
    const owner = await createUser();
    const other = await createUser();
    const { league } = await createLeague({
      name: "Sesongtest",
      ownerId: owner.id,
      seasonStartsAt: new Date(Date.now() + 72 * 3600_000),
    });

    await expect(
      createNewSeason(league.id, other.id, new Date(Date.now() + 200 * 3600_000))
    ).rejects.toBeInstanceOf(ForbiddenError);

    const season2 = await createNewSeason(league.id, owner.id, new Date(Date.now() + 200 * 3600_000));
    expect(season2.seasonNumber).toBe(2);
  });
});
