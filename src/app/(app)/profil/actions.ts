"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setTradingPaused } from "@/lib/kill-switch";

export async function toggleTradingPausedAction(paused: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke innlogget.");
  await setTradingPaused(paused, session.user.id);
  revalidatePath("/profil");
}
