import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMarketDataProvider } from "@/lib/market";
import { Decimal, formatNok, formatPercent } from "@/lib/money";

export const metadata = { title: "Marked" };

interface MarkedPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function MarkedPage({ searchParams }: MarkedPageProps) {
  const params = await searchParams;
  const qRaw = params?.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "").trim().toLowerCase();

  const provider = getMarketDataProvider();
  const now = new Date();
  const stocks = await prisma.stock.findMany({ orderBy: { ticker: "asc" } });

  const rows = stocks
    .filter((s) => !q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .map((stock) => {
      const latest = provider.getLatestObservation(stock.ticker, now);
      const yesterday = provider.getLatestObservation(
        stock.ticker,
        new Date(now.getTime() - 24 * 3600_000)
      );
      const price = latest ? new Decimal(latest.price) : null;
      const prevPrice = yesterday ? new Decimal(yesterday.price) : null;
      const changePercent =
        price && prevPrice && !prevPrice.isZero()
          ? price.sub(prevPrice).div(prevPrice).mul(100)
          : null;
      return { stock, price, changePercent, observedAt: latest?.observedAt ?? null };
    });

  const marketOpen = provider.isMarketOpen(now);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Marked</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {stocks.length} aksjer, samme valuta (NOK) ·{" "}
          {marketOpen ? (
            <span className="text-emerald-600">Markedet er åpent</span>
          ) : (
            <span className="text-slate-400">Markedet er stengt</span>
          )}
        </p>
      </div>

      <form action="/marked" className="flex">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Søk etter ticker eller selskapsnavn…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </form>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.map(({ stock, price, changePercent, observedAt }) => (
          <li key={stock.id}>
            <Link
              href={`/marked/${stock.ticker}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{stock.ticker}</p>
                <p className="truncate text-xs text-slate-500">{stock.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-slate-900">{price ? formatNok(price) : "—"}</p>
                {changePercent && (
                  <p
                    className={`text-xs font-medium ${
                      changePercent.gte(0) ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
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
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-slate-400">
            Ingen treff på &laquo;{q}&raquo;.
          </li>
        )}
      </ul>
    </div>
  );
}
