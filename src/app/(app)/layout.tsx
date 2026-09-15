import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBadge } from "@/components/demo-badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/logg-inn");
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/oversikt" className="text-lg font-bold text-slate-900">
            📈 Børsliga
          </Link>
          <DemoBadge />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">{children}</main>

      <BottomNav />
    </div>
  );
}
