import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Logg inn" };

interface LoggInnPageProps {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}

export default async function LoggInnPage(props: LoggInnPageProps) {
  const session = await auth();
  if (session?.user) redirect("/oversikt");

  const searchParams = await props.searchParams;
  const callbackUrlRaw = searchParams?.callbackUrl;
  const callbackUrl = (Array.isArray(callbackUrlRaw) ? callbackUrlRaw[0] : callbackUrlRaw) || "/oversikt";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-2xl font-bold text-slate-900">📊 Aksjeanalyse</p>
        <p className="mt-1 text-sm text-slate-500">Privat plattform · fiktive penger · ingen løfter</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-lg font-semibold text-slate-900">Logg inn</h1>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Ny her?{" "}
        <Link href="/registrer" className="font-medium text-emerald-700 hover:underline">
          Opprett en konto
        </Link>
      </p>
    </main>
  );
}
