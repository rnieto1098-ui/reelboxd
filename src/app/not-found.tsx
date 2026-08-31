import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        Whatever you were looking for isn&apos;t here — it may have moved, or never existed.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          href="/"
          className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
