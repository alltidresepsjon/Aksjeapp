import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { minSeasonStartDateString } from "@/lib/leagues";
import { NewSeasonForm } from "@/components/leagues/new-season-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NySesongPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const league = await prisma.league.findUnique({ where: { id } });
  if (!league) notFound();
  if (league.ownerId !== session.user.id) notFound();

  const minDate = minSeasonStartDateString();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ny sesong — {league.name}</h1>
        <p className="mt-1 text-sm text-slate-500">4 uker, 100 000 fiktive kroner per deltaker.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <NewSeasonForm leagueId={league.id} minDate={minDate} />
      </div>
    </div>
  );
}
