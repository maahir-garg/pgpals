"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function RecoverySession() {
  useEffect(() => {
    async function openResetForm() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (type !== "recovery" || !accessToken || !refreshToken) {
        window.location.replace("/forgot-password?error=invalid-link");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      window.location.replace(
        error ? "/forgot-password?error=invalid-link" : "/reset-password"
      );
    }

    void openResetForm();
  }, []);

  return (
    <Card>
      <CardContent className="space-y-2 text-center">
        <h2 className="text-xl font-extrabold tracking-tight">
          Opening password reset…
        </h2>
        <p className="text-sm text-muted-foreground">
          Verifying your recovery link securely.
        </p>
      </CardContent>
    </Card>
  );
}
