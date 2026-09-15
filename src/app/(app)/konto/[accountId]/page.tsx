import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAccountDetail } from "@/lib/accounts";
import { formatNok, formatPercent } from "@/lib/money";
import { ForbiddenError, NotFoundError } from "@/lib/trading/errors";
import { SEASON_STATUS_LABELS } from "@/lib/leagues";

interface KontoPageProps {
  params: Promise<{ accountId: string }>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Venter",
  FILLED: "Utført",
  REJECTED: "Avvist",
  EXPIRED: "Utløpt",
  CANCELLED: "Kansellert",
};

export default async function KontoPage({ params }: KontoPageProps) {
  const { accountId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  let detail: Awaited<ReturnType<typeof getAccountDetail>>;
  try {
    detail = await getAccountDetail(accountId, session.user.id);
  } catch (error) {
    // Ikke lekk at en konto som tilhører noen andre finnes.
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }

  const {
    account,
    holdingsWithValue,
    holdingsValue,
    totalValue,
    startingCash,
    returnPercent,
    hasMissingPrices,
    seasonStatus,
  } = detail;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {account.season ? account.season.league.name : "Øvingskonto"}
        </h1>
        {seasonStatus && (
          <p className="text-sm text-slate-500">
            Sesong {account.season?.seasonNumber} · {SEASON_STATUS_LABELS[seasonStatus]}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Totalverdi</p>
        <p className="text-2xl font-bold text-slate-900">{formatNok(totalValue)}</p>
        <p
          className={`text-sm font-medium ${
            returnPercent.gte(0) ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {formatPercent(returnPercent)} siden start ({formatNok(startingCash)})
        </p>
        {hasMissingPrices && (
          <p className="mt-1 text-xs text-amber-700">
            ⚠ Én eller flere kurser mangler akkurat nå — totalverdien er et minimumsanslag.
          </p>
        )}
        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">Kontanter</span>
          <span className="font-medium text-slate-900">{formatNok(account.cashBalance)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Aksjeverdi</span>
          <span className="font-medium text-slate-900">{formatNok(holdingsValue)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Beholdninger</h2>
        {holdingsWithValue.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
            Ingen aksjer i porteføljen ennå.{" "}
            <Link href="/marked" className="font-medium text-emerald-700 hover:underline">
              Gå til markedet
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {holdingsWithValue.map(({ holding, price, marketValue, gainPercent }) => (
              <li key={holding.id}>
                <Link
                  href={`/marked/${holding.stock.ticker}?konto=${account.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{holding.stock.ticker}</p>
                    <p className="text-xs text-slate-500">
                      {holding.quantity} stk · snittkost {formatNok(holding.avgCost)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {marketValue ? formatNok(marketValue) : "—"}
                    </p>
                    {gainPercent && (
                      <p
                        className={`text-xs font-medium ${
                          gainPercent.gte(0) ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatPercent(gainPercent)}
                      </p>
                    )}
                    {!price && <p className="text-xs text-amber-600">Kurs mangler</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ordrehistorikk</h2>
        {account.orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
            Ingen ordre ennå.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {account.orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {order.side === "BUY" ? "Kjøp" : "Salg"} {order.quantity} {order.stock.ticker}
                  </p>
                  <p className="text-xs text-slate-400">{order.createdAt.toLocaleString("nb-NO")}</p>
                  {order.rejectionReason && (
                    <p className="text-xs text-amber-600">{order.rejectionReason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-600">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </p>
                  {order.fillPrice && (
                    <p className="text-xs text-slate-400">@ {formatNok(order.fillPrice)}</p>
                  )}
                  {order.feeAmount && (
                    <p className="text-[10px] text-slate-400">Kurtasje {formatNok(order.feeAmount)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
