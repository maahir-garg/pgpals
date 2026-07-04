export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading">
      <div className="border-b-2 border-dashed border-foreground/25 pb-6">
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border-2 border-border bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
