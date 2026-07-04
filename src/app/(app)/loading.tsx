export default function AppLoading() {
  return (
    <div className="space-y-6" aria-label="Loading">
      <div className="rounded-xl border-2 border-foreground bg-card p-6 shadow-sticker">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border-2 border-border bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
