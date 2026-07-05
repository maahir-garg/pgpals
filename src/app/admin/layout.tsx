import Link from "next/link";
import { ArrowLeft, LogOut, Shield } from "lucide-react";
import { signout } from "@/app/(auth)/actions";
import { requireAdmin } from "@/lib/data";
import { AdminNav } from "./admin-nav";
import { Button } from "@/components/ui/button";

// Layout guard: requireAdmin redirects non-admins. Actual data access is
// enforced by RLS regardless of routing.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-dvh bg-background md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none flex-col overflow-y-auto border-r bg-card px-3 py-6 md:flex">
        <Link href="/admin" className="flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-extrabold tracking-tight">PGPals</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
            <Shield className="size-3" aria-hidden />
            Admin
          </span>
        </Link>
        <div className="mt-6 flex-1">
          <AdminNav />
        </div>
        <div className="space-y-2 px-2">
          <p className="truncate text-xs text-muted-foreground">
            {profile.full_name}
          </p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
              Participant view
            </Link>
          </Button>
          <form action={signout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-x-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 border-b-2 border-foreground bg-background/95 px-4 py-4 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/admin"
              className="flex min-w-0 items-center gap-2 font-extrabold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
              <span className="min-w-0">Admin</span>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-foreground bg-secondary text-secondary-foreground">
                <Shield className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-9 px-3">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" aria-hidden />
                  App
                </Link>
              </Button>
              <form action={signout}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="size-4" aria-hidden />
                </Button>
              </form>
            </div>
          </div>
          <div className="mt-4">
            <AdminNav horizontal />
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
