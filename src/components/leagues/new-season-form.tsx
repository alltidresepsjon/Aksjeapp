"use client";

import { useActionState } from "react";
import { createNewSeasonAction, type NewSeasonFormState } from "@/app/(app)/ligaer/[id]/ny-sesong/actions";

const initialState: NewSeasonFormState = {};

export function NewSeasonForm({ leagueId, minDate }: { leagueId: string; minDate: string }) {
  const boundAction = createNewSeasonAction.bind(null, leagueId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="startDate" className="text-sm font-medium text-slate-700">
          Sesongstart
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          min={minDate}
          defaultValue={minDate}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
        />
        <p className="text-xs text-slate-400">
          Alle som vil delta må selv bli med igjen via invitasjonskoden — kontoer og kapital
          overføres ikke automatisk mellom sesonger.
        </p>
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
        {pending ? "Oppretter…" : "Start ny sesong"}
      </button>
    </form>
  );
}
