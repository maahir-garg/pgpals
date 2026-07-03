import Link from "next/link";
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
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <Link href="/admin" className="flex items-center gap-1.5 px-2">
          <span className="text-2xl">🐧</span>
          <span className="text-lg font-extrabold text-primary">PGPals</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
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
          <Button asChild variant="outline" size="sm" className="w-full rounded-xl">
            <Link href="/dashboard">← Participant view</Link>
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="font-extrabold text-primary">
              🐧 Admin
            </Link>
            <Link href="/dashboard" className="text-sm font-semibold underline">
              Participant view
            </Link>
          </div>
          <div className="-mx-4 mt-2 overflow-x-auto px-4">
            <AdminNav horizontal />
          </div>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
