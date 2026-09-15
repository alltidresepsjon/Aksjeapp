import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-3xl">🔍</p>
      <p className="font-semibold text-slate-900">Fant ikke siden</p>
      <p className="max-w-xs text-sm text-slate-500">
        Siden finnes ikke, eller du har ikke tilgang til den.
      </p>
      <Link
        href="/oversikt"
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Til oversikten
      </Link>
    </div>
  );
}
