import { prisma } from "@/lib/prisma";

const TRADING_PAUSED_KEY = "trading_paused";

/**
 * Nødstopp for simulert handel. Satt av et menneske via profilsiden —
 * ALDRI av en språkmodell eller automatisk prosess. `placeOrder` sjekker
 * denne FØR noe annet.
 */
export async function isTradingPaused(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: TRADING_PAUSED_KEY } });
  return setting?.value === "true";
}

export async function setTradingPaused(paused: boolean, byUserId: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: TRADING_PAUSED_KEY },
    create: { key: TRADING_PAUSED_KEY, value: String(paused), updatedById: byUserId },
    update: { value: String(paused), updatedById: byUserId },
  });
  await prisma.systemEvent.create({
    data: {
      level: "WARNING",
      category: "kill_switch",
      message: paused ? "Handel satt på pause (nødstopp aktivert)." : "Handel gjenopptatt.",
      contextJson: { byUserId },
    },
  });
}
