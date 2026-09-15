"use client";

import { useActionState } from "react";
import { joinLeagueAction, type JoinLeagueFormState } from "@/app/(app)/ligaer/bli-med/actions";

const initialState: JoinLeagueFormState = {};

export function JoinLeagueForm() {
  const [state, formAction, pending] = useActionState(joinLeagueAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inviteCode" className="text-sm font-medium text-slate-700">
          Invitasjonskode
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          required
          autoCapitalize="characters"
          placeholder="F.eks. AB3XQ9F"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base uppercase tracking-wider focus:border-emerald-600 focus:outline-none"
        />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Blir med…" : "Bli med i liga"}
      </button>
    </form>
  );
}
