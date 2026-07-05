// Hardcoded prize messaging for the 2026 run. The confirmed items are teased
// here, while exact rank allocations stay a ceremony reveal until purchases
// and quantities are locked.
// The ceremony date is display copy only; the event window itself lives in
// event_settings and is edited in Admin -> Settings.

export const PRIZE_CEREMONY_LABEL = "17 September";
export const PRIZE_WINNER_COUNT = 8;
export const PRIZE_TEASER_ITEMS = [
  "iPads",
  "monitors",
  "AirPods",
  "projectors",
] as const;

export const PRIZE_TIERS = [
  {
    place: "1st",
    prize: "Grand tech reveal",
    blurb: "The champion team gets the headline reward from the premium pool.",
    color: "bg-accent text-accent-foreground",
  },
  {
    place: "2nd-3rd",
    prize: "Podium tech bundles",
    blurb: "iPads, monitors, AirPods and projectors are all in the mix.",
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

export const PRIZE_REVEAL_TEASER = `The pool includes ${PRIZE_TEASER_ITEMS.join(", ")} and more. Exact rank prizes are revealed at the ceremony on ${PRIZE_CEREMONY_LABEL}.`;

// One-liner for tight spots like the dashboard sidebar card.
export const PRIZE_TAGLINE = `Top ${PRIZE_WINNER_COUNT} teams win from a tech prize pool with ${PRIZE_TEASER_ITEMS.join(", ")} and more. Every participant gets a goodie bag.`;
