import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSeasonStatus, SEASON_STATUS_LABELS } from "@/lib/leagues";

export const metadata = { title: "Ligaer" };

export default async function LigaerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: session.user.id },
    include: { league: { include: { seasons: { orderBy: { seasonNumber: "desc" }, take: 1 } } } },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">Ligaer</h1>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/ligaer/ny"
          className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-700 hover:border-emerald-300"
        >
          + Opprett liga
        </Link>
        <Link
          href="/ligaer/bli-med"
          className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-700 hover:border-emerald-300"
        >
          Bli med med kode
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {memberships.map((m) => {
          const latestSeason = m.league.seasons[0];
          const status = latestSeason ? getSeasonStatus(latestSeason) : null;
          return (
            <Link
              key={m.league.id}
              href={`/ligaer/${m.league.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-300"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{m.league.name}</p>
                {status && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {SEASON_STATUS_LABELS[status]}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Invitasjonskode: <span className="font-mono">{m.league.inviteCode}</span>
              </p>
            </Link>
          );
        })}
        {memberships.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Du er ikke med i noen ligaer ennå.
          </p>
        )}
      </div>
    </div>
  );
}
