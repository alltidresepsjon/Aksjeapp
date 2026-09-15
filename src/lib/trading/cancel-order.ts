import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, TradingError } from "./errors";

/**
 * Kansellerer en ordre som fortsatt er PENDING (dvs. fortsatt venter på en
 * prisobservasjon). Siden `placeOrder` normalt fyller ordren i samme kall
 * innenfor et par sekunder, er vinduet hvor kansellering er mulig kort —
 * men støttes for å håndtere race conditions og lengre ventetider korrekt.
 */
export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { account: true },
    });
    if (!order) throw new NotFoundError("Fant ikke ordren.");
    if (order.account.userId !== userId) throw new ForbiddenError();
    if (order.status !== "PENDING") {
      throw new TradingError(
        `Ordren har status ${order.status} og kan ikke kanselleres.`,
        "ORDER_NOT_CANCELLABLE"
      );
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", rejectionReason: "Kansellert av bruker." },
    });
  });
}
