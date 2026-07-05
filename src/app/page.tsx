import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Gift,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSGTDate } from "@/lib/datetime";
import {
  LUCKY_DRAW,
  PARTICIPATION_REWARD,
  PRIZE_CEREMONY_LABEL,
  PRIZE_POOL_VALUE_LABEL,
  PRIZE_REVEAL_TEASER,
  PRIZE_TIERS,
  PRIZE_WINNER_COUNT,
} from "@/lib/prizes";
import type { EventSettings } from "@/lib/types";

export const revalidate = 300;

// Public landing page. Logged-in visitors are bounced to /dashboard by the
// middleware, so everyone here is logged out. Event dates are read with the
// admin client because anon has no table access; nothing sensitive is shown.
async function getPublicSettings(): Promise<EventSettings | null> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("event_settings")
      .select("*")
      .eq("id", 1)
      .single<EventSettings>();
    return data;
  } catch {
    return null;
  }
}

function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 12"
      fill="none"
      aria-hidden
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M2 8c8-8 12 8 20 0s12 8 20 0 12 8 20 0 12 8 20 0 12 8 20 0 12 8 16 2"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const STEPS: {
  icon: LucideIcon;
  title: string;
  text: string;
  color: string;
}[] = [
  {
    icon: UserPlus,
    title: "Sign up",
    text: "Use the email your RA registered. You'll land on your pre-assigned team of two.",
    color: "bg-primary text-primary-foreground",
  },
  {
    icon: Camera,
    title: "Complete tasks",
    text: "New photo challenges drop through the event. Snap your proof and submit with a caption.",
    color: "bg-secondary text-secondary-foreground",
  },
  {
    icon: Trophy,
    title: "Earn PGP Coins",
    text: "RAs review every submission. Approved tasks add PGP Coins to your team total.",
    color: "bg-accent text-accent-foreground",
  },
  {
    icon: Gift,
    title: `Win ${PRIZE_POOL_VALUE_LABEL} in prizes`,
    text: `Top ${PRIZE_WINNER_COUNT} teams win from the tech prize pool, and everyone is in the AirPods lucky draw.`,
    color: "bg-mint text-foreground",
  },
];

const PERKS: { icon: LucideIcon; title: string; text: string; iconBg: string }[] = [
  {
    icon: Zap,
    title: "Speed pays",
    text: "Some tasks pay early-bird bonuses to the first teams that finish, or extra coins before a cutoff.",
    iconBg: "bg-accent text-accent-foreground",
  },
  {
    icon: Users,
    title: "Pair tasks",
    text: "Team up with another duo for joint challenges. One submission, coins for both teams.",
    iconBg: "bg-secondary text-secondary-foreground",
  },
];

const FAQS = [
  {
    q: "Who can join?",
    a: "Every PGPR resident. Teams of two are assigned before the event starts, so all you do is sign up with the email your RA registered for you.",
  },
  {
    q: "What can we win?",
    a: `Win ${PRIZE_POOL_VALUE_LABEL} in prizes: top ${PRIZE_WINNER_COUNT} teams chase an iPad-led tech pool with monitors, Sony headphones, projectors and more. Exact rank prizes are saved for the finale reveal on ${PRIZE_CEREMONY_LABEL}. Everyone who participates gets a goodie bag and a shot at the AirPods lucky draw.`,
  },
  {
    q: "What if my email isn't recognised at signup?",
    a: "Your signup email has to match the one on the roster. If it refuses you, message your RA and they can fix it in a minute.",
  },
  {
    q: "What happens if my submission gets rejected?",
    a: "You get a short note explaining why, and you can resubmit any time before the task deadline. No penalty for trying again.",
  },
  {
    q: "Why does the leaderboard disappear near the end?",
    a: "The final stretch is played blind. Rankings vanish a few days before the finale, so nobody knows who's winning until the prizes come out.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. It's a website that works great on your phone. Add it to your home screen if you want the app feel.",
  },
];

