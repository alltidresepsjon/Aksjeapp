import Link from "next/link";
import { auth } from "@/auth";
import { listUserAccounts } from "@/lib/accounts";
import { formatCurrency, formatPercent } from "@/lib/money";
import { env } from "@/lib/env";

export const metadata = { title: "Oversikt" };

const MODE_LABELS: Record<string, string> = {
  DEMO: "DEMO — syntetiske data",
  PAPER: "PAPER — simulert handel med ekte data",
  LIVE_READONLY: "LIVE (kun lesing)",
};

export default async function OversiktPage() {
  const session = await auth();
  if (!session?.user) return null;

  const summaries = await listUserAccounts(session.user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hei, {session.user.name}</h1>
        <p className="text-sm text-slate-500">Ingen løfter om avkastning. Alle beløp er fiktive.</p>
      </div>

      <div className="flex flex-col gap-3">
        {summaries.map((s) => (
          <div key={s.account.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {MODE_LABELS[s.account.mode] ?? s.account.mode}
              </p>
              {s.account.mode === "DEMO" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  DEMO
                </span>
              )}
            </div>

            {!s.supported ? (
              <p className="mt-2 text-sm text-slate-500">
                {"dataSourceMissing" in s && s.dataSourceMissing
                  ? "Ekte markedsdata er ikke koblet til ennå. Denne kontoen kan ikke brukes før en datakilde er avklart og testet (se docs/dataleverandorer.md)."
                  : "Ikke støttet i denne versjonen."}
              </p>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(s.totalValue)}</p>
                <p
                  className={`text-sm font-medium ${
                    s.sinceInceptionPercent.gte(0) ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatPercent(s.sinceInceptionPercent)} siden start
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
                  <div>
                    <p className="text-slate-400">Siste dag</p>
                    <p className="font-medium text-slate-700">
                      {s.lastDayPercent ? formatPercent(s.lastDayPercent) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Siste uke</p>
                    <p className="font-medium text-slate-700">
                      {s.lastWeekPercent ? formatPercent(s.lastWeekPercent) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Siste måned</p>
                    <p className="font-medium text-slate-700">
                      {s.lastMonthPercent ? formatPercent(s.lastMonthPercent) : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Største fall fra topp: {formatPercent(s.maxDrawdownPercent)}</span>
                  <span>{s.positionCount} posisjon(er)</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>Kontanter: {formatCurrency(s.cashBalance)}</span>
                  <span>Eksponering: {formatCurrency(s.positionsValue)}</span>
                </div>

                {s.account.mode === "DEMO" && (
                  <Link
                    href="/kalender"
                    className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Se resultatkalender →
                  </Link>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Drifts- og datakostnader</p>
        <p className="mt-1">
          Budsjettgrense (ikke faktisk forbruk — forbrukssporing kommer i en senere etappe):
          AI {formatCurrency(env.MONTHLY_AI_BUDGET_NOK)}/mnd, data {formatCurrency(env.MONTHLY_DATA_BUDGET_NOK)}/mnd.
        </p>
        <p className="mt-2 font-semibold text-slate-700">Strategi</p>
        <p className="mt-1">Ingen AI-strategi er aktiv ennå — kommer i en senere etappe.</p>
      </div>
    </div>
  );
}
