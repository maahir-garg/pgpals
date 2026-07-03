import Link from "next/link";
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
    <div className="flex min-h-dvh w-full flex-col pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-3 md:max-w-5xl">
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="text-2xl" aria-hidden>
              🐧
            </span>
            <span className="text-xl font-extrabold tracking-tight text-primary">
              PGPals
            </span>
          </Link>
          <TopNav />
          <div className="flex items-center gap-2">
            {profile.team_id && (
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
                ⭐ {score ?? 0} pts
              </span>
            )}
            {profile.role === "admin" && (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link href="/admin">Admin</Link>
              </Button>
            )}
            <form action={signout}>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-muted-foreground"
              >
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 md:max-w-5xl md:py-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
