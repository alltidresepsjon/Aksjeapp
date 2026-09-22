"use server";

import { registerUser } from "@/lib/auth/register";
import { signIn } from "@/auth";
import { AppError } from "@/lib/errors";

export interface RegisterFormState {
  error?: string;
}

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");

  try {
    await registerUser({ email, password, displayName });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    throw error;
  }

  await signIn("credentials", { email, password, redirectTo: "/oversikt" });
  return {};
}
