import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeLeaderboard } from "@/lib/ranking";
import { getSeasonStatus, SEASON_STATUS_LABELS } from "@/lib/leagues";
import { formatNok, formatPercent } from "@/lib/money";

interface LigaPageProps {
  params: Promise<{ id: string }>;
}

export default async function LigaPage({ params }: LigaPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      seasons: { orderBy: { seasonNumber: "desc" } },
      memberships: true,
    },
  });
  if (!league) notFound();

  // Tilgangskontroll på serveren: kun medlemmer får se en privat liga.
  const isMember = league.memberships.some((m) => m.userId === session.user.id);
  if (!isMember) notFound();

  const currentSeason = league.seasons[0];
  const now = new Date();
  const status = currentSeason ? getSeasonStatus(currentSeason, now) : null;
  const leaderboard = currentSeason ? await computeLeaderboard(currentSeason.id, { at: now }) : null;
  const myAccount = currentSeason
    ? await prisma.account.findUnique({
        where: { userId_seasonId: { userId: session.user.id, seasonId: currentSeason.id } },
      })
    : null;
  const isOwner = league.ownerId === session.user.id;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{league.name}</h1>
        <p className="text-sm text-slate-500">
          Invitasjonskode: <span className="font-mono font-semibold">{league.inviteCode}</span>
        </p>
      </div>

      {currentSeason && status ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">Sesong {currentSeason.seasonNumber}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {SEASON_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {currentSeason.startsAt.toLocaleDateString("nb-NO")} –{" "}
            {currentSeason.endsAt.toLocaleDateString("nb-NO")}
          </p>
          {status === "REGISTRATION_OPEN" && (
            <p className="mt-2 text-xs text-amber-700">
              Påmelding åpen til {currentSeason.registrationDeadline.toLocaleString("nb-NO")}
            </p>
          )}
          {myAccount && (
            <Link
              href={`/konto/${myAccount.id}`}
              className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
            >
              Min portefølje i denne sesongen →
            </Link>
          )}
          {!myAccount && status === "REGISTRATION_OPEN" && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Du er medlem av ligaen, men ikke påmeldt denne sesongen ennå. Bli med via
              invitasjonskoden for å opprette en konto.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          Ingen sesong er planlagt ennå.
        </p>
      )}

      {leaderboard && leaderboard.entries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="font-semibold text-slate-900">Resultatliste</p>
            <p className="text-xs text-slate-400">
              Verdsatt {leaderboard.asOf.toLocaleString("nb-NO")} — samme tidspunkt for alle
            </p>
          </div>
          <ul className="divide-y divide-slate-200">
            {leaderboard.entries.map((entry) => (
              <li key={entry.accountId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-sm font-semibold text-slate-400">{entry.rank}</span>
                  <span className="font-medium text-slate-900">
                    {entry.displayName}
                    {entry.userId === session.user.id && " (deg)"}
                  </span>
                  {entry.hasMissingPrices && (
                    <span
                      className="text-xs text-amber-600"
                      title="Én eller flere kurser mangler — verdien er et minimumsanslag"
                    >
                      ⚠
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      entry.returnPercent.gte(0) ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatPercent(entry.returnPercent)}
                  </p>
                  <p className="text-xs text-slate-400">{formatNok(entry.totalValue)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (!currentSeason || status === "ACTIVE" || status === "COMPLETED") && (
        <Link
          href={`/ligaer/${league.id}/ny-sesong`}
          className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Start ny sesong
        </Link>
      )}
    </div>
  );
}
