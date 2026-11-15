import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ANNOUNCEMENT_MAX_LENGTH, getSiteSettings } from "@/lib/siteSettings";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";

export default async function AdminSitePage() {
  await requireAdmin();

  const [settings, curatedLists] = await Promise.all([
    getSiteSettings(),
    prisma.list.findMany({
      where: { isSystem: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, _count: { select: { items: true } } },
    }),
  ]);

  // Whether the pieces that depend on outside services are configured. Only
  // "is it set", never the value: these are secrets.
  const services = [
    {
      name: "Movie data (TMDB)",
      ok: !!process.env.TMDB_API_KEY,
      missing: "TMDB_API_KEY is not set, so no film data can load.",
    },
    {
      name: "Image uploads",
      ok: !!process.env.BLOB_READ_WRITE_TOKEN,
      missing: "BLOB_READ_WRITE_TOKEN is not set, so profile photos and covers can't be uploaded.",
    },
    {
      name: "Email (password resets)",
      ok: !!process.env.RESEND_API_KEY,
      missing: "RESEND_API_KEY is not set, so password reset emails are not sent.",
    },
    {
      name: "Scheduled jobs",
      ok: !!process.env.CRON_SECRET,
      missing: "CRON_SECRET is not set, so the daily jobs are refused in production.",
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card p-5 sm:p-6">
        <h2 className="section-title mb-5">Site settings</h2>
        <SiteSettingsForm
          initialAnnouncement={settings.announcement}
          initialSignupsOpen={settings.signupsOpen}
          maxLength={ANNOUNCEMENT_MAX_LENGTH}
        />
      </section>

      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">
            Connected services
          </h2>
          <ul className="space-y-3 text-sm">
            {services.map((service) => (
              <li key={service.name}>
                <div className="flex items-center justify-between gap-3">
                  <span>{service.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      service.ok ? "bg-accent-green-soft text-accent-green" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {service.ok ? "Configured" : "Not set up"}
                  </span>
                </div>
                {!service.ok && <p className="mt-1 text-xs text-muted">{service.missing}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-subtle">
            These are set as environment variables where the site is hosted, not here.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">Curated lists</h2>
          {curatedLists.length === 0 ? (
            <p className="text-sm text-muted">
              None loaded yet. They are created the first time someone opens the Lists page.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {curatedLists.map((list) => (
                <li key={list.id} className="flex items-center justify-between gap-3">
                  <Link href={`/lists/${list.id}`} className="min-w-0 truncate hover:text-accent-green">
                    {list.title}
                  </Link>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      list._count.items === 0 ? "font-semibold text-danger" : "text-muted"
                    }`}
                  >
                    {list._count.items === 0 ? "Empty" : `${list._count.items} films`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
