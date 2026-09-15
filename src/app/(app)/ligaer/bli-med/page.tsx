import { JoinLeagueForm } from "@/components/leagues/join-league-form";

export const metadata = { title: "Bli med i liga" };

export default function BliMedPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Bli med i liga</h1>
        <p className="mt-1 text-sm text-slate-500">
          Skriv inn invitasjonskoden du fikk av ligaeieren. Du kan bare bli med mens påmelding er
          åpen for gjeldende sesong.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <JoinLeagueForm />
      </div>
    </div>
  );
}
