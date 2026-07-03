"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/pgpals/nav-tabs";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {NAV_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors",
                active && "text-primary"
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors",
                  active && "bg-primary/10"
                )}
                aria-hidden
              >
                <tab.icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
