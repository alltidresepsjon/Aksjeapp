import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Decimal, formatCurrency, formatPercent } from "@/lib/money";

interface DayPageProps {
  params: Promise<{ dato: string }>;
}

export default async function DagPage({ params }: DayPageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const { dato } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) notFound();
  const tradingDate = new Date(`${dato}T00:00:00.000Z`);
  if (Number.isNaN(tradingDate.getTime())) notFound();

  const account = await prisma.account.findUnique({
    where: { userId_mode: { userId: session.user.id, mode: "DEMO" } },
  });
  if (!account) notFound();

  const snapshot = await prisma.dailySnapshot.findUnique({
    where: { accountId_tradingDate: { accountId: account.id, tradingDate } },
  });
  if (!snapshot) notFound();

  const [accumulatedAgg, trades] = await Promise.all([
    prisma.dailySnapshot.aggregate({
      where: { accountId: account.id, tradingDate: { lte: tradingDate } },
      _sum: { dayResult: true },
    }),
    prisma.order.findMany({
      where: { accountId: account.id, status: "FILLED", filledAt: { gte: tradingDate, lt: new Date(tradingDate.getTime() + 24 * 3600_000) } },
      include: { instrument: true },
      orderBy: { filledAt: "asc" },
    }),
  ]);

  const accumulatedResult = accumulatedAgg._sum.dayResult ?? new Decimal(0);
  const accumulatedPercent = account.startingCapital.isZero()
    ? null
    : accumulatedResult.div(account.startingCapital).mul(100);

  const benchmarkChangePercent =
    snapshot.benchmarkStartValue && snapshot.benchmarkEndValue && !snapshot.benchmarkStartValue.isZero()
      ? snapshot.benchmarkEndValue.sub(snapshot.benchmarkStartValue).div(snapshot.benchmarkStartValue).mul(100)
      : null;

  const dayResultPercent = snapshot.startValue.isZero() ? null : snapshot.dayResult.div(snapshot.startValue).mul(100);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/kalender" className="text-sm text-slate-500 hover:underline">
        ← Tilbake til kalenderen
      </Link>

      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {tradingDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </h1>
        {snapshot.marketClosed && <p className="text-sm text-slate-500">Markedet var stengt denne dagen.</p>}
        {snapshot.dataIncomplete && (
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ Prisdata manglet for én eller flere posisjoner denne dagen — tallene under er et minimumsanslag, ikke
            eksakte.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Startverdi</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.startValue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Sluttverdi</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.endValue)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
          <span className="text-slate-500">Dagsresultat</span>
          <span className={`font-semibold ${snapshot.dayResult.gte(0) ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(snapshot.dayResult)}
            {dayResultPercent && ` (${formatPercent(dayResultPercent)})`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Akkumulert resultat</span>
          <span className={`font-medium ${accumulatedResult.gte(0) ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(accumulatedResult)}
            {accumulatedPercent && ` (${formatPercent(accumulatedPercent)})`}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sammensetning</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Realisert bidrag (brutto)</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.realizedPnl)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Urealisert bidrag</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.unrealizedPnlChange)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Kostnader (kurtasje + slippage)</span>
          <span className="font-medium text-slate-900">
            {snapshot.costs.isZero() ? "" : "-"}
            {formatCurrency(snapshot.costs)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Valutabidrag</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.fxImpact)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Innskudd/uttak denne dagen</span>
          <span className="font-medium text-slate-900">{formatCurrency(snapshot.netDeposits)}</span>
        </div>
      </div>

      {benchmarkChangePercent && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sammenlignet med referanseindeks
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Referanseindeks denne dagen</span>
            <span className="font-medium text-slate-900">{formatPercent(benchmarkChangePercent)}</span>
          </div>
          {dayResultPercent && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Meravkastning (mot indeks)</span>
              <span
                className={`font-medium ${
                  dayResultPercent.sub(benchmarkChangePercent).gte(0) ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatPercent(dayResultPercent.sub(benchmarkChangePercent))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Handler denne dagen ({trades.length})
        </p>
        {trades.length === 0 ? (
          <p className="text-sm text-slate-400">Ingen handler.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {trades.map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <span>
                  {t.side === "BUY" ? "Kjøp" : "Salg"} {t.quantity} {t.instrument.ticker}
                </span>
                <span className="text-slate-500">{t.fillPrice ? formatCurrency(t.fillPrice) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        <p className="font-semibold text-slate-600">Beslutningsgrunnlag og kilder</p>
        <p className="mt-1">
          Ingen AI-drevne beslutninger er lagret ennå — dette er en manuell DEMO-handel. Beslutningsjournal og
          automatiske forklaringer kommer i en senere etappe.
        </p>
      </div>
    </div>
  );
}
