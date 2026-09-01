import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

const LAST_UPDATED = "September 1, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-xs">Last updated: {LAST_UPDATED}</p>
      </div>

      <p>
        Flixtally is a small, independently-run movie tracking site. These terms are
        intentionally short and plain — by creating an account or using the site, you agree
        to them.
      </p>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">The service</h2>
        <p>
          Flixtally lets you rate, log, and organize movies you&apos;ve watched or want to
          watch. Movie data (titles, posters, cast, release dates, and similar) comes from{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-green hover:underline"
          >
            The Movie Database (TMDB)
          </a>
          . Flixtally is not endorsed or certified by TMDB, and we don&apos;t control the
          accuracy of that data.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Your account</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>You&apos;re responsible for keeping your password secure and for anything that happens under your account.</li>
          <li>You need to give an accurate email address so features like password reset actually work.</li>
          <li>One account per person — don&apos;t create accounts to impersonate someone else or evade a ban.</li>
          <li>You must be at least 13 years old to use Flixtally.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Acceptable use</h2>
        <p>Don&apos;t use Flixtally to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Upload illegal content, or images you don&apos;t have the right to use, as a profile picture, background, or list cover.</li>
          <li>Harass other users, post hateful content, or otherwise act in bad faith.</li>
          <li>Scrape, automate, or hammer the site in ways that degrade it for other users.</li>
          <li>Attempt to break authentication, access other users&apos; accounts, or probe the site for vulnerabilities without permission.</li>
        </ul>
        <p className="mt-2">
          We can suspend or remove an account that violates these terms, at our discretion.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Your content</h2>
        <p>
          Your ratings, diary entries, lists, and uploaded images are yours. By uploading an
          image (avatar, background, list cover), you confirm you have the right to use it and
          give Flixtally permission to store and display it back to you and, where the feature
          is public-facing (like a public list), to other users.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">No warranty</h2>
        <p>
          Flixtally is provided &ldquo;as is,&rdquo; run by one person as a side project. We
          don&apos;t guarantee it will always be available, bug-free, or that your data will
          never be lost — though we take reasonable care (see our{" "}
          <a href="/privacy" className="text-accent-green hover:underline">
            Privacy Policy
          </a>{" "}
          for how your data is handled). To the extent allowed by law, we&apos;re not liable
          for damages arising from your use of the site.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Changes</h2>
        <p>
          We may update these terms as the site grows. Meaningful changes will update the date
          at the top of this page. Continuing to use Flixtally after a change means you accept
          the update.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
        <p>
          Questions about these terms? Reach out at{" "}
          <a href="mailto:support@flixtally.com" className="text-accent-green hover:underline">
            support@flixtally.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
