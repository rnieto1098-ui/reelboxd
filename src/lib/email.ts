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
