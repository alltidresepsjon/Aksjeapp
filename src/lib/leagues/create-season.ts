import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/trading/errors";
import { MIN_SEASON_LEAD_HOURS, SEASON_LENGTH_DAYS, REGISTRATION_LEAD_HOURS } from "./season-status";

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600_000);
}
function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}

/**
 * Ligaeieren starter en ny sesong (f.eks. etter at forrige er avsluttet).
 * Alle eksisterende medlemmer må aktivt melde seg på den nye sesongen via
 * invitasjonskoden — kontoer/kapital overføres aldri automatisk mellom
 * sesonger.
 */
export async function createNewSeason(leagueId: string, ownerId: string, seasonStartsAt: Date) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { seasons: { orderBy: { seasonNumber: "desc" }, take: 1 } },
  });
  if (!league) throw new NotFoundError("Fant ikke ligaen.");
  if (league.ownerId !== ownerId) throw new ForbiddenError("Kun ligaeieren kan opprette nye sesonger.");

  const now = new Date();
  if (seasonStartsAt.getTime() < addHours(now, MIN_SEASON_LEAD_HOURS).getTime()) {
    throw new ValidationError(
      `Sesongstart må være minst ${MIN_SEASON_LEAD_HOURS} timer frem i tid.`
    );
  }

  const nextSeasonNumber = (league.seasons[0]?.seasonNumber ?? 0) + 1;
  const startsAt = seasonStartsAt;
  const endsAt = addDays(startsAt, SEASON_LENGTH_DAYS);
  const registrationDeadline = addHours(startsAt, -REGISTRATION_LEAD_HOURS);

  return prisma.season.create({
    data: {
      leagueId,
      seasonNumber: nextSeasonNumber,
      startsAt,
      endsAt,
      registrationDeadline,
      startingCash: new Decimal(env.STARTING_CASH_NOK),
    },
  });
}
