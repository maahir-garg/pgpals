import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PRIZE_POOL_VALUE_LABEL } from "@/lib/prizes";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              className="size-14 rotate-[-3deg] rounded-2xl border-2 border-foreground shadow-pop"
            />
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              PGPals
            </h1>
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Two weeks. One buddy. Win {PRIZE_POOL_VALUE_LABEL} in prizes.
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the event page
          </Link>
        </p>
      </div>
    </div>
  );
}
