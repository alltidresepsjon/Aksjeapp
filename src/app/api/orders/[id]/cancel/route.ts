import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelOrder } from "@/lib/trading";
import { TradingError } from "@/lib/trading/errors";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await cancelOrder(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TradingError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Uventet feil ved kansellering:", error);
    return NextResponse.json({ error: "Uventet feil. Prøv igjen." }, { status: 500 });
  }
}
