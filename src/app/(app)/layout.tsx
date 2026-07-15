import Link from "next/link";
import { Coins, LogOut, Shield } from "lucide-react";
import { getMyScore, requireProfile } from "@/lib/data";
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
  const score = profile.team_id ? await getMyScore(supabase) : 0;

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-clip bg-background pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-2 md:max-w-6xl">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <span className="font-heading text-lg font-extrabold tracking-tight">
              PGPals<span className="hidden lg:inline">: The Emerald Challenge</span>
            </span>
          </Link>
          <TopNav />
          <div className="flex shrink-0 items-center gap-1.5">
            {profile.team_id && (
              <span
                className="flex items-center gap-1 rounded-full border-2 border-foreground bg-accent px-2.5 py-0.5 text-sm font-bold text-accent-foreground"
                title="Your team's PGP Coins"
              >
                <Coins className="size-3.5" strokeWidth={2.5} aria-hidden />
                {score}
              </span>
            )}
            {profile.role === "admin" && (
              <>
                <Button
                  asChild
                  size="icon-sm"
                  variant="outline"
                  className="sm:hidden"
                >
                  <Link
                    href="/admin"
                    aria-label="Open admin console"
                    title="Admin console"
                  >
                    <Shield className="size-4" aria-hidden />
                  </Link>
                </Button>
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
              </>
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
      <main className="mx-auto w-full max-w-lg min-w-0 flex-1 px-4 py-6 md:max-w-6xl md:py-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
