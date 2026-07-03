"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    null
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Log in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue to your team dashboard.
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-primary underline"
              >
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            First time here?{" "}
            <Link href="/signup" className="font-semibold text-primary underline">
              Create your account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
