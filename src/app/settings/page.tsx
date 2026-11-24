import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Database,
  Download,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tv,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAdminRole } from "@/lib/admin";
import { logoUrl } from "@/lib/tmdb";
import { ChangeUsernameForm } from "@/components/ChangeUsernameForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { LetterboxdSyncCard } from "@/components/LetterboxdSyncCard";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { InstallAppCard } from "@/components/InstallApp";
import { SignOutEverywhereButton } from "@/components/SignOutEverywhereButton";
import { pickerSelection, resolveBackground } from "@/lib/backgrounds";
import { avatarSrc, isPresetAvatar } from "@/lib/avatars";
import { AvatarPicker } from "@/components/AvatarPicker";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "app", label: "Get the app", icon: Smartphone },
  { id: "streaming", label: "Streaming services", icon: Tv },
  { id: "sync", label: "Import and sync", icon: RefreshCw },
  { id: "account", label: "Sign-in and security", icon: ShieldCheck },
  { id: "data", label: "Your data", icon: Database },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 id={`${id}-heading`} className="section-title">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// A sub-part of a section, separated from the one above by a rule.
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-3 font-sans text-sm font-semibold tracking-normal">{title}</h3>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.name) redirect("/login?next=/settings");
  const username = session.user.name;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      role: true,
      image: true,
      backgroundImage: true,
      createdAt: true,
      letterboxdUsername: true,
      letterboxdSyncedAt: true,
      streamingServices: {
        select: { providerId: true, providerName: true, logoPath: true },
        orderBy: { providerName: "asc" },
      },
    },
  });
  if (!user) redirect("/login");

  const background = resolveBackground(user.backgroundImage);
  const isAdmin = hasAdminRole(user);

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-muted">Your profile, how the site looks, and your account.</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        {/* A list of the sections below. Stays in view on wide screens; on
            small ones it scrolls sideways above the content. */}
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                  {label}
                </a>
              </li>
            ))}
            {isAdmin && (
              <li className="shrink-0 lg:mt-2 lg:border-t lg:border-border lg:pt-2">
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-accent-green transition-colors hover:bg-accent-green-soft"
                >
                  <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                  Admin area
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl space-y-6">
          <Section
            id="profile"
            title="Profile"
            description="How you appear on your public profile page."
          >
            <Row title="Photo">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-background ring-1 ring-white/15">
                    <Image
                      src={avatarSrc(user.image, username)}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {/* "Remove" goes back to the default picture, so it only
                      makes sense once something has been picked or uploaded. */}
                  <ProfileImageUpload type="avatar" label="Upload photo" hasImage={!!user.image} />
                </div>
                <AvatarPicker
                  current={user.image}
                  hasUpload={!!user.image && !isPresetAvatar(user.image)}
                />
              </div>
            </Row>
            <Row title="Username">
              <ChangeUsernameForm currentUsername={username} />
            </Row>
          </Section>

          <Section
            id="appearance"
            title="Appearance"
            description="Each tab has its own backdrop by default. Pick one to use everywhere, upload your own, or turn backdrops off."
          >
            <BackgroundPicker selected={pickerSelection(user.backgroundImage)} />
            <div className="mt-5 flex items-center gap-4 border-t border-border pt-5">
              {background.kind === "upload" && (
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ring-accent-green">
                  <Image
                    src={background.url}
                    alt="Your uploaded backdrop"
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
          </Section>

          <Section id="app" title="Get the app">
            <InstallAppCard />
          </Section>

          <Section
            id="streaming"
            title="Streaming services"
            description="The services you subscribe to. Flixtally uses these to show which films you can watch right now."
          >
            {user.streamingServices.length === 0 ? (
              <p className="mb-4 text-sm text-muted">You haven&apos;t added any yet.</p>
            ) : (
              <ul className="mb-4 flex flex-wrap gap-2.5">
                {user.streamingServices.map((service) => {
                  const logo = logoUrl(service.logoPath, "w92");
                  return (
                    <li
                      key={service.providerId}
                      title={service.providerName}
                      className="h-11 w-11 overflow-hidden rounded-xl bg-surface-hover ring-1 ring-white/10"
                    >
                      {logo ? (
                        <Image src={logo} alt={service.providerName} width={44} height={44} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                          {service.providerName[0]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/streaming" className="btn btn-secondary">
              {user.streamingServices.length === 0 ? "Add your services" : "Change services"}
            </Link>
          </Section>

          <Section
            id="sync"
            title="Import and sync"
            description="Bring your film history over from Letterboxd, once or continuously."
          >
            <Row title="Keep in sync with Letterboxd">
              <p className="mb-3 text-sm text-muted">
                Connect a Letterboxd account and new diary entries and watchlist films are
                copied here every day. Nothing is ever changed on Letterboxd.
              </p>
              <LetterboxdSyncCard
                initialUsername={user.letterboxdUsername}
                initialSyncedAt={user.letterboxdSyncedAt?.toISOString() ?? null}
              />
            </Row>
            <Row title="Import a Letterboxd export">
              <p className="mb-3 text-sm text-muted">
                Upload the .zip Letterboxd gives you to bring in your whole diary, ratings and
                watchlist in one go.
              </p>
              <Link href="/import" className="btn btn-secondary">
                Import from a file
              </Link>
            </Row>
          </Section>

          <Section id="account" title="Sign-in and security">
            <Row title="Email">
              <p className="text-sm">{user.email}</p>
              <p className="mt-1 text-xs text-subtle">
                Used to sign in and to reset your password. Member since{" "}
                {user.createdAt.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                .
              </p>
            </Row>
            <Row title="Change password">
              <ChangePasswordForm email={user.email} />
            </Row>
            <Row title="Sign out">
              <SignOutEverywhereButton />
            </Row>
          </Section>

          <Section id="data" title="Your data">
            <Row title="Export">
              <p className="mb-3 text-sm text-muted">
                Download a .zip of your ratings, watchlist and diary as CSV files. It&apos;s the
                same format the import reads, so it doubles as a backup.
              </p>
              <a href="/api/export" className="btn btn-secondary">
                <Download aria-hidden className="h-4 w-4" />
                Export your data
              </a>
            </Row>
            <Row title="Delete account">
              <p className="mb-3 text-sm text-muted">
                Permanently removes your account and everything on it. This can&apos;t be undone.
              </p>
              <DeleteAccountForm username={username} />
            </Row>
            <p className="border-t border-border pt-5 text-sm text-muted">
              Read the{" "}
              <Link
                href="/privacy"
                className="font-medium text-accent-green underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/terms"
                className="font-medium text-accent-green underline-offset-2 hover:underline"
              >
                Terms of Service
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
