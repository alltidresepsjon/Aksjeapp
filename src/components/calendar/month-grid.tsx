import Link from "next/link";
import type { CalendarDayCell } from "@/lib/accounting";
import { formatPercent } from "@/lib/money";

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function cellClasses(cell: CalendarDayCell): string {
  if (!cell.hasData) return "bg-slate-50 text-slate-300";
  if (cell.marketClosed) return "bg-slate-100 text-slate-400";
  if (cell.dayResult === null) return "bg-slate-50 text-slate-300";
  if (cell.dayResult.isZero()) return "bg-slate-100 text-slate-600";
  return cell.dayResult.gt(0) ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
}

export function MonthGrid({ cells }: { cells: CalendarDayCell[] }) {
  // getUTCDay(): 0=søndag..6=lørdag. Vi vil ha mandag først.
  const firstWeekday = (cells[0].tradingDate.getUTCDay() + 6) % 7;
  const leadingBlanks = Array.from({ length: firstWeekday });

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {leadingBlanks.map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {cells.map((cell) => {
          const dateStr = cell.tradingDate.toISOString().slice(0, 10);
          const dayNum = cell.tradingDate.getUTCDate();
          return (
            <Link
              key={dateStr}
              href={cell.hasData ? `/kalender/${dateStr}` : "#"}
              aria-disabled={!cell.hasData}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${cellClasses(
                cell
              )} ${cell.hasData ? "hover:opacity-80" : "pointer-events-none"}`}
              title={
                cell.hasData
                  ? cell.marketClosed
                    ? "Markedet var stengt"
                    : cell.dataIncomplete
                      ? "Data mangler delvis denne dagen"
                      : undefined
                  : "Ingen data ennå"
              }
            >
              <span className="font-semibold">{dayNum}</span>
              {cell.hasData && !cell.marketClosed && cell.dayResultPercent && (
                <span className="text-[10px]">{formatPercent(cell.dayResultPercent)}</span>
              )}
              {cell.hasData && cell.marketClosed && <span className="text-[10px]">stengt</span>}
              {cell.dataIncomplete && <span aria-hidden>⚠</span>}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-emerald-100" /> Positivt
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-red-100" /> Negativt
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-slate-100" /> Null / stengt
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-slate-50" /> Ingen data
        </span>
        <span className="flex items-center gap-1">⚠ Data mangler delvis</span>
      </div>
    </div>
  );
}
