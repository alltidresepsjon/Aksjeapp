import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMarketDataProvider } from "@/lib/market";
import { samplePriceHistory } from "@/lib/market/history";
import { listUserAccounts } from "@/lib/accounts";
import { Decimal, formatNok, formatPercent } from "@/lib/money";
import { PriceChart } from "@/components/price-chart";
import { TradePanel, type TradeAccountOption } from "@/components/trade-panel";

interface StockPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ konto?: string | string[] }>;
}

export async function generateMetadata({ params }: StockPageProps) {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function StockPage({ params, searchParams }: StockPageProps) {
  const [{ ticker: tickerRaw }, sp, session] = await Promise.all([params, searchParams, auth()]);
  const ticker = tickerRaw.toUpperCase();
  if (!session?.user) return null;

  const stock = await prisma.stock.findUnique({ where: { ticker } });
  if (!stock) notFound();

  const provider = getMarketDataProvider();
  const now = new Date();
  const latest = provider.getLatestObservation(ticker, now);
  const yesterday = provider.getLatestObservation(ticker, new Date(now.getTime() - 24 * 3600_000));
  const price = latest ? new Decimal(latest.price) : null;
  const prevPrice = yesterday ? new Decimal(yesterday.price) : null;
  const changePercent =
    price && prevPrice && !prevPrice.isZero()
      ? price.sub(prevPrice).div(prevPrice).mul(100)
      : null;

  const history = samplePriceHistory(
    provider,
    ticker,
    new Date(now.getTime() - 7 * 24 * 3600_000),
    now,
    60
  );

  const marketOpen = provider.isMarketOpen(now);
  const accountsInfo = await listUserAccounts(session.user.id);

  const kontoParam = sp?.konto;
  const requestedAccountId = Array.isArray(kontoParam) ? kontoParam[0] : kontoParam;

  const tradeAccounts: TradeAccountOption[] = accountsInfo.map((a) => {
    const holding = a.account.holdings.find((h) => h.stock.ticker === ticker);
    const label = a.isPractice
      ? "Øvingskonto"
      : `${a.league?.name ?? "Liga"} · sesong ${a.season?.seasonNumber ?? "?"}`;
    const tradable = a.isPractice || a.seasonStatus === "ACTIVE";
    const notTradableReason =
      !tradable && a.seasonStatus
        ? a.seasonStatus === "REGISTRATION_OPEN" || a.seasonStatus === "UPCOMING"
          ? "Sesongen har ikke startet"
          : "Sesongen er avsluttet"
        : undefined;
    return {
      id: a.account.id,
      label,
      cashBalance: a.account.cashBalance.toString(),
      ownedQuantity: holding?.quantity ?? 0,
      tradable,
      notTradableReason,
    };
  });

  const defaultAccountId =
    (requestedAccountId && tradeAccounts.some((a) => a.id === requestedAccountId)
      ? requestedAccountId
      : undefined) ??
    tradeAccounts.find((a) => a.tradable)?.id ??
    tradeAccounts[0]?.id;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-slate-500">{stock.ticker}</p>
        <h1 className="text-xl font-bold text-slate-900">{stock.name}</h1>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900">{price ? formatNok(price) : "—"}</p>
          {changePercent && (
            <p
              className={`text-sm font-semibold ${
                changePercent.gte(0) ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatPercent(changePercent)} (24t)
            </p>
          )}
        </div>
        {latest && (
          <p className="mt-0.5 text-xs text-slate-400">
            Kurs per{" "}
            {latest.observedAt.toLocaleString("nb-NO", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · demodata
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <PriceChart points={history} />
        <p className="mt-2 text-center text-xs text-slate-400">Siste 7 dager (simulert)</p>
      </div>

      {tradeAccounts.length > 0 ? (
        <TradePanel
          ticker={ticker}
          currentPrice={price?.toString() ?? null}
          accounts={tradeAccounts}
          defaultAccountId={defaultAccountId}
          marketOpen={marketOpen}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Fant ingen konto å handle fra.
        </p>
      )}
    </div>
  );
}
