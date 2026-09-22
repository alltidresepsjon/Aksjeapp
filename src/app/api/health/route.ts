import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Offentlig helsesjekk for Railway (ingen innlogging kreves — se
// PUBLIC_PREFIXES i src/proxy.ts). Bekrefter kun at appen svarer og at
// databasen er nåbar; lekker ingen informasjon om innhold.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", detail: "database unreachable" }, { status: 503 });
  }
}
