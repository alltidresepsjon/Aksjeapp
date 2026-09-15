"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface TradeAccountOption {
  id: string;
  label: string;
  cashBalance: string;
  ownedQuantity: number;
  tradable: boolean;
  notTradableReason?: string;
}

interface OrderResult {
  status: "FILLED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "PENDING";
  fillPrice: string | null;
  feeAmount: string | null;
  totalAmount: string | null;
  rejectionReason: string | null;
  quantity: number;
  side: "BUY" | "SELL";
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function formatNokString(value: string) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function TradePanel({
  ticker,
  currentPrice,
  accounts,
  defaultAccountId,
  marketOpen,
}: {
  ticker: string;
  currentPrice: string | null;
  accounts: TradeAccountOption[];
  defaultAccountId: string | undefined;
  marketOpen: boolean;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const estimatedCost = useMemo(() => {
    if (!currentPrice) return null;
    return (Number(currentPrice) * quantity).toFixed(2);
  }, [currentPrice, quantity]);

  const canSubmit =
    !submitting &&
    marketOpen &&
    !!account?.tradable &&
    quantity > 0 &&
    (side === "BUY" || (account && quantity <= account.ownedQuantity));

  async function submitOrder() {
    if (!account) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const idempotencyKey = generateIdempotencyKey();

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          ticker,
          side,
          quantity,
          idempotencyKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Ordren kunne ikke utføres.");
        return;
      }
      setResult(data.order);
      router.refresh();
    } catch {
      setError("Nettverksfeil. Sjekk tilkoblingen og prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setResult(null);
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              side === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {s === "BUY" ? "Kjøp" : "Selg"}
          </button>
        ))}
      </div>

      {accounts.length > 1 && (
        <div className="mb-3 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="konto">
            Konto
          </label>
          <select
            id="konto"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.tradable}>
                {a.label}
                {!a.tradable && a.notTradableReason ? ` (${a.notTradableReason})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700" htmlFor="antall">
          Antall aksjer
        </label>
        <input
          id="antall"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
        />
        {account && (
          <p className="text-xs text-slate-400">
            {side === "SELL"
              ? `Du eier ${account.ownedQuantity} aksjer på denne kontoen.`
              : `Kontantsaldo: ${formatNokString(account.cashBalance)}`}
          </p>
        )}
      </div>

      {estimatedCost && (
        <p className="mb-3 text-sm text-slate-600">
          Anslått {side === "BUY" ? "kostnad" : "salgssum"} før kurtasje:{" "}
          <span className="font-medium">{formatNokString(estimatedCost)}</span>
        </p>
      )}

      {!marketOpen && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Markedet er stengt akkurat nå. Ordre kan ikke legges inn.
        </p>
      )}
      {account && !account.tradable && account.notTradableReason && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {account.notTradableReason}
        </p>
      )}
      {side === "SELL" && account && quantity > account.ownedQuantity && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Du kan ikke selge flere aksjer enn du eier.
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submitOrder}
        className={`w-full rounded-lg px-4 py-2.5 font-semibold text-white transition disabled:opacity-50 ${
          side === "BUY" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {submitting
          ? "Utfører ordre — venter på neste kursobservasjon…"
          : side === "BUY"
            ? `Kjøp ${quantity} ${ticker}`
            : `Selg ${quantity} ${ticker}`}
      </button>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`mt-3 rounded-lg px-3 py-3 text-sm ${
            result.status === "FILLED"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {result.status === "FILLED" ? (
            <>
              <p className="font-semibold">
                Ordre utført: {result.side === "BUY" ? "kjøpte" : "solgte"} {result.quantity}{" "}
                {ticker} @ {result.fillPrice ? formatNokString(result.fillPrice) : "—"}
              </p>
              <p className="mt-1 text-xs">
                Kurtasje: {result.feeAmount ? formatNokString(result.feeAmount) : "—"} · Totalt:{" "}
                {result.totalAmount ? formatNokString(result.totalAmount) : "—"}
              </p>
            </>
          ) : (
            <p className="font-semibold">
              Ordre {result.status === "REJECTED" ? "avvist" : "utløpt"}
              {result.rejectionReason ? `: ${result.rejectionReason}` : "."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
