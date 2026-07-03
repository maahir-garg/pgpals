import { Check, Clock, RotateCcw, Star, Users, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";
import { countdownTo } from "@/lib/datetime";

export function PointsBadge({ points }: { points: number }) {
  return (
    <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">
      <Star className="size-3 fill-current" aria-hidden /> {points} pts
    </Badge>
  );
}

export function PairBadge() {
  return (
    <Badge className="bg-accent text-accent-foreground hover:bg-accent">
      <Users className="size-3" aria-hidden /> Pair task
    </Badge>
  );
}

export function BonusBadge() {
  return (
    <Badge className="bg-chart-3/25 text-foreground hover:bg-chart-3/25">
      <Zap className="size-3" aria-hidden /> Bonus
    </Badge>
  );
}

export function CountdownBadge({ deadline }: { deadline: string }) {
  const { label, urgent } = countdownTo(deadline);
  return (
    <Badge
      variant="outline"
      className={cn(
        "",
        urgent && "border-primary/40 bg-primary/10 font-bold text-primary",
        label === "Closed" && "text-muted-foreground"
      )}
    >
      <Clock className="size-3" aria-hidden /> {label}
    </Badge>
  );
}

const STATUS_STYLES: Record<
  SubmissionStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  pending: {
    label: "In review",
    icon: Clock,
    className: "bg-chart-3/25 text-foreground",
  },
  approved: {
    label: "Approved",
    icon: Check,
    className: "bg-chart-5/25 text-foreground",
  },
  rejected: {
    label: "Needs a fix",
    icon: X,
    className: "bg-destructive/15 text-destructive",
  },
  superseded: {
    label: "Replaced",
    icon: RotateCcw,
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <Badge className={cn("hover:opacity-100", s.className)}>
      <s.icon className="size-3" aria-hidden /> {s.label}
    </Badge>
  );
}
