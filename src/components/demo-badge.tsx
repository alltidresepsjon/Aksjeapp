export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 ${className}`}
      title="Kursene er simulert demodata, ikke ekte markedsdata."
    >
      <span className="size-1.5 rounded-full bg-amber-500" />
      Demodata
    </span>
  );
}
