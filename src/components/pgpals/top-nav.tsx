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
              "flex items-center gap-1.5 rounded-full border-2 border-transparent px-3.5 py-1 text-sm font-bold text-muted-foreground transition-bouncy hover:bg-muted hover:text-foreground",
              active &&
                "border-foreground bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
