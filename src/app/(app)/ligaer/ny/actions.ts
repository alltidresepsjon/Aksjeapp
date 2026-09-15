"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createLeague } from "@/lib/leagues";
import { ValidationError } from "@/lib/trading/errors";

export interface CreateLeagueFormState {
  error?: string;
}

export async function createLeagueAction(
  _prevState: CreateLeagueFormState,
  formData: FormData
): Promise<CreateLeagueFormState> {
  const session = await auth();
  if (!session?.user) return { error: "Du må være innlogget." };

  const name = String(formData.get("name") ?? "");
  const startDateStr = String(formData.get("startDate") ?? "");
  const seasonStartsAt = new Date(`${startDateStr}T09:00:00`);
  if (Number.isNaN(seasonStartsAt.getTime())) {
    return { error: "Ugyldig startdato." };
  }

  let leagueId: string;
  try {
    const { league } = await createLeague({ name, ownerId: session.user.id, seasonStartsAt });
    leagueId = league.id;
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }

  redirect(`/ligaer/${leagueId}`);
}
