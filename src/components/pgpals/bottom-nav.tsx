"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/pgpals/nav-tabs";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {NAV_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted-foreground transition-colors",
                active && "text-primary"
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-2xl text-lg transition-all",
                  active && "bg-primary/10 scale-110"
                )}
                aria-hidden
              >
                {tab.emoji}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
