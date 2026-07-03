"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Reset password
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email for a reset link.
          </p>
        </div>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@u.nus.edu"
              required
            />
          </div>
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          {state?.message && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              {state.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending..." : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-primary underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
