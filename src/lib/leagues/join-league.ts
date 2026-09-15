import { prisma } from "@/lib/prisma";
import { NotFoundError, TradingError } from "@/lib/trading/errors";

export async function joinLeagueByInviteCode(inviteCode: string, userId: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();
  return prisma.$transaction(async (tx) => {
    const league = await tx.league.findUnique({
      where: { inviteCode: normalizedCode },
      include: { seasons: true },
    });
    if (!league) {
      throw new NotFoundError("Fant ingen liga med denne invitasjonskoden.");
    }

    const now = new Date();
    const openSeason = league.seasons
      .filter((s) => now < s.registrationDeadline)
      .sort((a, b) => a.registrationDeadline.getTime() - b.registrationDeadline.getTime())[0];

    if (!openSeason) {
      throw new TradingError(
        "Påmelding er stengt for denne ligaen akkurat nå.",
        "REGISTRATION_CLOSED"
      );
    }

    await tx.leagueMembership.upsert({
      where: { userId_leagueId: { userId, leagueId: league.id } },
      create: { userId, leagueId: league.id },
      update: {},
    });

    const existingAccount = await tx.account.findUnique({
      where: { userId_seasonId: { userId, seasonId: openSeason.id } },
    });
    if (existingAccount) {
      return { league, season: openSeason, account: existingAccount, alreadyJoined: true };
    }

    const account = await tx.account.create({
      data: { userId, seasonId: openSeason.id, cashBalance: openSeason.startingCash },
    });
    await tx.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        type: "INITIAL_DEPOSIT",
        amount: openSeason.startingCash,
        balanceAfter: openSeason.startingCash,
      },
    });

    return { league, season: openSeason, account, alreadyJoined: false };
  });
}
