import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { env } from "@/lib/env";

/**
 * Henter brukerens øvingskonto, eller oppretter den hvis den ikke finnes.
 * Øvingskontoen er alltid adskilt fra konkurransekontoer (seasonId = null)
 * og nullstilles aldri automatisk.
 */
export async function ensurePracticeAccount(userId: string) {
  const existing = await prisma.account.findFirst({ where: { userId, seasonId: null } });
  if (existing) return existing;

  const startingCash = new Decimal(env.STARTING_CASH_NOK);
  try {
    return await prisma.$transaction(async (tx) => {
      const stillMissing = await tx.account.findFirst({ where: { userId, seasonId: null } });
      if (stillMissing) return stillMissing;
      const account = await tx.account.create({
        data: { userId, seasonId: null, cashBalance: startingCash },
      });
      await tx.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          type: "INITIAL_DEPOSIT",
          amount: startingCash,
          balanceAfter: startingCash,
        },
      });
      return account;
    });
  } catch (error) {
    // Partial unique-indeksen (én øvingskonto per bruker) kan slå til ved en
    // reell samtidig dobbeltoppretting — hent den vinnende raden i så fall.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.account.findFirst({ where: { userId, seasonId: null } });
      if (winner) return winner;
    }
    throw error;
  }
}
