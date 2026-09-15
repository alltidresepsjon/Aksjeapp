import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import { minSeasonStartDateString } from "@/lib/leagues";

export const metadata = { title: "Opprett liga" };

export default function NyLigaPage() {
  const minDate = minSeasonStartDateString();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Opprett liga</h1>
        <p className="mt-1 text-sm text-slate-500">
          Alle deltakere får 100 000 fiktive kroner og konkurrerer i en 4-ukers sesong med samme
          start og slutt for alle.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <CreateLeagueForm minDate={minDate} />
      </div>
    </div>
  );
}
