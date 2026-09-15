"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createNewSeason } from "@/lib/leagues";
import { TradingError } from "@/lib/trading/errors";

export interface NewSeasonFormState {
  error?: string;
}

export async function createNewSeasonAction(
  leagueId: string,
  _prevState: NewSeasonFormState,
  formData: FormData
): Promise<NewSeasonFormState> {
  const session = await auth();
  if (!session?.user) return { error: "Du må være innlogget." };

  const startDateStr = String(formData.get("startDate") ?? "");
  const seasonStartsAt = new Date(`${startDateStr}T09:00:00`);
  if (Number.isNaN(seasonStartsAt.getTime())) {
    return { error: "Ugyldig startdato." };
  }

  try {
    await createNewSeason(leagueId, session.user.id, seasonStartsAt);
  } catch (error) {
    if (error instanceof TradingError) return { error: error.message };
    throw error;
  }

  redirect(`/ligaer/${leagueId}`);
}
