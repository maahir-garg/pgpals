"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Wrong email or password. Try again!" };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) return { error: "Enter your email and a password." };
  if (password.length < 8) return { error: "Password needs at least 8 characters." };

  const supabase = await createClient();

  // Friendly pre-check against the roster; the database trigger is the
  // authoritative gate and rejects unlisted emails regardless.
  const { data: precheck, error: precheckError } = await supabase.rpc(
    "signup_precheck",
    { p_email: email }
  );
  if (precheckError) return { error: "Something went wrong. Try again." };
  if (!precheck?.ok) {
    if (precheck?.reason === "already_registered") {
      return { error: "This email already has an account. Log in instead." };
    }
    return {
      error:
        "This email isn't on the PGPals list. Check you used the email you registered with, or ask your RA to add you.",
    };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || precheck.full_name || "" } },
  });
  if (error) {
    return { error: "Could not create your account: " + error.message };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
