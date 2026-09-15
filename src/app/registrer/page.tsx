import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Registrer deg" };

export default async function RegistrerPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/oversikt");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-2xl font-bold text-slate-900">📈 Børsliga</p>
        <p className="mt-1 text-sm text-slate-500">100 000 fiktive kroner. Ingen risiko.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-lg font-semibold text-slate-900">Opprett konto</h1>
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Har du allerede konto?{" "}
        <Link href="/logg-inn" className="font-medium text-emerald-700 hover:underline">
          Logg inn
        </Link>
      </p>
    </main>
  );
}
