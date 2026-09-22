import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureSnapshotsThrough, todayOsloPureDate, buildCalendarCells } from "@/lib/accounting";
import { formatCurrency } from "@/lib/money";
import { MonthGrid } from "@/components/calendar/month-grid";
import type { DailySnapshot } from "@prisma/client";

export const metadata = { title: "Resultatkalender" };

interface KalenderPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

const MONTH_NAMES = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

export default async function KalenderPage({ searchParams }: KalenderPageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;
  const today = todayOsloPureDate();
  const year = sp.year ? parseInt(sp.year, 10) : today.getUTCFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : today.getUTCMonth() + 1;

  const account = await prisma.account.findUnique({
    where: { userId_mode: { userId: session.user.id, mode: "DEMO" } },
  });

  if (!account) {
    return <p className="text-sm text-slate-500">Fant ingen DEMO-konto.</p>;
  }

  await ensureSnapshotsThrough(account.id, today);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const snapshots = await prisma.dailySnapshot.findMany({
    where: { accountId: account.id, tradingDate: { gte: monthStart, lte: monthEnd } },
    orderBy: { tradingDate: "asc" },
  });

  const byDate = new Map<string, DailySnapshot>(snapshots.map((s) => [s.tradingDate.toISOString().slice(0, 10), s]));
  const cells = buildCalendarCells(year, month, byDate);

  const monthResult = snapshots.reduce((acc, s) => acc.add(s.dayResult), snapshots[0]?.dayResult.mul(0) ?? null);
  const tradeCount = snapshots.reduce((acc, s) => acc + s.tradeCount, 0);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const isCurrentOrFutureNext = nextMonth.year > today.getUTCFullYear() || (nextMonth.year === today.getUTCFullYear() && nextMonth.month > today.getUTCMonth() + 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Resultatkalender</h1>
        <p className="text-sm text-slate-500">DEMO-konto · syntetiske data</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/kalender?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ← Forrige
          </Link>
          <p className="font-semibold text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
          </p>
          {isCurrentOrFutureNext ? (
            <span className="px-2 py-1 text-sm text-slate-300">Neste →</span>
          ) : (
            <Link
              href={`/kalender?year=${nextMonth.year}&month=${nextMonth.month}`}
              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            >
              Neste →
            </Link>
          )}
        </div>

        <MonthGrid cells={cells} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Resultat denne måneden</span>
          <span className={`font-semibold ${monthResult && monthResult.gte(0) ? "text-emerald-600" : "text-red-600"}`}>
            {monthResult ? formatCurrency(monthResult) : "Ingen data ennå"}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-slate-500">Antall handler</span>
          <span className="font-medium text-slate-700">{tradeCount}</span>
        </div>
      </div>
    </div>
  );
}
