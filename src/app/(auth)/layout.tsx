import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <span
              className="grid size-12 place-items-center rounded-lg bg-primary text-base font-extrabold text-primary-foreground"
              aria-hidden
            >
              PG
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">
              PGPals
            </h1>
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            2 weeks. 1 buddy team. All the bragging rights.
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
