"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = { error?: string; message?: string } | null;

function signupErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email rate limit")) {
    return (
      "Supabase has hit its auth email limit. Ask an admin to check the service-role key or email settings, then try again."
    );
  }
  if (normalized.includes("already") && normalized.includes("registered")) {
    return "This email already has an account. Log in instead.";
  }
  return "Could not create your account: " + message;
}

async function getSiteOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

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
  if (email.endsWith(".test")) {
    return {
      error:
        "Demo .test emails only work in local development. Use a real email that has been added to PGPals.",
    };
  }

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

  const displayName = fullName || precheck.full_name || "";

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });
    if (createError) return { error: signupErrorMessage(createError.message) };

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      return {
        message:
          "Your account was created. Log in with the password you just chose.",
      };
    }
  } else {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    if (error) return { error: signupErrorMessage(error.message) };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };
  if (email.endsWith(".test")) {
    return {
      error:
        "Demo .test emails only work in local development. Use your real account email.",
    };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: "Could not send a reset email. Check the address and try again." };
  }

  return {
    message:
      "If that email has a PGPals account, a password reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password) return { error: "Enter a new password." };
  if (password.length < 8) {
    return { error: "Password needs at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Open the password reset link from your email before setting a new password.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Could not update your password. Try the reset link again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
