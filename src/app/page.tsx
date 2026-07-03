import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Handshake,
  Medal,
  Sparkles,
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

const STEPS = [
  {
    icon: UsersRound,
    title: "Find your pal",
    text: "You and your assigned buddy are a team of two. Sign up with your NUS email and you're linked automatically.",
    links: ["NUS email signup", "Buddy assignment", "Team name setup"],
  },
  {
    icon: Target,
    title: "Pick a task",
    text: "New tasks drop throughout the two weeks. Sunrise missions, food quests, mini games with other teams.",
    links: ["Daily tasks", "Pair quests", "Early bonuses"],
  },
  {
    icon: Camera,
    title: "Snap your proof",
    text: "Do the thing, take a photo, add a caption and send it in. Straight from your phone, no printouts, no forms.",
    links: ["Photo upload", "RA review", "Resubmission notes"],
  },
  {
    icon: Trophy,
    title: "Climb the board",
    text: "RAs review your proof and award points. Watch your team rise on the live leaderboard.",
    links: ["Live rankings", "Point history", "Final reveal"],
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-xl font-extrabold tracking-tight text-primary-foreground"
          >
            PGPals
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-primary-foreground/75 sm:flex">
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

      <main className="mx-auto max-w-5xl px-4">
        {/* hero */}
        <section className="flex flex-col items-center py-12 text-center sm:py-14">
          <span
            className="mb-5 grid size-12 place-items-center rounded-lg bg-secondary text-primary shadow-sm ring-1 ring-border"
            aria-hidden
          >
            <Sparkles className="size-6" />
          </span>
          {settings && (
            <span className="mb-5 inline-flex rounded-md border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">
              {formatSGTDate(settings.start_at)} to{" "}
              {formatSGTDate(settings.end_at)} · PGP Residences
            </span>
          )}
          <h1 className="max-w-2xl text-balance text-5xl font-extrabold tracking-tight sm:text-6xl">
            PGPals
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Two weeks, one buddy, and a campus full of photo quests. Complete
            tasks around PGPR, earn points, and race other teams to the final
            leaderboard reveal.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8 text-base">
              <Link href="/signup">Join with your NUS email</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-8 text-base"
            >
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
            {["Sunrise missions", "Food quests", "Pair challenges", "Bonus points", "Mystery finale"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-md border bg-card px-3.5 py-1.5 text-muted-foreground shadow-sm"
                >
                  {chip}
                </span>
              )
            )}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="scroll-mt-20 py-10">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
            The whole game is four plain steps, with enough structure to know
            what to do next.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Card
                key={s.title}
                className="transition-colors hover:bg-secondary/40"
              >
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase text-muted-foreground">
                        Step {i + 1}
                      </span>
                      <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{s.text}</p>
                  <ul className="space-y-2 border-t pt-3">
                    {s.links.map((link) => (
                      <li
                        key={link}
                        className="flex items-center gap-2 text-sm font-semibold"
                      >
                        <CheckCircle2
                          className="size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        {link}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* points and the finale */}
        <section className="py-12">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20 bg-primary text-primary-foreground md:col-span-2">
              <CardContent className="space-y-4">
                <span
                  className="grid size-10 place-items-center rounded-md bg-primary-foreground/15"
                  aria-hidden
                >
                  <Medal className="size-5" />
                </span>
                <div>
                  <h3 className="text-2xl font-extrabold">
                    Points for everything
                  </h3>
                  <p className="mt-2 max-w-lg text-primary-foreground/85">
                    Every task is worth points, and speed pays: some tasks give
                    early-bird bonuses to the first few teams that finish. Pair
                    tasks let you team up with another duo so both teams score.
                    RAs can also hand out bonus points for standout team play.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4">
                <span
                  className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <Clock3 className="size-5" />
                </span>
                <div>
                  <h3 className="text-2xl font-extrabold">Mystery finale</h3>
                  <p className="mt-2 text-muted-foreground">
                    The leaderboard goes dark before the closing ceremony.
                    Winners are revealed live, so it&apos;s anyone&apos;s game
                    until the very end.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* quick answers */}
        <section id="answers" className="scroll-mt-20 py-12">
          <div className="text-center">
            <span
              className="mx-auto grid size-10 place-items-center rounded-md bg-secondary text-primary"
              aria-hidden
            >
              <CircleHelp className="size-5" />
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              Quick answers
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              The important bits, without making you dig through instructions.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <CardContent className="space-y-2">
                  <h3 className="font-bold">{f.q}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {f.a}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* final cta */}
        <section className="py-16 text-center">
          <span
            className="mx-auto grid size-12 place-items-center rounded-lg bg-secondary text-primary"
            aria-hidden
          >
            <Handshake className="size-6" />
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
            Ready when you are
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Your buddy is waiting, and the early tasks are the easy points.
          </p>
          <Button asChild size="lg" className="mt-6 px-10 text-base">
            <Link href="/signup">Sign up now</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t bg-card/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
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
