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
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground/75 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground",
              active && "bg-primary-foreground/15 text-primary-foreground"
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
