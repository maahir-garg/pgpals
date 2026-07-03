import Link from "next/link";
import {
  BookOpen,
  Camera,
  CircleHelp,
  Clock3,
  Handshake,
  Medal,
  Target,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const GUIDE_CARDS = [
  {
    icon: UsersRound,
    title: "Getting started",
    text: "Sign up with your NUS email and get linked with your assigned PGP buddy.",
    links: ["Account setup", "Buddy pairing", "Team name"],
  },
  {
    icon: Target,
    title: "Quest guide",
    text: "Find open tasks, check the rules, and choose what your team wants to complete next.",
    links: ["Quest types", "Deadlines", "Pair tasks"],
  },
  {
    icon: Camera,
    title: "Photo submission",
    text: "Upload your proof, add a short caption, and wait for the RA review.",
    links: ["Photo upload", "Review status", "Resubmissions"],
  },
  {
    icon: Trophy,
    title: "Leaderboard & points",
    text: "Track approved points, bonuses, and team rankings throughout the event.",
    links: ["Point values", "Rankings", "Final reveal"],
  },
] satisfies {
  icon: LucideIcon;
  title: string;
  text: string;
  links: string[];
}[];

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
    q: "How do points work?",
    a: "Each task shows its points up front. Some tasks pay a bonus if you're early, and pair tasks let two teams score together. RAs review every photo before points land.",
  },
  {
    q: "What happens if my submission gets rejected?",
    a: "You get a short note explaining why, and you can resubmit any time before the task deadline. No penalty for trying again.",
  },
  {
    q: "Why does the leaderboard disappear near the end?",
    a: "The final stretch is played blind. Rankings vanish from view a few days before the closing ceremony, so keep pushing: nobody knows who's winning.",
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
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <Link
            href="/"
            className="text-xl font-extrabold tracking-tight text-primary-foreground"
          >
            PGPals
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-bold text-primary-foreground/80 sm:flex">
            <a href="#how" className="hover:text-primary-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="flex flex-col items-center py-10 text-center sm:py-20">
          <span
            className="mb-4 grid size-14 place-items-center rounded-xl bg-secondary text-primary shadow-sm ring-1 ring-border sm:mb-6 sm:size-16"
            aria-hidden
          >
            <BookOpen className="size-7 sm:size-8" />
          </span>
          {settings && (
            <span className="mb-5 inline-flex rounded-md border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm sm:mb-6 sm:text-base">
              {formatSGTDate(settings.start_at)} to{" "}
              {formatSGTDate(settings.end_at)} · PGP Residences
            </span>
          )}
          <h1 className="max-w-4xl text-balance text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Two weeks. One buddy.{" "}
            <span className="text-primary">All the bragging rights.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:mt-6 sm:text-xl sm:leading-9">
            PGPals is PGPR&apos;s buddy challenge. Team up with your assigned
            pal, complete photo tasks around campus, earn points, and race the
            other teams to the top of the board.
          </p>
          <div className="mt-7 flex w-full max-w-xl flex-col gap-3 sm:mt-9 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="h-11 px-8 text-base">
              <Link href="/signup">Join with your NUS email</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-8 text-base"
            >
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 py-12 sm:py-16">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold tracking-tight">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
              Everything you need is split into simple, readable sections.
              Open a quest, submit proof, and keep an eye on your points.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {GUIDE_CARDS.map((card) => (
              <Card key={card.title} className="min-h-72">
                <CardContent className="space-y-5 px-6 sm:px-7">
                  <div className="flex items-start gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                      <card.icon className="size-7" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-2xl font-extrabold tracking-tight">
                        {card.title}
                      </h3>
                      <p className="mt-3 text-lg leading-8 text-muted-foreground">
                        {card.text}
                      </p>
                    </div>
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground marker:text-primary/45">
                    {card.links.map((link) => (
                      <li key={link}>{link}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-primary/20 bg-primary text-primary-foreground">
              <CardContent className="space-y-5 px-6 sm:px-7">
                <span
                  className="grid size-14 place-items-center rounded-lg bg-primary-foreground/15"
                  aria-hidden
                >
                  <Medal className="size-7" />
                </span>
                <div>
                  <h3 className="text-3xl font-extrabold tracking-tight">
                    Points for everything
                  </h3>
                  <p className="mt-3 text-lg leading-8 text-primary-foreground/85">
                    Every task is worth points, and speed pays. Some tasks give
                    early-bird bonuses to the first few teams that finish, and
                    pair tasks let two teams score together.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-5 px-6 sm:px-7">
                <span
                  className="grid size-14 place-items-center rounded-lg bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <Clock3 className="size-7" />
                </span>
                <div>
                  <h3 className="text-3xl font-extrabold tracking-tight">
                    Mystery finale
                  </h3>
                  <p className="mt-3 text-lg leading-8 text-muted-foreground">
                    The leaderboard goes dark before the closing ceremony.
                    Winners are revealed live, so it&apos;s anyone&apos;s game
                    until the very end.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="answers" className="scroll-mt-24 py-12 sm:py-16">
          <div className="text-center">
            <span
              className="mx-auto grid size-14 place-items-center rounded-lg bg-secondary text-primary"
              aria-hidden
            >
              <CircleHelp className="size-7" />
            </span>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight">
              Quick answers
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
              The most common questions, written plainly.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <CardContent className="space-y-3 px-6 sm:px-7">
                  <h3 className="text-xl font-extrabold">{f.q}</h3>
                  <p className="text-base leading-7 text-muted-foreground">
                    {f.a}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-16 text-center sm:py-20">
          <span
            className="mx-auto grid size-16 place-items-center rounded-xl bg-secondary text-primary"
            aria-hidden
          >
            <Handshake className="size-8" />
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight">
            Ready when you are
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-muted-foreground">
            Your buddy is waiting, and the early tasks are the easy points.
          </p>
          <Button asChild size="lg" className="mt-7 h-11 px-10 text-base">
            <Link href="/signup">Sign up now</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>
            Run by the PGPR Resident Assistants.
            <br className="sm:hidden" /> Questions? Ask in your block&apos;s
            Telegram group or find any RA.
          </p>
          <p className="font-semibold">PGPals · PGP Residences, NUS</p>
        </div>
      </footer>
    </div>
  );
}
