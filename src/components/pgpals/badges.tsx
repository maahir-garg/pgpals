import { Check, Clock, Coins, RotateCcw, Users, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";
import { countdownTo } from "@/lib/datetime";

export function PointsBadge({ points }: { points: number }) {
  return (
    <Badge
      className="bg-accent text-accent-foreground hover:bg-accent"
      title="PGP Coins"
    >
      <Coins className="size-3" strokeWidth={2.5} aria-hidden /> {points}
    </Badge>
  );
}

export function PairBadge({ teamCount }: { teamCount?: number }) {
  return (
    <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">
      <Users className="size-3" aria-hidden />
      {teamCount ? `${teamCount}-team task` : "Group task"}
    </Badge>
  );
}

export function BonusBadge() {
  return (
    <Badge className="bg-warning/15 text-warning hover:bg-warning/15">
      <Zap className="size-3 fill-current" aria-hidden /> Bonus
    </Badge>
  );
}

export function CountdownBadge({ deadline }: { deadline: string }) {
  const { label, urgent } = countdownTo(deadline);
  return (
    <Badge
      variant="outline"
      className={cn(
        urgent && "border-destructive/30 bg-destructive/10 font-bold text-destructive",
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
    className: "bg-warning/15 text-warning",
  },
  approved: {
    label: "Approved",
    icon: Check,
    className: "bg-success/15 text-success",
  },
  rejected: {
    label: "Needs a fix",
    icon: X,
    className: "bg-destructive/10 text-destructive",
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
