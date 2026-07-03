import type { BonusConfig } from "@/lib/types";
import { formatSGT } from "@/lib/datetime";

// Participant-facing description of a task's bonus rule.
export function describeBonus(config: BonusConfig | null): string | null {
  if (!config) return null;
  switch (config.kind) {
    case "first_n":
      return `⚡ Early bird: the first ${config.n} approved submissions earn +${config.bonus} bonus points!`;
    case "before":
      return `⚡ Submit before ${formatSGT(config.cutoff)} to earn +${config.bonus} bonus points!`;
    case "multiplier_before":
      return `⚡ Submit before ${formatSGT(config.cutoff)} for ${config.multiplier}× points!`;
    default:
      return null;
  }
}
