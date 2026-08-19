import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <ForgotPasswordForm
      initialError={
        error === "invalid-link"
          ? "That reset link is invalid or expired. Request a fresh link and try again."
          : undefined
      }
    />
  );
}
