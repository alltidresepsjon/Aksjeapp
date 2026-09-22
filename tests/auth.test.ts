import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser, isEmailAllowlisted } from "@/lib/auth/register";
import { NotAllowlistedError, ValidationError } from "@/lib/errors";
import { resetDb } from "./helpers";

// Testmiljøet setter ALLOWED_EMAILS=allowlisted@example.test (vitest.config.ts).

beforeEach(async () => {
  await resetDb();
});

describe("privat plattform — tillatt-liste", () => {
  it("isEmailAllowlisted er sann kun for e-poster på listen", () => {
    expect(isEmailAllowlisted("allowlisted@example.test")).toBe(true);
    expect(isEmailAllowlisted("ALLOWLISTED@EXAMPLE.TEST")).toBe(true); // case-insensitiv
    expect(isEmailAllowlisted("random@example.test")).toBe(false);
  });

  it("nekter registrering for en e-post som ikke er på tillatt-listen", async () => {
    await expect(
      registerUser({ email: "ikke-godkjent@example.test", password: "sikkertpassord123", displayName: "Test" })
    ).rejects.toBeInstanceOf(NotAllowlistedError);

    const user = await prisma.user.findUnique({ where: { email: "ikke-godkjent@example.test" } });
    expect(user).toBeNull();
  });

  it("tillater registrering for en e-post på tillatt-listen, og oppretter DEMO- og PAPER-konto", async () => {
    const user = await registerUser({ email: "allowlisted@example.test", password: "sikkertpassord123", displayName: "Godkjent Bruker" });

    const accounts = await prisma.account.findMany({ where: { userId: user.id } });
    expect(accounts.map((a) => a.mode).sort()).toEqual(["DEMO", "PAPER"]);
  });

  it("avviser for kort passord selv for en godkjent e-post", async () => {
    await expect(
      registerUser({ email: "allowlisted@example.test", password: "kort", displayName: "Test" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("avviser dobbel registrering av samme e-post", async () => {
    await registerUser({ email: "allowlisted@example.test", password: "sikkertpassord123", displayName: "Først" });
    await expect(
      registerUser({ email: "allowlisted@example.test", password: "sikkertpassord123", displayName: "Igjen" })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
