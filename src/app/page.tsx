import Link from "next/link";
import {
  Camera,
  EyeOff,
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

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: UserPlus,
    title: "Sign up",
    text: "Use the email your RA registered. You'll land on your pre-assigned team of two.",
  },
  {
    icon: Camera,
    title: "Complete tasks",
    text: "New photo challenges drop through the event. Snap your proof and submit with a caption.",
  },
  {
    icon: Trophy,
    title: "Earn points",
    text: "RAs review every submission. Approved tasks add points to your team total.",
  },
  {
    icon: EyeOff,
    title: "Race the board",
    text: "The leaderboard goes dark near the end. Winners are revealed at the closing ceremony.",
  },
];

const PERKS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: "Speed pays",
    text: "Some tasks pay early-bird bonuses to the first teams that finish, or extra points before a cutoff.",
  },
  {
    icon: Users,
    title: "Pair tasks",
    text: "Team up with another duo for joint challenges. One submission, points for both teams.",
  },
];

const FAQS = [
  {
    q: "Who can join?",
    a: "Every PGPR resident. Teams of two are assigned before the event starts, so all you do is sign up with the email your RA registered for you.",
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
    a: "The final stretch is played blind. Rankings vanish a few days before the closing ceremony, so nobody knows who's winning.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. It's a website that works great on your phone. Add it to your home screen if you want the app feel.",
  },
];

export default async function LandingPage() {
  const settings = await getPublicSettings();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <span className="text-lg font-extrabold tracking-tight">
              PGPals
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="flex flex-col items-center py-14 text-center sm:py-20">
          {settings && (
            <span className="mb-6 inline-flex items-center rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground">
              {formatSGTDate(settings.start_at)} –{" "}
              {formatSGTDate(settings.end_at)} · PGP Residences
            </span>
          )}
          <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Two weeks. One buddy.{" "}
            <span className="text-primary">All the bragging rights.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            PGPals is PGPR&apos;s buddy challenge. Team up with your assigned
            pal, complete photo tasks around campus, and race the other teams
            to the top of the board.
          </p>
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="px-7">
              <Link href="/signup">Join with your NUS email</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-7">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-t py-14 sm:py-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-14 sm:pb-16">
          <div className="grid gap-4 sm:grid-cols-2">
            {PERKS.map((perk) => (
              <div
                key={perk.title}
                className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <perk.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold">{perk.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {perk.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t py-14 sm:py-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            Quick answers
          </h2>
          <div className="mx-auto mt-8 max-w-2xl divide-y rounded-xl border bg-card px-5 shadow-sm">
            {FAQS.map((f) => (
              <div key={f.q} className="py-4">
                <h3 className="font-bold">{f.q}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t py-14 text-center sm:py-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            className="mx-auto size-14 rounded-2xl shadow-sm"
          />
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ready when you are
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Your buddy is waiting, and the early tasks are the easy points.
          </p>
          <Button asChild size="lg" className="mt-6 px-8">
            <Link href="/signup">Sign up now</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-7 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>
            Run by the PGPR Resident Assistants. Questions? Ask in your
            block&apos;s Telegram group or find any RA.
          </p>
          <p className="font-semibold">PGPals · PGP Residences, NUS</p>
        </div>
      </footer>
    </div>
  );
}
