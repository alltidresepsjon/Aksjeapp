"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/logg-inn" })}
      className={className || "text-sm font-medium text-red-600 hover:underline"}
    >
      Logg ut
    </button>
  );
}
