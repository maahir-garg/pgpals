"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/pgpals/nav-tabs";

// Desktop counterpart of the bottom tab bar; hidden on phones.
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {NAV_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-primary/10 text-primary hover:text-primary"
            )}
          >
            <span className="mr-1" aria-hidden>
              {tab.emoji}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
