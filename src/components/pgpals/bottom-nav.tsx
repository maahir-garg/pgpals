"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/pgpals/nav-tabs";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-foreground bg-card md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {NAV_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground transition-colors",
                active && "text-primary"
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-12 place-items-center rounded-full transition-bouncy",
                  active && "border-2 border-foreground bg-primary text-primary-foreground"
                )}
                aria-hidden
              >
                <tab.icon className="size-4.5" strokeWidth={2.5} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
