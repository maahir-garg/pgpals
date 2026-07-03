"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    null
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            New password
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your PGPals account.
          </p>
        </div>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Save new password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
