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
    <Card className="rounded-3xl shadow-lg">
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use the email your RA registered you with, and you&apos;ll be linked to
            your team automatically. 🤝
          </p>
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
            <p className="text-sm font-medium text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full rounded-xl" disabled={pending}>
            {pending ? "Creating account…" : "Join PGPals 🎉"}
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
