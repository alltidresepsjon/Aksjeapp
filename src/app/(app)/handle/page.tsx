import Link from "next/link";
import { getProviderForMode } from "@/lib/market";
import { Decimal, formatCurrency, formatPercent } from "@/lib/money";

export const metadata = { title: "Handle" };

export default async function HandlePage() {
  const provider = getProviderForMode("DEMO");
  const now = new Date();
  const instruments = provider.listInstruments();

  const rows = instruments.map((instrument) => {
    const latest = provider.getLatestObservation(instrument.ticker, now);
    const yesterday = provider.getLatestObservation(instrument.ticker, new Date(now.getTime() - 24 * 3600_000));
    const price = latest ? new Decimal(latest.price) : null;
    const prevPrice = yesterday ? new Decimal(yesterday.price) : null;
    const changePercent =
      price && prevPrice && !prevPrice.isZero() ? price.sub(prevPrice).div(prevPrice).mul(100) : null;
    return { instrument, price, changePercent, observedAt: latest?.observedAt ?? null };
  });

  const marketOpen = provider.isMarketOpen(now);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Handle (DEMO)</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {instruments.length} syntetiske instrumenter ·{" "}
          {marketOpen ? <span className="text-emerald-600">Markedet er åpent</span> : <span className="text-slate-400">Markedet er stengt</span>}
        </p>
      </div>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.map(({ instrument, price, changePercent, observedAt }) => (
          <li key={instrument.ticker}>
            <Link
              href={`/handle/${instrument.ticker}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{instrument.ticker}</p>
                <p className="truncate text-xs text-slate-500">
                  {instrument.name} · {instrument.sector}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-slate-900">{price ? formatCurrency(price) : "—"}</p>
                {changePercent && (
                  <p className={`text-xs font-medium ${changePercent.gte(0) ? "text-emerald-600" : "text-red-600"}`}>
                    {formatPercent(changePercent)}
                  </p>
                )}
                {observedAt && (
                  <p className="text-[10px] text-slate-400">
                    {observedAt.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
