"use client";

import { useState, useTransition } from "react";
import { toggleTradingPausedAction } from "@/app/(app)/profil/actions";

export function KillSwitchToggle({ initialPaused }: { initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !paused;
    startTransition(async () => {
      await toggleTradingPausedAction(next);
      setPaused(next);
    });
  }

  return (
    <div className={`rounded-xl border p-4 ${paused ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm font-semibold text-slate-900">Nødstopp for handel</p>
      <p className="mt-1 text-xs text-slate-500">
        {paused
          ? "All handel er satt på pause. Ingen nye ordre kan legges inn før du gjenopptar."
          : "Handel er aktiv. Trykk for å umiddelbart stanse all simulert handel."}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
          paused ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {pending ? "Oppdaterer…" : paused ? "Gjenoppta handel" : "Stopp all handel nå"}
      </button>
    </div>
  );
}
