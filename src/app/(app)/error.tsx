"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-3xl">⚠️</p>
      <p className="font-semibold text-slate-900">Noe gikk galt</p>
      <p className="max-w-xs text-sm text-slate-500">
        {error.message || "En uventet feil oppstod. Prøv igjen om et øyeblikk."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Prøv igjen
      </button>
    </div>
  );
}
