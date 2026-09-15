import type { PricePoint } from "@/lib/market/history";

export function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        Ikke nok kursdata ennå.
      </div>
    );
  }

  const width = 320;
  const height = 120;
  const padding = 6;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const xStep = (width - padding * 2) / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = padding + i * xStep;
      const y = padding + (height - padding * 2) * (1 - (p.price - min) / range);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isUp = prices[prices.length - 1] >= prices[0];
  const stroke = isUp ? "#059669" : "#dc2626";
  const areaPath = `${path} L${(padding + (points.length - 1) * xStep).toFixed(1)},${(
    height - padding
  ).toFixed(1)} L${padding},${(height - padding).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Kursgraf">
      <path d={areaPath} fill={stroke} opacity={0.08} stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
