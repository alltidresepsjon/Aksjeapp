import Link from "next/link";
import { auth } from "@/auth";
import { listUserAccounts } from "@/lib/accounts";
import { formatNok, formatPercent } from "@/lib/money";
import { SEASON_STATUS_LABELS } from "@/lib/leagues";

export const metadata = { title: "Oversikt" };

export default async function OversiktPage() {
  const session = await auth();
  if (!session?.user) return null;

  const accounts = await listUserAccounts(session.user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hei, {session.user.name}!</h1>
        <p className="text-sm text-slate-500">Alle beløp under er fiktive kroner.</p>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map((a) => (
          <Link
            key={a.account.id}
            href={`/konto/${a.account.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {a.isPractice ? "Øvingskonto" : a.league?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {a.isPractice
                    ? "Øv deg risikofritt"
                    : `Sesong ${a.season?.seasonNumber} · ${
                        a.seasonStatus ? SEASON_STATUS_LABELS[a.seasonStatus] : ""
                      }`}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  a.returnPercent.gte(0) ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatPercent(a.returnPercent)}
              </span>
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900">{formatNok(a.totalValue)}</p>
            <p className="text-xs text-slate-400">
              Kontanter: {formatNok(a.account.cashBalance)}
              {a.hasMissingPrices && " · noen kurser mangler akkurat nå"}
            </p>
          </Link>
        ))}
      </div>

      <Link
        href="/ligaer"
        className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        + Bli med i eller opprett en liga
      </Link>
    </div>
  );
}
