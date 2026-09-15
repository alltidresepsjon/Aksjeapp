import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/trading/errors";
import { ensurePracticeAccount } from "@/lib/leagues";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!EMAIL_RE.test(email)) {
    throw new ValidationError("Ugyldig e-postadresse.");
  }
  if (input.password.length < 8) {
    throw new ValidationError("Passordet må være minst 8 tegn.");
  }
  if (displayName.length < 2 || displayName.length > 30) {
    throw new ValidationError("Visningsnavn må være mellom 2 og 30 tegn.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash, displayName },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ValidationError("Denne e-postadressen er allerede registrert.");
    }
    throw error;
  }

  // Alle nye brukere får en øvingskonto med det samme, adskilt fra ligaer.
  await ensurePracticeAccount(user.id);

  return user;
}
