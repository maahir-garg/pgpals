import Link from "next/link";
import { LogOut, Shield, Star } from "lucide-react";
import { requireProfile } from "@/lib/data";
import { signout } from "@/app/(auth)/actions";
import { BottomNav } from "@/components/pgpals/bottom-nav";
import { TopNav } from "@/components/pgpals/top-nav";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile } = await requireProfile();
  const { data: score } = await supabase.rpc("get_my_score");

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-2.5 md:max-w-6xl">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <span className="text-lg font-extrabold tracking-tight">
              PGPals
            </span>
          </Link>
          <TopNav />
          <div className="flex shrink-0 items-center gap-1.5">
            {profile.team_id && (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-sm font-bold text-accent-foreground">
                <Star className="size-3.5 fill-current" aria-hidden />
                {score ?? 0}
              </span>
            )}
            {profile.role === "admin" && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex"
              >
                <Link href="/admin">
                  <Shield className="size-3.5" aria-hidden />
                  Admin
                </Link>
              </Button>
            )}
            <form action={signout}>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                aria-label="Log out"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 md:max-w-6xl md:py-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
