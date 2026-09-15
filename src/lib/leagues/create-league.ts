import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/trading/errors";
import { generateInviteCode } from "./invite-code";
import {
  MIN_SEASON_LEAD_HOURS,
  REGISTRATION_LEAD_HOURS,
  SEASON_LENGTH_DAYS,
} from "./season-status";

export interface CreateLeagueInput {
  name: string;
  ownerId: string;
  seasonStartsAt: Date;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600_000);
}
function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}

export async function createLeague(input: CreateLeagueInput) {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 60) {
    throw new ValidationError("Liganavn må være mellom 3 og 60 tegn.");
  }
  const now = new Date();
  if (input.seasonStartsAt.getTime() < addHours(now, MIN_SEASON_LEAD_HOURS).getTime()) {
    throw new ValidationError(
      `Sesongstart må være minst ${MIN_SEASON_LEAD_HOURS} timer frem i tid, slik at det finnes et reelt påmeldingsvindu.`
    );
  }

  const startingCash = new Decimal(env.STARTING_CASH_NOK);
  const startsAt = input.seasonStartsAt;
  const endsAt = addDays(startsAt, SEASON_LENGTH_DAYS);
  const registrationDeadline = addHours(startsAt, -REGISTRATION_LEAD_HOURS);

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      return await prisma.$transaction(async (tx) => {
        const league = await tx.league.create({
          data: { name, ownerId: input.ownerId, inviteCode },
        });
        const season = await tx.season.create({
          data: {
            leagueId: league.id,
            seasonNumber: 1,
            startsAt,
            endsAt,
            registrationDeadline,
            startingCash,
          },
        });
        await tx.leagueMembership.create({
          data: { userId: input.ownerId, leagueId: league.id },
        });
        const account = await tx.account.create({
          data: { userId: input.ownerId, seasonId: season.id, cashBalance: startingCash },
        });
        await tx.cashLedgerEntry.create({
          data: {
            accountId: account.id,
            type: "INITIAL_DEPOSIT",
            amount: startingCash,
            balanceAfter: startingCash,
          },
        });
        return { league, season, account };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 4
      ) {
        continue; // sjelden invitasjonskode-kollisjon — prøv en ny kode
      }
      throw error;
    }
  }
  throw new Error("Klarte ikke å generere en unik invitasjonskode. Prøv igjen.");
}
