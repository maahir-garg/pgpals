import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* playful background blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/3 size-64 rounded-full bg-accent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 size-72 rounded-full bg-secondary blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <div className="text-5xl">🐧</div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-primary">
              PGPals
            </h1>
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            2 weeks. 1 buddy team. All the bragging rights.
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-semibold hover:text-foreground">
            ← Back to the event page
          </Link>
        </p>
      </div>
    </div>
  );
}
