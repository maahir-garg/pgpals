"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    null
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Create account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            First register for the event on NUSync. Once your RA adds you to a
            team roster, create your account with that exact email.
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
            <Label htmlFor="full_name">Your name</Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="As you'd like it shown"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
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
            {pending ? "Creating account..." : "Join PGPals"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already signed up?{" "}
            <Link href="/login" className="font-semibold text-primary underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
