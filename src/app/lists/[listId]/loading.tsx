export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-7 w-64 animate-pulse rounded bg-surface" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-surface" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    </div>
  );
}
