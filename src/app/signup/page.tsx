import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { getSiteSettings } from "@/lib/siteSettings";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const [session, settings] = await Promise.all([auth(), getSiteSettings()]);
  if (session?.user) redirect("/");

  const signInLink = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="font-medium text-accent-green underline-offset-2 hover:underline">
        Sign in
      </Link>
    </>
  );

  // An admin can pause new sign-ups from the admin area.
  if (!settings.signupsOpen) {
    return (
      <AuthShell
        title="Sign-ups are closed"
        subtitle="Flixtally isn't taking new accounts right now. Check back soon."
        footer={signInLink}
      >
        <Link href="/" className="btn btn-secondary">
          Browse films
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free, and it takes about a minute."
      footer={signInLink}
    >
      <SignupForm />
    </AuthShell>
  );
}
