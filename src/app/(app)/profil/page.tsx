import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">Profil</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Visningsnavn</p>
        <p className="font-semibold text-slate-900">{session.user.name}</p>
        <p className="mt-3 text-xs text-slate-500">E-post</p>
        <p className="font-medium text-slate-900">{session.user.email}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Om Børsliga</p>
        <p className="mt-1">
          Alle penger i Børsliga er fiktive. Kursene er simulert demodata og kan avvike fra
          virkeligheten. Denne versjonen har ingen ekte aksjeordre, innskudd, uttak eller
          pengepremier.
        </p>
      </div>

      <SignOutButton className="rounded-xl border border-red-200 bg-white p-4 text-center text-sm font-semibold text-red-600 hover:bg-red-50" />
    </div>
  );
}
