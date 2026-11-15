import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p
        aria-hidden
        className="font-[family-name:var(--font-display)] text-8xl font-extrabold tracking-tighter text-white/10"
      >
        404
      </p>
      <h1 className="page-title -mt-6">This page is missing</h1>
      <p className="mt-3 text-muted">
        It may have moved, been removed, or never existed. The film you wanted is probably one
        search away.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Go home
        </Link>
        <Link href="/search" className="btn btn-secondary">
          Search films
        </Link>
      </div>
    </div>
  );
}
