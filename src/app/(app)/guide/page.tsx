import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Coins,
  ImageUp,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmergencyContactsCard } from "@/components/pgpals/emergency-contacts";

export const metadata: Metadata = { title: "How it works" };

const playSteps = [
  {
    icon: ListChecks,
    title: "Pick an open task",
    body: "Check the instructions, PGP Coins, deadline, and whether it is a normal or multi-team challenge.",
  },
  {
    icon: ImageUp,
    title: "Complete it and submit proof",
    body: "Add a caption and up to five photos or videos. You can include at most three videos, each up to 60 seconds and 50 MB. For faster uploads, compress each video to under 5 MB when possible.",
  },
  {
    icon: ShieldCheck,
    title: "Wait for RA review",
    body: "An RA approves the proof and awards the coins, or explains what needs fixing. Rejected proof can be resubmitted before the deadline.",
  },
  {
    icon: Coins,
    title: "Climb with your team",
    body: "Approved task coins and RA bonuses build your team score. The leaderboard may go dark near the finale, but your own score stays visible.",
  },
] as const;

const helpItems = [
  {
    question: "I’m on the wrong team or my teammate is missing.",
    answer:
      "Tell your RA. They can correct or move roster entries; you do not need to make a new account.",
  },
  {
    question: "How do multi-team challenges work?",
    answer:
      "One team sends the invite and every invited team must accept. Once the group is ready, one shared submission counts for all participating teams.",
  },
  {
    question: "My upload is failing.",
    answer:
      "Check your connection and the limits shown on the submission form. Videos must be MP4, MOV, or WebM. We recommend compressing each clip to under 5 MB for a faster, more reliable mobile upload.",
  },
  {
    question: "My submission was rejected.",
    answer:
      "Open the task to read the RA’s reason, fix the proof, and submit again before the deadline. Only one submission can be waiting for review at a time.",
  },
  {
    question: "I forgot my password.",
    answer:
      "Use “Forgot password?” on the login page with your rostered email. If the reset message does not arrive, check spam and then contact your RA.",
  },
] as const;

function HelpItem({ item }: { item: (typeof helpItems)[number] }) {
  return (
    <details className="group rounded-xl border-2 border-foreground bg-card shadow-sticker">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold marker:content-none">
        {item.question}
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted transition-transform group-open:rotate-180">
          <ChevronDown className="size-3.5" aria-hidden />
        </span>
      </summary>
      <p className="border-t-2 border-dashed border-foreground/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {item.answer}
      </p>
    </details>
  );
}

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border-2 border-foreground bg-primary p-6 text-primary-foreground shadow-pop md:p-8">
        <div
          className="absolute -right-8 -top-8 size-36 rotate-12 rounded-3xl border-2 border-foreground bg-accent opacity-90"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <Badge className="border-primary-foreground bg-primary-foreground text-primary">
            Start here
          </Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            How the Challenge works
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium text-primary-foreground/85 md:text-base">
            Tackle challenges with your pal, send genuine proof, and turn
            approved submissions into PGP Coins.
          </p>
        </div>
      </section>

      <EmergencyContactsCard />

      <section className="space-y-4" aria-labelledby="challenge-loop">
        <div>
          <p className="text-sm font-bold text-primary">The challenge loop</p>
          <h2 id="challenge-loop" className="text-2xl font-extrabold tracking-tight">
            Task, proof, review, coins
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {playSteps.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-4 rounded-xl border-2 border-foreground bg-card p-4 shadow-sticker"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-heading text-lg font-extrabold">
                {index + 1}
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-extrabold">
                  <step.icon className="size-4 text-primary" strokeWidth={2.5} aria-hidden />
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Button asChild>
          <Link href="/tasks">
            See the challenge board
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-accent">
          <CardContent>
            <CalendarClock className="size-6" strokeWidth={2.5} aria-hidden />
            <h2 className="mt-3 text-lg font-extrabold">Deadlines use SGT</h2>
            <p className="mt-1 text-sm text-accent-foreground/80">
              Submit before the time shown on each task. Closed tasks cannot
              accept late proof.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-mint">
          <CardContent>
            <Bot className="size-6" strokeWidth={2.5} aria-hidden />
            <h2 className="mt-3 text-lg font-extrabold">Keep proof genuine</h2>
            <p className="mt-1 text-sm text-foreground/75">
              Uploads are checked for known AI-generation markers, and RAs may
              reject suspicious or misleading media. Submit real moments from
              your team.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-secondary text-secondary-foreground">
          <CardContent>
            <Sparkles className="size-6" strokeWidth={2.5} aria-hidden />
            <h2 className="mt-3 text-lg font-extrabold">One approval per task</h2>
            <p className="mt-1 text-sm text-secondary-foreground/80">
              Each task earns coins once. Focus on completing more challenges,
              not repeating an approved one.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="need-help">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground">
            <CircleHelp className="size-5" strokeWidth={2.5} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-primary">Quick help</p>
            <h2 id="need-help" className="text-2xl font-extrabold tracking-tight">
              When something doesn’t look right
            </h2>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {helpItems.map((item) => (
            <HelpItem key={item.question} item={item} />
          ))}
        </div>
        <div className="hidden grid-cols-2 items-start gap-3 md:grid">
          {[0, 1].map((column) => (
            <div key={column} className="space-y-3">
              {helpItems
                .filter((_, index) => index % 2 === column)
                .map((item) => (
                  <HelpItem key={item.question} item={item} />
                ))}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border-2 border-foreground bg-card p-5 shadow-sticker sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
          <div>
            <h2 className="font-extrabold">Still stuck?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Show your RA the exact screen or error message so they can check
              your roster, team, or submission status.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to home</Link>
        </Button>
      </section>
    </div>
  );
}
