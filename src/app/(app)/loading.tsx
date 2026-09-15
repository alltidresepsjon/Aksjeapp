export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
        <p className="text-sm">Laster…</p>
      </div>
    </div>
  );
}
