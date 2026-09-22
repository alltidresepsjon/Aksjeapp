import { Prisma, type Order, type OrderSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal, calculateBrokerageFee, applySlippage } from "@/lib/money";
import { getProviderForMode } from "@/lib/market";
import type { MarketDataProvider } from "@/lib/market/types";
import { AppError, ForbiddenError, IdempotencyConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isTradingPaused } from "@/lib/kill-switch";

export interface PlaceOrderInput {
  accountId: string;
  userId: string;
  ticker: string;
  side: OrderSide;
  quantity: number;
  idempotencyKey: string;
}

export interface PlaceOrderOptions {
  provider?: MarketDataProvider;
  maxWaitMs?: number;
  now?: () => Date;
}

const DEFAULT_MAX_WAIT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));
}

/**
 * Plasserer og utfører en simulert ordre (DEMO eller PAPER) synkront
 * innenfor samme kall. Ordren venter på FØRSTE gyldige prisobservasjon med
 * markedsdatatidspunkt etter serverens mottak av ordren — aldri en kjent,
 * allerede-observert kurs. All saldo-/posisjonsendring skjer i én
 * databasetransaksjon med radlåsing, slik at samtidige ordre på samme
 * konto serialiseres og aldri kan skape penger eller doble handler.
 * Idempotensnøkkelen gjør at gjentatte forespørsler returnerer samme
 * resultat i stedet for å utføre ordren på nytt.
 *
 * LIVE_READONLY-kontoer kan aldri handle — det er hele poenget med modusen.
 */
export async function placeOrder(input: PlaceOrderInput, options: PlaceOrderOptions = {}): Promise<Order> {
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const now = options.now ?? (() => new Date());

  // Nødstopp sjekkes FØR noe annet — et menneske kan fryse all handel
  // umiddelbart via profilsiden, uavhengig av kontomodus.
  if (await isTradingPaused()) {
    throw new AppError("Handel er satt på pause (nødstopp er aktivert). Prøv igjen senere.", "TRADING_PAUSED");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ValidationError("Antall må være et positivt heltall.");
  }

  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!account) throw new NotFoundError("Fant ikke kontoen.");
  if (account.userId !== input.userId) throw new ForbiddenError();
  if (account.mode === "LIVE_READONLY") {
    throw new ForbiddenError("LIVE READ-ONLY-kontoer støtter ikke handel i denne versjonen.");
  }

  // Datakilden følger KONTOENS modus, ikke en global innstilling — en
  // DEMO-konto handler alltid mot syntetiske data selv om brukeren også har
  // en PAPER-konto (som ennå ikke har noen ekte leverandør koblet til).
  const provider = options.provider ?? getProviderForMode(account.mode);

  const instrument = await prisma.instrument.findFirst({ where: { ticker: input.ticker } });
  if (!instrument) throw new ValidationError(`Ukjent instrument: ${input.ticker}`);

  const requestedAt = now();
  const order = await createPendingOrderIdempotently(input, instrument.id, maxWaitMs);
  if (order.status !== "PENDING") return order; // idempotent replay

  if (!provider.isMarketOpen(requestedAt)) {
    return finalize(order.id, "REJECTED", "Markedet er stengt. Handel er kun mulig i åpningstiden.");
  }

  const { observation, availableAt } = provider.getNextObservationAfter(instrument.ticker, requestedAt);

  if (availableAt.getTime() - requestedAt.getTime() > maxWaitMs) {
    return finalize(order.id, "EXPIRED", "Ingen gyldig kursobservasjon innen maksimal ventetid. Prøv igjen.");
  }
  if (!provider.isMarketOpen(observation.observedAt)) {
    return finalize(order.id, "REJECTED", "Ordren kunne ikke fylles før markedet stengte.");
  }

  const waitMs = availableAt.getTime() - now().getTime();
  if (waitMs > 0) await sleep(waitMs);

  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (!current || current.status !== "PENDING") return current ?? order;

  const rawPrice = new Decimal(observation.price);
  const fillPrice = applySlippage(rawPrice, input.side);

  return executeFill({
    orderId: order.id,
    accountId: account.id,
    instrumentId: instrument.id,
    side: input.side,
    quantity: input.quantity,
    fillPrice,
    fillPriceObservedAt: observation.observedAt,
  });
}

