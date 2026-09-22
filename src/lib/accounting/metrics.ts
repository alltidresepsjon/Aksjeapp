import { Decimal } from "@/lib/money";
import type { DailySnapshot } from "@prisma/client";

/**
 * Rene, testbare funksjoner som utleder nøkkeltall fra en tidsordnet liste
 * med DailySnapshot-rader. Ingen databasekall, ingen AI — kun aritmetikk.
 */

export interface PortfolioValuePoint {
  tradingDate: Date;
  value: InstanceType<typeof Decimal>;
}

/** Kumulativ porteføljeverdi (startkapital + akkumulert dagsresultat) per dag. */
export function cumulativeValueSeries(
  startingCapital: InstanceType<typeof Decimal>,
  snapshots: DailySnapshot[]
): PortfolioValuePoint[] {
  let running = startingCapital;
  return snapshots.map((s) => {
    running = running.add(s.dayResult);
    return { tradingDate: s.tradingDate, value: running };
  });
}

/** Størst observert verdifall fra en tidligere topp (negativt tall, prosent). */
export function maxDrawdownPercent(series: PortfolioValuePoint[]): InstanceType<typeof Decimal> {
  if (series.length === 0) return new Decimal(0);
  let peak = series[0].value;
  let worst = new Decimal(0);
  for (const point of series) {
    if (point.value.greaterThan(peak)) peak = point.value;
    if (peak.isZero()) continue;
    const drawdown = point.value.sub(peak).div(peak).mul(100);
    if (drawdown.lessThan(worst)) worst = drawdown;
  }
  return worst;
}

/**
 * Avkastning i prosent for de siste `days` handelsdagene, relativt til
 * porteføljeverdien ved starten av perioden (IKKE annualisert — korte
 * perioder skal aldri vises som misvisende annualiserte tall).
 */
export function periodReturnPercent(snapshots: DailySnapshot[], days: number): InstanceType<typeof Decimal> | null {
  if (snapshots.length === 0) return null;
  const window = snapshots.slice(Math.max(0, snapshots.length - days));
  if (window.length === 0) return null;
  const startValue = window[0].startValue;
  if (startValue.isZero()) return null;
  const sumResult = window.reduce((acc, s) => acc.add(s.dayResult), new Decimal(0));
  return sumResult.div(startValue).mul(100);
}

export function sinceInceptionReturnPercent(
  startingCapital: InstanceType<typeof Decimal>,
  snapshots: DailySnapshot[]
): InstanceType<typeof Decimal> {
  if (startingCapital.isZero()) return new Decimal(0);
  const totalResult = snapshots.reduce((acc, s) => acc.add(s.dayResult), new Decimal(0));
  return totalResult.div(startingCapital).mul(100);
}

export interface CalendarDayCell {
  tradingDate: Date;
  dayResult: InstanceType<typeof Decimal> | null;
  dayResultPercent: InstanceType<typeof Decimal> | null;
  marketClosed: boolean;
  dataIncomplete: boolean;
  hasData: boolean;
  tradeCount: number;
}

/** Fyller ut en måneds kalenderceller fra tilgjengelige snapshots — dager
 * uten snapshot ennå (fremtid, eller ikke beregnet) markeres `hasData: false`,
 * ALDRI som et implisitt nullresultat. */
export function buildCalendarCells(
  year: number,
  month1to12: number,
  snapshotsByDate: Map<string, DailySnapshot>
): CalendarDayCell[] {
  const daysInMonth = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  const cells: CalendarDayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month1to12 - 1, day));
    const key = date.toISOString().slice(0, 10);
    const snapshot = snapshotsByDate.get(key);
    if (!snapshot) {
      cells.push({
        tradingDate: date,
        dayResult: null,
        dayResultPercent: null,
        marketClosed: false,
        dataIncomplete: false,
        hasData: false,
        tradeCount: 0,
      });
      continue;
    }
    const dayResultPercent = snapshot.startValue.isZero()
      ? null
      : snapshot.dayResult.div(snapshot.startValue).mul(100);
    cells.push({
      tradingDate: date,
      dayResult: snapshot.dayResult,
      dayResultPercent,
      marketClosed: snapshot.marketClosed,
      dataIncomplete: snapshot.dataIncomplete,
      hasData: true,
      tradeCount: snapshot.tradeCount,
    });
  }
  return cells;
}
