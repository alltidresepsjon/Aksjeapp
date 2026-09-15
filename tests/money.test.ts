import { describe, expect, it } from "vitest";
import { Decimal, calculateBrokerageFee } from "@/lib/money";

describe("calculateBrokerageFee", () => {
  it("kombinerer flat avgift og prosentandel av handelsverdien", () => {
    // Testmiljøet setter BROKERAGE_FLAT_FEE_NOK=39, BROKERAGE_PERCENT_FEE=0.001
    const fee = calculateBrokerageFee(new Decimal(10_000));
    expect(fee.equals(new Decimal(49))).toBe(true); // 39 + 10000*0.001
  });

  it("runder til 2 desimaler", () => {
    const fee = calculateBrokerageFee(new Decimal(333));
    // 39 + 333*0.001 = 39.333 -> avrundet til 39.33
    expect(fee.equals(new Decimal("39.33"))).toBe(true);
  });
});
