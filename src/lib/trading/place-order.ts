import { Prisma, type Order, type OrderSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal, calculateBrokerageFee } from "@/lib/money";
import { env } from "@/lib/env";
import { getMarketDataProvider } from "@/lib/market";
import type { MarketDataProvider } from "@/lib/market/types";
import {
  ForbiddenError,
  IdempotencyConflictError,
  NotFoundError,
  SeasonNotActiveError,
  ValidationError,
} from "./errors";

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
  // Kun for tester: injiser en "nå"-funksjon i stedet for Date.now().
  now?: () => Date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));
}

/**
 * Plasserer og utfører en ordre synkront innenfor samme kall.
 *
 * Forenklet simulering (ikke full ordrebokutførelse): ordren venter på
 * første gyldige prisobservasjon MED markedsdatatidspunkt etter serverens
 * mottak av ordren (aldri en allerede kjent/gammel kurs), opptil
 * `maxWaitMs`. All saldo-/beholdningsendring skjer i én databasetransaksjon
 * med radlåsing, slik at samtidige ordre på samme konto serialiseres og
 * aldri kan skape penger eller doble handler. Idempotensnøkkelen gjør at
 * gjentatte identiske forespørsler returnerer samme resultat i stedet for å
 * utføre ordren på nytt.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  options: PlaceOrderOptions = {}
): Promise<Order> {
  const provider = options.provider ?? getMarketDataProvider();
  const maxWaitMs = options.maxWaitMs ?? env.ORDER_MAX_WAIT_MS;
  const now = options.now ?? (() => new Date());

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ValidationError("Antall må være et positivt heltall.");
  }

  const account = await prisma.account.findUnique({
    where: { id: input.accountId },
    include: { season: true },
  });
  if (!account) throw new NotFoundError("Fant ikke kontoen.");
  if (account.userId !== input.userId) throw new ForbiddenError();

  const stock = await prisma.stock.findUnique({ where: { ticker: input.ticker } });
  if (!stock) throw new ValidationError(`Ukjent aksje: ${input.ticker}`);

  const requestedAt = now();

  if (account.season) {
    if (requestedAt < account.season.startsAt || requestedAt >= account.season.endsAt) {
      throw new SeasonNotActiveError();
    }
  }

  const order = await createPendingOrderIdempotently(input, stock.id, requestedAt, maxWaitMs);
  if (order.status !== "PENDING") {
    // Idempotent replay av en allerede avgjort ordre.
    return order;
  }

  if (!provider.isMarketOpen(requestedAt)) {
    return finalizeRejected(order.id, "Markedet er stengt. Handel er kun mulig i åpningstiden.");
  }

  const { observation, availableAt } = provider.getNextObservationAfter(stock.ticker, requestedAt);

  if (availableAt.getTime() - requestedAt.getTime() > maxWaitMs) {
    return finalizeExpired(
      order.id,
      "Ingen gyldig kursobservasjon innen maksimal ventetid. Prøv igjen."
    );
  }
  if (!provider.isMarketOpen(observation.observedAt)) {
    return finalizeRejected(
      order.id,
      "Ordren kunne ikke fylles før markedet stengte. Prøv igjen når markedet åpner."
    );
  }
  if (account.season && observation.observedAt >= account.season.endsAt) {
    return finalizeRejected(
      order.id,
      "Ordren kunne ikke fylles før sesongen ble avsluttet."
    );
  }

  const waitMs = availableAt.getTime() - now().getTime();
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  // Sjekk om ordren ble kansellert mens vi ventet.
  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (!current || current.status !== "PENDING") {
    return current ?? order;
  }

  return executeFill({
    orderId: order.id,
    accountId: account.id,
    stockId: stock.id,
    side: input.side,
    quantity: input.quantity,
    fillPrice: new Decimal(observation.price),
    fillPriceObservedAt: observation.observedAt,
  });
}

async function createPendingOrderIdempotently(
  input: PlaceOrderInput,
  stockId: string,
  requestedAt: Date,
  maxWaitMs: number
): Promise<Order> {
  try {
    return await prisma.order.create({
      data: {
        accountId: input.accountId,
        stockId,
        side: input.side,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
        requestedAt,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // En ordre med denne (konto, idempotensnøkkel)-kombinasjonen finnes
      // allerede — dette er enten en gjentatt forespørsel (nettverksretry,
      // dobbelttrykk) eller et samtidig duplikat som er midt i utførelse.
      const deadline = Date.now() + maxWaitMs;
      let existing = await mustFindByIdempotencyKey(input);
      while (existing.status === "PENDING" && Date.now() < deadline) {
        await sleep(200);
        existing = await mustFindByIdempotencyKey(input);
      }
      if (
        existing.side !== input.side ||
        existing.quantity !== input.quantity ||
        existing.stock.ticker !== input.ticker
      ) {
        throw new IdempotencyConflictError();
      }
      return existing;
    }
    throw error;
  }
}

async function mustFindByIdempotencyKey(input: PlaceOrderInput) {
  const found = await prisma.order.findUniqueOrThrow({
    where: {
      accountId_idempotencyKey: {
        accountId: input.accountId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { stock: true },
  });
  return found;
}

async function finalizeRejected(orderId: string, reason: string): Promise<Order> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "REJECTED", rejectionReason: reason },
  });
}

async function finalizeExpired(orderId: string, reason: string): Promise<Order> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "EXPIRED", rejectionReason: reason },
  });
}

interface ExecuteFillInput {
  orderId: string;
  accountId: string;
  stockId: string;
  side: OrderSide;
  quantity: number;
  fillPrice: InstanceType<typeof Decimal>;
  fillPriceObservedAt: Date;
}

async function executeFill(input: ExecuteFillInput): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    // Lås kontoraden slik at samtidige ordre på samme konto serialiseres —
    // dette hindrer at to parallelle salg/kjøp begge leser samme
    // utgangssaldo/beholdning og til sammen overtrekker kontoen.
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${input.accountId} FOR UPDATE`;

    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.status !== "PENDING") {
      // Kansellert av en samtidig forespørsel mens vi ventet på låsen.
      return order;
    }

    const account = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });
    const tradeValue = input.fillPrice.mul(input.quantity);
    const fee = calculateBrokerageFee(tradeValue);

    if (input.side === "BUY") {
      const totalCost = tradeValue.add(fee);
      if (account.cashBalance.lessThan(totalCost)) {
        return tx.order.update({
          where: { id: order.id },
          data: {
            status: "REJECTED",
            rejectionReason: "Ikke tilstrekkelig dekning på kontoen.",
          },
        });
      }

      const newBalance = account.cashBalance.sub(totalCost);
      await tx.account.update({
        where: { id: account.id },
        data: { cashBalance: newBalance },
      });

      const existingHolding = await tx.holding.findUnique({
        where: { accountId_stockId: { accountId: account.id, stockId: input.stockId } },
      });
      const costPerShare = totalCost.div(input.quantity);
      if (existingHolding) {
        const totalQty = existingHolding.quantity + input.quantity;
        const newAvgCost = existingHolding.avgCost
          .mul(existingHolding.quantity)
          .add(costPerShare.mul(input.quantity))
          .div(totalQty);
        await tx.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: totalQty, avgCost: newAvgCost },
        });
      } else {
        await tx.holding.create({
          data: {
            accountId: account.id,
            stockId: input.stockId,
            quantity: input.quantity,
            avgCost: costPerShare,
          },
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
        data: {
          accountId: account.id,
          orderId: order.id,
          type: "TRADE_BUY",
          amount: totalCost.neg(),
          balanceAfter: newBalance,
        },
      });

      return filled;
    }

    // SELL
    const holding = await tx.holding.findUnique({
      where: { accountId_stockId: { accountId: account.id, stockId: input.stockId } },
    });
    if (!holding || holding.quantity < input.quantity) {
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "REJECTED",
          rejectionReason: "Ikke nok aksjer i beholdningen.",
        },
      });
    }

    const proceeds = tradeValue.sub(fee);
    const newBalance = account.cashBalance.add(proceeds);
    await tx.account.update({
      where: { id: account.id },
      data: { cashBalance: newBalance },
    });

    const remainingQty = holding.quantity - input.quantity;
    if (remainingQty === 0) {
      await tx.holding.delete({ where: { id: holding.id } });
    } else {
      await tx.holding.update({ where: { id: holding.id }, data: { quantity: remainingQty } });
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
      data: {
        accountId: account.id,
        orderId: order.id,
        type: "TRADE_SELL",
        amount: proceeds,
        balanceAfter: newBalance,
      },
    });

    return filled;
  });
}