export default async function LandingPage() {
  const settings = await getPublicSettings();

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg sm:size-9" />
            <span className="font-heading text-lg font-extrabold tracking-tight sm:text-xl">
              PGPals
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button asChild variant="outline" size="sm" className="px-3 sm:px-4">
              <Link href="/signup">Sign up</Link>
            </Button>
            <Button asChild size="sm" className="px-4 sm:h-10 sm:px-5">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl min-w-0 px-4">
        {/* Hero: content left, penguin sticker right, confetti behind. */}
        <section className="relative py-8 sm:py-24">
          {/* Decorative shapes: hidden on phones so they never crowd text. */}
          <div
            aria-hidden
            className="absolute -top-6 right-[8%] hidden size-40 rounded-full bg-accent/60 lg:block"
          />
          <div
            aria-hidden
            className="absolute bottom-10 right-[30%] hidden size-6 rotate-12 rounded-sm bg-secondary lg:block"
          />
          <div
            aria-hidden
            className="absolute top-24 right-[38%] hidden size-4 rounded-full bg-mint lg:block"
          />
          <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                {settings && (
                  <span className="inline-flex min-w-0 rotate-[-1.5deg] items-center rounded-full border-2 border-foreground bg-card px-2.5 py-1.5 text-[10px] font-bold leading-snug shadow-pop-sm min-[360px]:text-[11px]">
                    {formatSGTDate(settings.start_at)} –{" "}
                    {formatSGTDate(settings.end_at)} · PGP Residences
                  </span>
                )}
                <div className="relative ml-auto shrink-0">
                  <div
                    aria-hidden
                    className="bg-dots absolute -inset-2 rounded-2xl opacity-70"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icon.svg"
                    alt=""
                    className="relative size-16 rotate-[-3deg] rounded-2xl border-2 border-foreground bg-primary p-1.5 shadow-pop sm:size-20"
                  />
                </div>
              </div>
              {settings && (
                <span className="hidden max-w-full rotate-[-1.5deg] items-center rounded-full border-2 border-foreground bg-card px-4 py-1.5 text-sm font-bold leading-snug shadow-pop-sm lg:inline-flex">
                  {formatSGTDate(settings.start_at)} –{" "}
                  {formatSGTDate(settings.end_at)} · PGP Residences
                </span>
              )}
              <h1 className="mt-4 max-w-3xl font-heading text-[1.5rem] font-extrabold leading-[1.05] tracking-normal min-[360px]:text-[1.75rem] min-[430px]:text-[2rem] sm:mt-6 sm:text-5xl xl:text-6xl">
                <span className="block whitespace-nowrap">
                  Two weeks. One buddy.
                </span>
                {" "}
                <span className="relative inline-block whitespace-nowrap text-primary">
                  Win {PRIZE_POOL_VALUE_LABEL} in prizes.
                  <Squiggle className="absolute -bottom-2 left-0 h-3 w-full text-secondary sm:-bottom-3" />
                </span>
              </h1>
              <p className="mt-4 max-w-lg text-pretty text-base leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
                PGPals is PGPR&apos;s buddy challenge. Team up with your
                assigned pal, complete photo tasks around campus, and race the
                other teams to the top. The {PRIZE_POOL_VALUE_LABEL} prize
                pool goes {PRIZE_WINNER_COUNT} teams deep with an iPad grand
                prize, monitors, Sony headphones, projectors and more in play.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:gap-4">
                <Button asChild size="lg">
                  <Link href="/login">
                    I have an account
                    <span className="grid size-6 place-items-center rounded-full bg-primary-foreground text-primary">
                      <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
                    </span>
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/signup">Join with your NUS email</Link>
                </Button>
              </div>
            </div>
            <div className="relative mx-auto hidden lg:block">
              <div aria-hidden className="bg-dots absolute -inset-8 rounded-3xl" />
              <div className="relative rotate-2 rounded-3xl border-2 border-foreground bg-primary p-6 shadow-pop-lg transition-bouncy hover:rotate-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="The PGPals penguin" className="size-64 rounded-2xl" />
              </div>
              <span className="absolute -right-6 -top-6 rotate-12 rounded-full border-2 border-foreground bg-accent px-4 py-2 font-heading text-sm font-extrabold shadow-pop-sm">
                Prizes!
              </span>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 border-t-2 border-dashed border-foreground/25 py-12 sm:py-20">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <Squiggle className="mx-auto mt-3 h-3 w-36 text-primary" />
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 gap-y-10 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative min-w-0 rounded-xl border-2 border-foreground bg-card px-4 pb-4 pt-8 shadow-sticker transition-bouncy hover:-rotate-1 hover:scale-[1.02] sm:px-6 sm:pb-6 sm:pt-10"
              >
                {/* Icon circle sits half-in/half-out of the top border. */}
                <span
                  className={`absolute -top-5 left-4 grid size-11 place-items-center rounded-full border-2 border-foreground sm:-top-6 sm:left-6 sm:size-12 ${step.color}`}
                >
                  <step.icon className="size-5.5" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="absolute right-4 top-3 font-heading text-sm font-extrabold text-muted-foreground/60">
                  0{i + 1}
                </span>
                <h3 className="font-heading text-lg font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Prize spotlight: the messaging is hardcoded in src/lib/prizes.ts. */}
        <section className="pb-12 sm:pb-20">
          <div className="relative overflow-hidden rounded-2xl border-2 border-foreground bg-primary px-6 py-8 text-primary-foreground shadow-pop sm:px-12 sm:py-10">
            <div aria-hidden className="bg-dots absolute inset-0 opacity-20" />
            <div
              aria-hidden
              className="absolute -right-10 -top-10 hidden size-40 rounded-full bg-accent/90 sm:block"
            />
            <div
              aria-hidden
              className="absolute -bottom-8 right-24 hidden size-20 rounded-full bg-secondary sm:block"
            />
            <div className="relative">
              <span className="inline-flex rotate-[-2deg] items-center gap-1.5 rounded-full border-2 border-foreground bg-accent px-3 py-1.5 font-heading text-xs font-extrabold text-accent-foreground shadow-pop-sm sm:px-4 sm:text-sm">
                <Gift className="size-4" strokeWidth={2.5} aria-hidden />
                PRIZE CEREMONY · {PRIZE_CEREMONY_LABEL.toUpperCase()}
              </span>
              <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:mt-6 sm:text-4xl">
                Win {PRIZE_POOL_VALUE_LABEL} in prizes
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-primary-foreground/90 sm:text-lg">
                The leaderboard goes dark for the final stretch, so the final
                push stays electric. Keep climbing even if you are outside the
                podium: prizes stretch all the way to 8th.
              </p>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-primary-foreground/85 sm:text-base">
                {PRIZE_REVEAL_TEASER}
              </p>
              <div className="mt-8 grid gap-4 gap-y-6 sm:grid-cols-3">
                {PRIZE_TIERS.map((tier, i) => (
                  <div
                    key={tier.place}
                    className={`min-w-0 rounded-xl border-2 border-foreground p-5 shadow-pop-sm transition-bouncy hover:scale-[1.02] ${tier.color} ${
                      i === 0 ? "sm:-rotate-1" : i === 2 ? "sm:rotate-1" : ""
                    }`}
                  >
                    <span className="inline-flex rounded-full border-2 border-foreground bg-card px-2.5 py-0.5 font-heading text-xs font-extrabold text-foreground">
                      {tier.place} place
                    </span>
                    <div className="mt-3 font-heading text-2xl font-extrabold">
                      {tier.prize}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-5 opacity-85">
                      {tier.blurb}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl border-2 border-dashed border-primary-foreground/50 bg-primary-foreground/10 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-foreground bg-mint text-foreground">
                  <Sparkles className="size-4" strokeWidth={2.5} aria-hidden />
                </span>
                <p className="text-sm font-semibold leading-6">
                  <span className="font-heading font-extrabold">
                    {PARTICIPATION_REWARD.prize}.
                  </span>{" "}
                  {PARTICIPATION_REWARD.blurb} {LUCKY_DRAW.blurb}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {PERKS.map((perk) => (
              <div
                key={perk.title}
                className="flex min-w-0 items-start gap-3 rounded-xl border-2 border-foreground bg-card p-4 shadow-sticker transition-bouncy hover:rotate-1 hover:scale-[1.02] sm:gap-4 sm:p-6"
              >
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground ${perk.iconBg}`}
                >
                  <perk.icon className="size-5.5" strokeWidth={2.5} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-lg font-bold">{perk.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {perk.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t-2 border-dashed border-foreground/25 py-12 sm:py-20">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              Quick answers
            </h2>
            <Squiggle className="mx-auto mt-3 h-3 w-36 text-secondary" />
          </div>
          <div className="mx-auto mt-8 max-w-2xl divide-y-2 divide-dashed divide-border rounded-xl border-2 border-foreground bg-card px-4 shadow-sticker sm:mt-10 sm:px-6">
            {FAQS.map((f) => (
              <div key={f.q} className="py-6">
                <h3 className="font-heading font-bold">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative pb-16 pt-2 text-center sm:pb-24">
          <div
            aria-hidden
            className="absolute left-[12%] top-8 hidden size-5 rotate-45 bg-mint sm:block"
          />
          <div
            aria-hidden
            className="absolute right-[15%] top-16 hidden size-4 rounded-full bg-secondary sm:block"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            className="mx-auto size-16 rotate-[-3deg] rounded-2xl border-2 border-foreground shadow-pop"
          />
          <h2 className="mt-6 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready when you are
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Your buddy is waiting, the early tasks are the easy coins, and the
            prize table won&apos;t fill itself.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/login">
                Log in
                <span className="grid size-6 place-items-center rounded-full bg-primary-foreground text-primary">
                  <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">
                Sign up
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-foreground bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>
            Run by the PGPR Resident Assistants. Questions? Ask in your
            block&apos;s Telegram group or find any RA.
          </p>
          <p className="font-bold">PGPals · PGP Residences, NUS</p>
        </div>
      </footer>
    </div>
  );
}
