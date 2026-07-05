// Hardcoded prize messaging for the 2026 run. The confirmed items are teased
// here, while exact rank allocations stay a ceremony reveal until purchases
// and quantities are locked. AirPods are the all-participant lucky draw, not
// part of the ranked top-8 pool.
// The ceremony date is display copy only; the event window itself lives in
// event_settings and is edited in Admin -> Settings.

export const PRIZE_CEREMONY_LABEL = "17 September";
export const PRIZE_WINNER_COUNT = 8;
export const PRIZE_POOL_VALUE_LABEL = "S$5,000+";
export const PRIZE_TEASER_ITEMS = [
  "an iPad grand prize",
  "monitors",
  "Sony headphones",
  "projectors",
] as const;

export const PRIZE_TIERS = [
  {
    place: "1st",
    prize: "iPad grand prize",
    blurb: `The champion team leads the ${PRIZE_POOL_VALUE_LABEL} reveal with the headline iPad prize.`,
    color: "bg-accent text-accent-foreground",
  },
  {
    place: "2nd-3rd",
    prize: "Podium tech bundles",
    blurb: "Monitors, Sony headphones and projectors are all in the mix.",
    color: "bg-secondary text-secondary-foreground",
  },
  {
    place: "4th-8th",
    prize: "More winner rewards",
    blurb: "Five more teams still win real prizes beyond the podium.",
    color: "bg-mint text-foreground",
  },
] as const;

export const PARTICIPATION_REWARD = {
  prize: "Participation goodie bags",
  blurb: "Every participant gets a goodie bag, no leaderboard finish required.",
} as const;

export const LUCKY_DRAW = {
  prize: "AirPods",
  blurb: `Every participant is in the AirPods lucky draw at the ceremony on ${PRIZE_CEREMONY_LABEL}.`,
} as const;

export const PRIZE_REVEAL_TEASER = `The ${PRIZE_POOL_VALUE_LABEL} pool includes ${PRIZE_TEASER_ITEMS.join(", ")} and more. Exact rank prizes are revealed at the ceremony on ${PRIZE_CEREMONY_LABEL}.`;

// One-liner for tight spots like the dashboard sidebar card.
export const PRIZE_TAGLINE = `Win ${PRIZE_POOL_VALUE_LABEL} in prizes: top ${PRIZE_WINNER_COUNT} teams chase an iPad-led tech pool, everyone is in the AirPods lucky draw, and every participant gets a goodie bag.`;
