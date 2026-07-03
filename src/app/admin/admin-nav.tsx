"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/review", label: "Review", icon: ClipboardCheck },
  { href: "/admin/tasks", label: "Tasks", icon: Target },
  { href: "/admin/teams", label: "Teams", icon: Users },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        horizontal
          ? "grid grid-cols-3 gap-2 rounded-xl border-2 border-foreground bg-card p-2 shadow-pop-sm"
          : "space-y-1"
      )}
    >
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
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              horizontal &&
                "min-w-0 flex-col justify-center gap-1 rounded-lg border-2 border-transparent px-1.5 py-2 text-center text-[11px] leading-tight",
              active &&
                (horizontal
                  ? "border-foreground bg-primary text-primary-foreground shadow-pop-sm hover:bg-primary hover:text-primary-foreground"
                  : "bg-primary/10 text-primary")
            )}
          >
            <link.icon
              className={cn("size-4 shrink-0", horizontal && "size-4.5")}
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="min-w-0 truncate">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
