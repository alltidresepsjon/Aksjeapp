import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { KillSwitchToggle } from "@/components/kill-switch-toggle";
import { isTradingPaused } from "@/lib/kill-switch";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) return null;

  const paused = await isTradingPaused();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">Profil</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Navn</p>
        <p className="font-semibold text-slate-900">{session.user.name}</p>
        <p className="mt-3 text-xs text-slate-500">E-post</p>
        <p className="font-medium text-slate-900">{session.user.email}</p>
      </div>

      <KillSwitchToggle initialPaused={paused} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Om denne plattformen</p>
        <p className="mt-1">
          Dette er en privat plattform for å undersøke om AI kan gi meravkastning etter realistiske kostnader —
          med kontrollert risiko og ingen løfter om avkastning. Alle penger er fiktive (paper trading). DEMO-kontoen
          bruker syntetiske data; PAPER-kontoen venter på en ekte, avklart markedsdatakilde. Ingen ekte handel med
          ekte penger finnes i denne versjonen.
        </p>
      </div>

      <SignOutButton className="rounded-xl border border-red-200 bg-white p-4 text-center text-sm font-semibold text-red-600 hover:bg-red-50" />
    </div>
  );
}
