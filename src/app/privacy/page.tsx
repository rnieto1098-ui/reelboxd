import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "September 1, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-xs">Last updated: {LAST_UPDATED}</p>
      </div>

      <p>
        This explains what Flixtally collects, why, and who else sees it. We collect the
        minimum needed to run the site — nothing is sold, and there are no ad trackers.
      </p>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-foreground">Account info:</strong> your email, username, and password (stored as a one-way hash — we never see or store your actual password).</li>
          <li><strong className="text-foreground">Activity you create:</strong> ratings, diary entries, watchlist items, owned-movie marks, lists, and the streaming services you tell us you subscribe to.</li>
          <li><strong className="text-foreground">Uploaded images:</strong> a profile picture, background, or list cover, if you choose to add one.</li>
          <li><strong className="text-foreground">Basic technical data:</strong> things like IP address and request timing, used only for rate-limiting abuse (e.g. repeated failed logins) — not for tracking or analytics.</li>
        </ul>
        <p className="mt-2">
          We don&apos;t collect anything beyond what&apos;s needed for the features above —
          no ad identifiers, no third-party analytics/tracking pixels, no behavioral profiling.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">How it&apos;s used</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To run the features you&apos;d expect: showing your ratings/watchlist back to you, personalized recommendations, and letting you log in.</li>
          <li>Your email is used only for account access and, if you request it, password resets — never for marketing.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Who else sees it</h2>
        <p>We use a small number of service providers to run Flixtally. Each only sees what it needs to do its job:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-foreground">Vercel</strong> — hosts the site and stores uploaded images (avatars, backgrounds, list covers).</li>
          <li><strong className="text-foreground">Turso</strong> — hosts the database (your account and activity data).</li>
          <li><strong className="text-foreground">TMDB</strong> — supplies movie data (titles, posters, cast). We send movie IDs/titles to TMDB to look up information; we don&apos;t send your personal account details to them.</li>
          <li><strong className="text-foreground">Resend</strong> — delivers password reset emails, if you request one.</li>
        </ul>
        <p className="mt-2">
          None of these providers are permitted to use your data for their own purposes beyond
          providing the service to us. We don&apos;t sell or rent your data to anyone.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Cookies</h2>
        <p>
          Flixtally uses one essential cookie to keep you signed in. It&apos;s required for
          the site to function and isn&apos;t used for tracking or advertising.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Public vs. private</h2>
        <p>
          Your username, public lists, and public profile activity (ratings, diary) are
          visible to anyone who visits your profile page, similar to Letterboxd or a public
          social profile. Your email address and password are never shown to anyone,
          including other users.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">How long we keep it</h2>
        <p>
          Your data is kept as long as your account exists. If you&apos;d like your account
          and data deleted, email us (below) and we&apos;ll remove it — Flixtally doesn&apos;t
          yet have a self-service delete button, so this is currently handled manually.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Children&apos;s privacy</h2>
        <p>
          Flixtally isn&apos;t intended for children under 13, and we don&apos;t knowingly
          collect data from anyone under that age.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Changes</h2>
        <p>
          If this policy changes in a meaningful way, we&apos;ll update the date at the top of
          this page.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
        <p>
          Questions, or want your data deleted? Reach out at{" "}
          <a href="mailto:support@flixtally.com" className="text-accent-green hover:underline">
            support@flixtally.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
