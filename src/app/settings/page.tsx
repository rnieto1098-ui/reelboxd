import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChangeUsernameForm } from "@/components/ChangeUsernameForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.name) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, backgroundImage: true },
  });

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <section className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Profile picture</h2>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-background">
            {user?.image ? (
              <Image
                src={user.image}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-accent-green">
                {session.user.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <ProfileImageUpload type="avatar" label="Upload photo" hasImage={!!user?.image} />
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Site background</h2>
        <div className="flex items-center gap-4">
          <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-background">
            {user?.backgroundImage && (
              <Image
                src={user.backgroundImage}
                alt=""
                width={96}
                height={56}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <ProfileImageUpload
            type="background"
            label="Upload background"
            hasImage={!!user?.backgroundImage}
          />
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Username</h2>
        <ChangeUsernameForm currentUsername={session.user.name} />
      </section>

      <section className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Data &amp; privacy</h2>
        <p className="mb-3 text-sm text-muted">
          Download a .zip of your ratings, watchlist, and diary as CSV files — the same format{" "}
          <a href="/import" className="text-accent-green hover:underline">
            Import
          </a>{" "}
          reads, so it doubles as a backup you can restore from.
        </p>
        <a
          href="/api/export"
          className="mb-4 inline-block rounded-md bg-accent-green px-3 py-2 text-sm font-medium text-black hover:opacity-90 transition-opacity"
        >
          Export your data
        </a>
        <p className="mt-4 text-sm text-muted">
          See our{" "}
          <a href="/privacy" className="text-accent-green hover:underline">
            Privacy Policy
          </a>{" "}
          for what we collect and how it&apos;s used, or the{" "}
          <a href="/terms" className="text-accent-green hover:underline">
            Terms of Service
          </a>
          .
        </p>
      </section>
    </div>
  );
}
