import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { env } from "@/lib/env";
import { NotAllowlistedError, ValidationError } from "@/lib/errors";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAllowlisted(email: string): boolean {
  return env.ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!EMAIL_RE.test(email)) {
    throw new ValidationError("Ugyldig e-postadresse.");
  }
  // Privat plattform: registrering er kun mulig for e-postadresser på
  // ALLOWED_EMAILS-listen. Sjekkes FØR noe annet skrives til databasen.
  if (!isEmailAllowlisted(email)) {
    throw new NotAllowlistedError();
  }
  if (input.password.length < 8) {
    throw new ValidationError("Passordet må være minst 8 tegn.");
  }
  if (displayName.length < 2 || displayName.length > 40) {
    throw new ValidationError("Navn må være mellom 2 og 40 tegn.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const startingCapital = new Decimal(env.STARTING_CAPITAL);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, displayName } });

      // DEMO- og PAPER-kontoer opprettes automatisk — begge starter med
      // samme simulerte kapital, helt adskilt fra hverandre.
      for (const mode of ["DEMO", "PAPER"] as const) {
        await tx.account.create({
          data: {
            userId: user.id,
            mode,
            baseCurrency: env.BASE_CURRENCY,
            startingCapital,
            cashBalance: startingCapital,
          },
        });
      }

      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ValidationError("Denne e-postadressen er allerede registrert.");
    }
    throw error;
  }
}
