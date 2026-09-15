import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

// Dokumentert, konfigurerbar simulert kurtasje: flat avgift + prosent av
// handelsverdi. Begge deler styres via miljøvariabler (se .env.example) slik
// at satsene kan endres uten kodeendring.
export function calculateBrokerageFee(tradeValue: Decimal): Decimal {
  const flat = new Decimal(env.BROKERAGE_FLAT_FEE_NOK);
  const percent = tradeValue.mul(new Decimal(env.BROKERAGE_PERCENT_FEE));
  return flat.add(percent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatNok(amount: Decimal | number | string): string {
  const value = amount instanceof Decimal ? amount : new Decimal(amount);
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
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
