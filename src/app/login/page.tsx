import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/loginHref";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  // Where to go afterwards: the page that sent the visitor here, if it is a
  // plain path on this site (see safeNextPath), otherwise home.
  const next = safeNextPath(params.next);

  // Already signed in: there is nothing to do here.
  const session = await auth();
  if (session?.user) redirect(next);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Flixtally?{" "}
          <Link
            href="/signup"
            className="font-medium text-accent-green underline-offset-2 hover:underline"
          >
            Create a free account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
