import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { placeOrder } from "@/lib/trading";
import { AppError } from "@/lib/errors";

const bodySchema = z.object({
  accountId: z.string().min(1),
  ticker: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().min(1).max(200),
});

function statusForErrorCode(code: string): number {
  switch (code) {
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    default:
      return 422;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  try {
    const order = await placeOrder({
      accountId: parsed.data.accountId,
      userId: session.user.id,
      ticker: parsed.data.ticker.toUpperCase(),
      side: parsed.data.side,
      quantity: parsed.data.quantity,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusForErrorCode(error.code) });
    }
    console.error("Uventet feil ved ordreutførelse:", error);
    return NextResponse.json({ error: "Uventet feil. Prøv igjen." }, { status: 500 });
  }
}
