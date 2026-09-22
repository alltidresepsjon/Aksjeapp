import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";

export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { account: true } });
    if (!order) throw new NotFoundError("Fant ikke ordren.");
    if (order.account.userId !== userId) throw new ForbiddenError();
    if (order.status !== "PENDING") {
      throw new AppError(`Ordren har status ${order.status} og kan ikke kanselleres.`, "ORDER_NOT_CANCELLABLE");
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", rejectionReason: "Kansellert av bruker." } });
  });
}
