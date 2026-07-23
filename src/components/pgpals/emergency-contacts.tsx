import { PhoneCall, Siren } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmergencyContactsCard() {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-destructive text-destructive-foreground">
            <Siren className="size-5" strokeWidth={2.5} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">Emergency contacts</h2>
            <p className="text-sm text-muted-foreground">
              For emergency situations, tap a number to call.
            </p>
          </div>
        </div>

        <a
          href="tel:+6568741616"
          aria-label="Call NUS Campus Emergency and Security at +65 6874 1616"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border-2 border-foreground bg-card p-3 transition-colors hover:bg-muted"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wide text-destructive">
              On campus · 24 hours
            </span>
            <span className="font-bold">
              NUS Campus Emergency &amp; Security (CES)
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-heading text-lg font-extrabold text-destructive">
            <PhoneCall className="size-4" strokeWidth={2.5} aria-hidden />
            +65 6874 1616
          </span>
        </a>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-destructive">
            Outside campus
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:995"
              aria-label="Call ambulance or fire emergency services at 995"
              className="rounded-lg border-2 border-foreground bg-card p-3 transition-colors hover:bg-muted"
            >
              <span className="block text-xs font-semibold text-muted-foreground">
                Ambulance / fire
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 font-heading text-xl font-extrabold text-destructive">
                <PhoneCall className="size-4" strokeWidth={2.5} aria-hidden />
                995
              </span>
            </a>
            <a
              href="tel:999"
              aria-label="Call police emergency services at 999"
              className="rounded-lg border-2 border-foreground bg-card p-3 transition-colors hover:bg-muted"
            >
              <span className="block text-xs font-semibold text-muted-foreground">
                Police
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 font-heading text-xl font-extrabold text-destructive">
                <PhoneCall className="size-4" strokeWidth={2.5} aria-hidden />
                999
              </span>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
