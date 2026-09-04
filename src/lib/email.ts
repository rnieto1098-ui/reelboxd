import { Resend } from "resend";

// onboarding@resend.dev is Resend's built-in test sender — it works without
// verifying a custom domain, which is all a small project like this needs.
// Swap in a verified domain address later if delivery volume/reputation
// ever becomes a concern.
const FROM_ADDRESS = "Flixtally <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Lets password reset be testable locally without setting up Resend —
    // the link just goes to the server log instead of an inbox. Vercel's
    // function logs catch this too, so a misconfigured production env is
    // still visible there rather than silently swallowed.
    console.error(
      `RESEND_API_KEY is not set — skipping email send. Reset link for ${to}: ${resetUrl}`
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset your Flixtally password",
    html: `
      <p>Someone requested a password reset for your Flixtally account.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

// Sent once when the Letterboxd watchlist sync (a page scraper, unlike the
// diary sync's stable RSS feed — see lib/letterboxdWatchlistSync.ts) can't
// make sense of the watchlist page anymore, most likely because Letterboxd
// changed their site. Not resent on every failed run — only on the
// transition into the broken state — so a persistent outage is one email,
// not a daily one.
export async function sendLetterboxdWatchlistBrokenEmail(to: string, username: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      `RESEND_API_KEY is not set — skipping email send. Letterboxd watchlist sync broke for ${to} (username: ${username}).`
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Your Letterboxd watchlist sync stopped working",
    html: `
      <p>Flixtally couldn't read your Letterboxd watchlist (letterboxd.com/${username}/watchlist/) on the last sync attempt — most likely Letterboxd changed something about how they show that page.</p>
      <p>Nothing was changed on your Flixtally watchlist because of this — the sync only adds movies, and skipped this run entirely rather than guess. Your diary sync (if connected) isn't affected.</p>
      <p>This is a best-effort feature built on scraping a page Letterboxd doesn't officially support for this, so it may take a while to get fixed, if it can be. You'll only get this email once; it won't repeat until the sync recovers and then breaks again.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send Letterboxd watchlist broken email: ${error.message}`);
  }
}
