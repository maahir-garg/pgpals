import { BookOpen, House, Target, Trophy, type LucideIcon } from "lucide-react";

// Shared between the phone bottom bar and the desktop top nav.
export const NAV_TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/tasks", label: "Tasks", icon: Target },
  { href: "/guide", label: "Guide", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];
