"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { joinLeagueByInviteCode } from "@/lib/leagues";
import { TradingError } from "@/lib/trading/errors";

export interface JoinLeagueFormState {
  error?: string;
}

export async function joinLeagueAction(
  _prevState: JoinLeagueFormState,
  formData: FormData
): Promise<JoinLeagueFormState> {
  const session = await auth();
  if (!session?.user) return { error: "Du må være innlogget." };

  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  if (!inviteCode) return { error: "Skriv inn en invitasjonskode." };

  let leagueId: string;
  try {
    const { league } = await joinLeagueByInviteCode(inviteCode, session.user.id);
    leagueId = league.id;
  } catch (error) {
    if (error instanceof TradingError) return { error: error.message };
    throw error;
  }

  redirect(`/ligaer/${leagueId}`);
}
