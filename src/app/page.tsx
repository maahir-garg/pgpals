import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Gift,
  Trophy,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSGTDate } from "@/lib/datetime";
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
    title: "Earn points",
    text: "RAs review every submission. Approved tasks add points to your team total.",
    color: "bg-accent text-accent-foreground",
  },
  {
    icon: Gift,
    title: "Win prizes",
    text: "The board goes dark near the end, and the top teams take home prizes at the closing ceremony.",
    color: "bg-mint text-foreground",
  },
];

const PERKS: { icon: LucideIcon; title: string; text: string; iconBg: string }[] = [
  {
    icon: Zap,
    title: "Speed pays",
    text: "Some tasks pay early-bird bonuses to the first teams that finish, or extra points before a cutoff.",
    iconBg: "bg-accent text-accent-foreground",
  },
  {
    icon: Users,
    title: "Pair tasks",
    text: "Team up with another duo for joint challenges. One submission, points for both teams.",
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
    a: "Seriously exciting prizes for the top teams, handed out at the closing ceremony. The exact loot stays secret until then, which is half the fun.",
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
    a: "The final stretch is played blind. Rankings vanish a few days before the closing ceremony, so nobody knows who's winning until the prizes come out.",
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-9 rounded-lg" />
            <span className="font-heading text-xl font-extrabold tracking-tight">
              PGPals
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* Hero: content left, penguin sticker right, confetti behind. */}
        <section className="relative py-14 sm:py-24">
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
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              {settings && (
                <span className="inline-flex rotate-[-1.5deg] items-center rounded-full border-2 border-foreground bg-card px-4 py-1.5 text-sm font-bold shadow-pop-sm">
                  {formatSGTDate(settings.start_at)} –{" "}
                  {formatSGTDate(settings.end_at)} · PGP Residences
                </span>
              )}
              <h1 className="mt-6 max-w-xl text-balance font-heading text-4xl font-extrabold tracking-tight sm:text-6xl">
                Two weeks. One buddy.{" "}
                <span className="relative inline-block text-primary">
                  Real prizes.
                  <Squiggle className="absolute -bottom-3 left-0 h-3 w-full text-secondary" />
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                PGPals is PGPR&apos;s buddy challenge. Team up with your
                assigned pal, complete photo tasks around campus, and race the
                other teams to the top — the winners walk away with seriously
                exciting prizes.
              </p>
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Join with your NUS email
                    <span className="grid size-6 place-items-center rounded-full bg-primary-foreground text-primary">
                      <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
                    </span>
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">I have an account</Link>
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

        <section id="how" className="scroll-mt-24 border-t-2 border-dashed border-foreground/25 py-14 sm:py-20">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <Squiggle className="mx-auto mt-3 h-3 w-36 text-primary" />
          </div>
          <div className="mt-12 grid gap-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-xl border-2 border-foreground bg-card px-5 pb-5 pt-9 shadow-sticker transition-bouncy hover:-rotate-1 hover:scale-[1.02]"
              >
                {/* Icon circle sits half-in/half-out of the top border. */}
                <span
                  className={`absolute -top-6 left-5 grid size-12 place-items-center rounded-full border-2 border-foreground ${step.color}`}
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

        {/* Prize spotlight */}
        <section className="pb-14 sm:pb-20">
          <div className="relative overflow-hidden rounded-2xl border-2 border-foreground bg-primary px-6 py-10 text-primary-foreground shadow-pop sm:px-12">
            <div aria-hidden className="bg-dots absolute inset-0 opacity-20" />
            <div
              aria-hidden
              className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/90"
            />
            <div
              aria-hidden
              className="absolute -bottom-8 right-24 hidden size-20 rounded-full bg-secondary sm:block"
            />
            <div className="relative max-w-xl">
              <span className="inline-flex rotate-[-2deg] items-center gap-1.5 rounded-full border-2 border-foreground bg-accent px-4 py-1.5 font-heading text-sm font-extrabold text-accent-foreground shadow-pop-sm">
                <Gift className="size-4" strokeWidth={2.5} aria-hidden />
                EXCITING PRIZES
              </span>
              <h2 className="mt-5 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                Play for the podium
              </h2>
              <p className="mt-3 text-base leading-7 text-primary-foreground/90 sm:text-lg">
                The top teams win prizes at the closing ceremony — and because
                the leaderboard goes dark for the final stretch, every team is
                still in the running until the very end. Every point you bank
                counts.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-14 sm:pb-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {PERKS.map((perk) => (
              <div
                key={perk.title}
                className="flex gap-4 rounded-xl border-2 border-foreground bg-card p-5 shadow-sticker transition-bouncy hover:rotate-1 hover:scale-[1.02]"
              >
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground ${perk.iconBg}`}
                >
                  <perk.icon className="size-5.5" strokeWidth={2.5} aria-hidden />
                </span>
                <div>
                  <h3 className="font-heading text-lg font-bold">{perk.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {perk.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t-2 border-dashed border-foreground/25 py-14 sm:py-20">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              Quick answers
            </h2>
            <Squiggle className="mx-auto mt-3 h-3 w-36 text-secondary" />
          </div>
          <div className="mx-auto mt-10 max-w-2xl divide-y-2 divide-dashed divide-border rounded-xl border-2 border-foreground bg-card px-6 shadow-sticker">
            {FAQS.map((f) => (
              <div key={f.q} className="py-5">
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
            Your buddy is waiting, the early tasks are the easy points, and the
            prize table won&apos;t fill itself.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/signup">
              Sign up now
              <span className="grid size-6 place-items-center rounded-full bg-primary-foreground text-primary">
                <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t-2 border-foreground bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-7 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
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
