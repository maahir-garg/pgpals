import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";
import { countdownTo } from "@/lib/datetime";

export function PointsBadge({ points }: { points: number }) {
  return (
    <Badge className="rounded-full bg-secondary text-secondary-foreground hover:bg-secondary">
      ⭐ {points} pts
    </Badge>
  );
}

export function PairBadge() {
  return (
    <Badge className="rounded-full bg-accent text-accent-foreground hover:bg-accent">
      🤝 Pair task
    </Badge>
  );
}

export function BonusBadge() {
  return (
    <Badge className="rounded-full bg-chart-3/25 text-foreground hover:bg-chart-3/25">
      ⚡ Bonus
    </Badge>
  );
}

export function CountdownBadge({ deadline }: { deadline: string }) {
  const { label, urgent } = countdownTo(deadline);
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full",
        urgent && "border-primary/40 bg-primary/10 font-bold text-primary",
        label === "Closed" && "text-muted-foreground"
      )}
    >
      ⏰ {label}
    </Badge>
  );
}

const STATUS_STYLES: Record<
  SubmissionStatus,
  { label: string; className: string }
> = {
  pending: { label: "🕐 In review", className: "bg-chart-3/25 text-foreground" },
  approved: { label: "✅ Approved", className: "bg-chart-5/25 text-foreground" },
  rejected: {
    label: "❌ Needs a fix",
    className: "bg-destructive/15 text-destructive",
  },
  superseded: { label: "↩️ Replaced", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <Badge className={cn("rounded-full hover:opacity-100", s.className)}>
      {s.label}
    </Badge>
  );
}
