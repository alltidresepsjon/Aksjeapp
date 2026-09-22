import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

// Dokumentert, konfigurerbar simulert kurtasje: flat avgift + prosent av
// handelsverdi. Se .env.example.
export function calculateBrokerageFee(tradeValue: Decimal): Decimal {
  const flat = new Decimal(env.BROKERAGE_FLAT_FEE);
  const percent = tradeValue.mul(new Decimal(env.BROKERAGE_PERCENT_FEE));
  return flat.add(percent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Simulert spread/slippage: kjøp fylles til en litt høyere pris, salg til
// en litt lavere pris enn den "rene" markedsprisen. Dokumentert forenkling
// — se docs/simulering.md.
export function applySlippage(price: Decimal, side: "BUY" | "SELL"): Decimal {
  const factor = new Decimal(env.SLIPPAGE_PERCENT);
  const adjustment = price.mul(factor);
  return side === "BUY" ? price.add(adjustment) : price.sub(adjustment);
}

export function formatCurrency(
  amount: Decimal | number | string,
  currency: string = env.BASE_CURRENCY
): string {
  const value = amount instanceof Decimal ? amount : new Decimal(amount);
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value.toNumber());
}

export function formatPercent(value: Decimal | number): string {
  const num = value instanceof Decimal ? value.toNumber() : value;
  return new Intl.NumberFormat("nb-NO", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(num / 100);
}
