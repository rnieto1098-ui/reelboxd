import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangeUsernameForm } from "@/components/ChangeUsernameForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.name) redirect("/login");

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Account settings</h1>

      <section className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Username</h2>
        <ChangeUsernameForm currentUsername={session.user.name} />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