async function createPendingOrderIdempotently(
  input: PlaceOrderInput,
  instrumentId: string,
  maxWaitMs: number
): Promise<Order> {
  try {
    return await prisma.order.create({
      data: {
        accountId: input.accountId,
        instrumentId,
        side: input.side,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const deadline = Date.now() + maxWaitMs;
      let existing = await mustFindByIdempotencyKey(input);
      while (existing.status === "PENDING" && Date.now() < deadline) {
        await sleep(200);
        existing = await mustFindByIdempotencyKey(input);
      }
      if (
        existing.side !== input.side ||
        existing.quantity !== input.quantity ||
        existing.instrument.ticker !== input.ticker
      ) {
        throw new IdempotencyConflictError();
      }
      return existing;
    }
    throw error;
  }
}

async function mustFindByIdempotencyKey(input: PlaceOrderInput) {
  return prisma.order.findUniqueOrThrow({
    where: { accountId_idempotencyKey: { accountId: input.accountId, idempotencyKey: input.idempotencyKey } },
    include: { instrument: true },
  });
}

async function finalize(orderId: string, status: "REJECTED" | "EXPIRED", reason: string): Promise<Order> {
  return prisma.order.update({ where: { id: orderId }, data: { status, rejectionReason: reason } });
}

interface ExecuteFillInput {
  orderId: string;
  accountId: string;
  instrumentId: string;
  side: OrderSide;
  quantity: number;
  fillPrice: InstanceType<typeof Decimal>;
  fillPriceObservedAt: Date;
}

async function executeFill(input: ExecuteFillInput): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    // Lås kontoraden slik at samtidige ordre på samme konto serialiseres.
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${input.accountId} FOR UPDATE`;

    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.status !== "PENDING") return order; // kansellert mens vi ventet

    const account = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });
    const tradeValue = input.fillPrice.mul(input.quantity);
    const fee = calculateBrokerageFee(tradeValue);

    if (input.side === "BUY") {
      const totalCost = tradeValue.add(fee);
      if (account.cashBalance.lessThan(totalCost)) {
        return tx.order.update({
          where: { id: order.id },
          data: { status: "REJECTED", rejectionReason: "Ikke tilstrekkelig dekning på kontoen." },
        });
      }

      const newBalance = account.cashBalance.sub(totalCost);
      await tx.account.update({ where: { id: account.id }, data: { cashBalance: newBalance } });

      const existing = await tx.position.findUnique({
        where: { accountId_instrumentId: { accountId: account.id, instrumentId: input.instrumentId } },
      });
      const costPerShare = totalCost.div(input.quantity);
      if (existing) {
        const totalQty = existing.quantity + input.quantity;
        const newAvgCost = existing.avgCost
          .mul(existing.quantity)
          .add(costPerShare.mul(input.quantity))
          .div(totalQty);
        await tx.position.update({ where: { id: existing.id }, data: { quantity: totalQty, avgCost: newAvgCost } });
      } else {
        await tx.position.create({
          data: { accountId: account.id, instrumentId: input.instrumentId, quantity: input.quantity, avgCost: costPerShare },
        });
      }

      const filled = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "FILLED",
          filledAt: new Date(),
          fillPrice: input.fillPrice,
          fillPriceObservedAt: input.fillPriceObservedAt,
          feeAmount: fee,
          totalAmount: totalCost,
        },
      });

      await tx.cashLedgerEntry.create({
        data: { accountId: account.id, orderId: order.id, type: "TRADE_BUY", amount: totalCost.neg(), balanceAfter: newBalance },
      });

      return filled;
    }

    // SELL
    const position = await tx.position.findUnique({
      where: { accountId_instrumentId: { accountId: account.id, instrumentId: input.instrumentId } },
    });
    if (!position || position.quantity < input.quantity) {
      return tx.order.update({
        where: { id: order.id },
        data: { status: "REJECTED", rejectionReason: "Ikke nok aksjer i posisjonen." },
      });
    }

    const proceeds = tradeValue.sub(fee);
    const newBalance = account.cashBalance.add(proceeds);
    await tx.account.update({ where: { id: account.id }, data: { cashBalance: newBalance } });

    const remainingQty = position.quantity - input.quantity;
    if (remainingQty === 0) {
      await tx.position.delete({ where: { id: position.id } });
    } else {
      await tx.position.update({ where: { id: position.id }, data: { quantity: remainingQty } });
    }

    const filled = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "FILLED",
        filledAt: new Date(),
        fillPrice: input.fillPrice,
        fillPriceObservedAt: input.fillPriceObservedAt,
        feeAmount: fee,
        totalAmount: proceeds,
      },
    });

    await tx.cashLedgerEntry.create({
      data: { accountId: account.id, orderId: order.id, type: "TRADE_SELL", amount: proceeds, balanceAfter: newBalance },
    });

    return filled;
  });
}
