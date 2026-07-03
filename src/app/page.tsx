import Link from "next/link";
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
    emoji: "👯",
    title: "Find your pal",
    text: "You and your assigned buddy are a team of two. Sign up with your NUS email and you're linked automatically.",
  },
  {
    emoji: "🎯",
    title: "Pick a task",
    text: "New tasks drop throughout the two weeks. Sunrise missions, food quests, mini games with other teams.",
  },
  {
    emoji: "📸",
    title: "Snap your proof",
    text: "Do the thing, take a photo, add a caption and send it in. Straight from your phone, no printouts, no forms.",
  },
  {
    emoji: "🏆",
    title: "Climb the board",
    text: "RAs review your proof and award points. Watch your team rise on the live leaderboard.",
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
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground"
              aria-hidden
            >
              PG
            </span>
            <span className="text-lg font-extrabold tracking-tight text-primary">
              PGPals
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground sm:flex">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
          </nav>
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
        {/* hero */}
        <section className="flex flex-col items-center py-12 text-center sm:py-16">
          {settings && (
            <span className="mb-5 inline-flex rounded-md border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">
              {formatSGTDate(settings.start_at)} to{" "}
              {formatSGTDate(settings.end_at)} · PGP Residences
            </span>
          )}
          <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
            Two weeks. One buddy.{" "}
            <span className="text-primary">All the bragging rights.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            PGPals is PGPR&apos;s buddy challenge. Team up with your assigned
            pal, complete photo tasks around campus, earn points and race the
            other teams to the top of the board.
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
                  className="rounded-md border bg-card px-3.5 py-1.5 shadow-sm"
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
          <p className="mx-auto mt-2 max-w-md text-center text-muted-foreground">
            Four steps between you and leaderboard glory.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
            <Card key={s.title}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                    <span className="grid size-11 place-items-center rounded-md bg-primary/10 text-2xl">
                      {s.emoji}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {s.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* points and the finale */}
        <section className="py-12">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/30 bg-primary text-primary-foreground md:col-span-2">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-extrabold">
                  Points for everything
                </h3>
                <p className="mt-2 max-w-lg text-primary-foreground/90">
                  Every task is worth points, and speed pays: some tasks give
                  early-bird bonuses to the first few teams that finish. Pair
                  tasks let you team up with another duo so both teams score.
                  RAs can also hand out bonus points for great sportsmanship
                  (and take them away for cheeky business).
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-2xl font-extrabold">Mystery finale</h3>
                <p className="mt-2 text-muted-foreground">
                  The leaderboard goes dark before the closing ceremony.
                  Winners are revealed live, so it&apos;s anyone&apos;s game
                  until the very end.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="scroll-mt-20 py-12">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            Questions, answered
          </h2>
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-lg border bg-card px-5 py-4 shadow-sm open:shadow"
              >
                <summary className="cursor-pointer list-none font-bold [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-6 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* final cta */}
        <section className="py-16 text-center">
          <div
            className="mx-auto grid size-12 place-items-center rounded-lg bg-primary text-base font-extrabold text-primary-foreground"
            aria-hidden
          >
            PG
          </div>
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
