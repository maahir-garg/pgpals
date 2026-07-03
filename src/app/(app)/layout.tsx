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
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3 md:max-w-6xl">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground"
              aria-hidden
            >
              PG
            </span>
            <span className="text-lg font-extrabold tracking-tight text-primary">
              PGPals
            </span>
          </Link>
          <TopNav />
          <div className="flex shrink-0 items-center gap-2">
            {profile.team_id && (
              <span className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-sm font-bold text-secondary-foreground">
                <Star className="size-3.5 fill-current" aria-hidden />
                {score ?? 0} pts
              </span>
            )}
            {profile.role === "admin" && (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
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
              >
                <LogOut className="size-3.5" aria-hidden />
                Log out
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
