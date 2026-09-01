import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportForm } from "@/components/ImportForm";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-bold">Import from Letterboxd</h1>
      <p className="mb-6 text-sm text-muted">
        Export your data from Letterboxd at{" "}
        <a
          href="https://letterboxd.com/user/exportdata/"
          target="_blank"
          rel="noreferrer"
          className="text-accent-green hover:underline"
        >
          letterboxd.com/user/exportdata
        </a>{" "}
        (while signed into Letterboxd, this generates a .zip file of your data). Upload that .zip
        below — we&apos;ll match each film to our movie database by title and year, then import
        your ratings and watchlist. Movies with unusual titles might not match
        automatically; we&apos;ll list anything we couldn&apos;t find.
      </p>
      <p className="mb-6 text-sm text-muted">
        Want to back up or move your Flixtally data instead? You can{" "}
        <a href="/api/export" className="text-accent-green hover:underline">
          export it
        </a>{" "}
        from Settings.
      </p>

      <ImportForm />
    </div>
  );
}
