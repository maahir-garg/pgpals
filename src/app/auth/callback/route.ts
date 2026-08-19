import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextPath = safeNextPath(
    url.searchParams.get("next"),
    type === "recovery" ? "/reset-password" : "/dashboard"
  );

  if ((tokenHash && type === "recovery") || code) {
    const supabase = await createClient();
    const { error } =
      tokenHash && type === "recovery"
        ? await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          })
        : await supabase.auth.exchangeCodeForSession(code!);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }
  }

  const retryUrl = new URL("/forgot-password", url.origin);
  retryUrl.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(retryUrl);
}
