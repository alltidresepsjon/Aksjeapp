import { beforeEach, describe, expect, it } from "vitest";
import { placeOrder } from "@/lib/trading";
import { isTradingPaused, setTradingPaused } from "@/lib/kill-switch";
import { createDemoProvider } from "@/lib/market/demo-provider";
import { FIXED_NOW, createAccount, createInstrument, createUser, resetDb } from "./helpers";

const provider = createDemoProvider("kill-switch-test-seed");

beforeEach(async () => {
  await resetDb();
});

describe("nødstopp", () => {
  it("er avslått som standard", async () => {
    expect(await isTradingPaused()).toBe(false);
  });

  it("blokkerer all ny handel når den er aktivert, uavhengig av kontomodus", async () => {
    const user = await createUser();
    await createInstrument("FJRD");
    const account = await createAccount(user.id, "DEMO", 100_000);

    await setTradingPaused(true, user.id);
    expect(await isTradingPaused()).toBe(true);

    await expect(
      placeOrder({ accountId: account.id, userId: user.id, ticker: "FJRD", side: "BUY", quantity: 1, idempotencyKey: "k1" }, { provider, now: () => FIXED_NOW })
    ).rejects.toThrow(/nødstopp/i);
  });

  it("tillater handel igjen etter at nødstoppen er opphevet", async () => {
    const user = await createUser();
    await createInstrument("NORL");
    const account = await createAccount(user.id, "DEMO", 100_000);

    await setTradingPaused(true, user.id);
    await setTradingPaused(false, user.id);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "NORL", side: "BUY", quantity: 1, idempotencyKey: "k2" },
      { provider, now: () => FIXED_NOW }
    );
    expect(order.status).toBe("FILLED");
  });
});
