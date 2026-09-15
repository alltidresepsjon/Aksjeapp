"use client";

import { useActionState } from "react";
import { createLeagueAction, type CreateLeagueFormState } from "@/app/(app)/ligaer/ny/actions";

const initialState: CreateLeagueFormState = {};

export function CreateLeagueForm({ minDate }: { minDate: string }) {
  const [state, formAction, pending] = useActionState(createLeagueAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Liganavn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={3}
          maxLength={60}
          placeholder="F.eks. Kontorligaen"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
        />
      </div>
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
          Sesongen varer i 4 uker. Påmelding stenger 24 timer før start.
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
        {pending ? "Oppretter…" : "Opprett liga"}
      </button>
    </form>
  );
}
