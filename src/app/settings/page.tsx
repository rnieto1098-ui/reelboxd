import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChangeUsernameForm } from "@/components/ChangeUsernameForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { pickerSelection, resolveBackground } from "@/lib/backgrounds";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.name) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, backgroundImage: true },
  });
  const background = resolveBackground(user?.backgroundImage);

  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-6">Settings</h1>

      <section className="card mb-8 p-5">
        <h2 className="section-title mb-3">Profile picture</h2>
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

      <section className="card mb-8 p-5">
        <h2 className="section-title mb-3">Site background</h2>
        <p className="mb-3 text-sm text-muted">
          By default each tab has its own backdrop. Pick one to use it everywhere instead.
        </p>
        <BackgroundPicker selected={pickerSelection(user?.backgroundImage)} />
        <div className="mt-4 flex items-center gap-4">
          {background.kind === "upload" && (
            <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md border-2 border-accent-green bg-background">
              <Image
                src={background.url}
                alt=""
                width={96}
                height={56}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <ProfileImageUpload
            type="background"
            label={background.kind === "upload" ? "Replace your image" : "Upload your own"}
            hasImage={background.kind === "upload"}
          />
        </div>
      </section>

      <section className="card mb-8 p-5">
        <h2 className="section-title mb-3">Username</h2>
        <ChangeUsernameForm currentUsername={session.user.name} />
      </section>

      <section className="card mb-8 p-5">
        <h2 className="section-title mb-3">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className="card p-5">
        <h2 className="section-title mb-3">Data &amp; privacy</h2>
        <p className="mb-3 text-sm text-muted">
          Download a .zip of your ratings, watchlist, and diary as CSV files — the same format{" "}
          <a href="/import" className="font-medium text-accent-green underline-offset-2 hover:underline">
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
          <a href="/privacy" className="font-medium text-accent-green underline-offset-2 hover:underline">
            Privacy Policy
          </a>{" "}
          for what we collect and how it&apos;s used, or the{" "}
          <a href="/terms" className="font-medium text-accent-green underline-offset-2 hover:underline">
            Terms of Service
          </a>
          .
        </p>
      </section>
    </div>
  );
}
