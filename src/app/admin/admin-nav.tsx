"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", emoji: "📊" },
  { href: "/admin/review", label: "Review", emoji: "🔍" },
  { href: "/admin/tasks", label: "Tasks", emoji: "🎯" },
  { href: "/admin/teams", label: "Teams", emoji: "👥" },
  { href: "/admin/announcements", label: "Announcements", emoji: "📣" },
  { href: "/admin/settings", label: "Settings", emoji: "⚙️" },
];

export function AdminNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn(horizontal ? "flex gap-1 pb-1" : "space-y-1")}>
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              horizontal && "shrink-0 whitespace-nowrap",
              active && "bg-primary/10 text-primary"
            )}
          >
            <span aria-hidden>{link.emoji}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
