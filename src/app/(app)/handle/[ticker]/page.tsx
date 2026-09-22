import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProviderForMode } from "@/lib/market";
import { samplePriceHistory } from "@/lib/market/history";
import { Decimal, formatCurrency, formatPercent } from "@/lib/money";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";

interface InstrumentPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: InstrumentPageProps) {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function InstrumentPage({ params }: InstrumentPageProps) {
  const { ticker: tickerRaw } = await params;
  const ticker = tickerRaw.toUpperCase();
  const session = await auth();
  if (!session?.user) return null;

  const provider = getProviderForMode("DEMO");
  const instrument = provider.listInstruments().find((i) => i.ticker === ticker);
  if (!instrument) notFound();

  const account = await prisma.account.findUnique({
    where: { userId_mode: { userId: session.user.id, mode: "DEMO" } },
  });
  if (!account) notFound();

  const position = await prisma.position.findFirst({
    where: { accountId: account.id, instrument: { ticker } },
  });

  const now = new Date();
  const latest = provider.getLatestObservation(ticker, now);
  const yesterday = provider.getLatestObservation(ticker, new Date(now.getTime() - 24 * 3600_000));
  const price = latest ? new Decimal(latest.price) : null;
  const prevPrice = yesterday ? new Decimal(yesterday.price) : null;
  const changePercent = price && prevPrice && !prevPrice.isZero() ? price.sub(prevPrice).div(prevPrice).mul(100) : null;

  const history = samplePriceHistory(provider, ticker, new Date(now.getTime() - 7 * 24 * 3600_000), now, 60);
  const marketOpen = provider.isMarketOpen(now);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {instrument.ticker} · {instrument.sector}
        </p>
        <h1 className="text-xl font-bold text-slate-900">{instrument.name}</h1>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900">{price ? formatCurrency(price) : "—"}</p>
          {changePercent && (
            <p className={`text-sm font-semibold ${changePercent.gte(0) ? "text-emerald-600" : "text-red-600"}`}>
              {formatPercent(changePercent)} (24t)
            </p>
          )}
        </div>
        {latest && (
          <p className="mt-0.5 text-xs text-slate-400">
            Kurs per{" "}
            {latest.observedAt.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ·
            syntetisk demodata
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <PriceChart points={history} />
        <p className="mt-2 text-center text-xs text-slate-400">Siste 7 dager (simulert)</p>
      </div>

      <TradePanel
        accountId={account.id}
        ticker={ticker}
        currentPrice={price?.toString() ?? null}
        cashBalance={account.cashBalance.toString()}
        ownedQuantity={position?.quantity ?? 0}
        marketOpen={marketOpen}
      />
    </div>
  );
}
