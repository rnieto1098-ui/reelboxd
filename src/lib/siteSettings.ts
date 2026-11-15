import { prisma } from "@/lib/prisma";

// Site-wide switches an admin can change from /admin without a deploy.
// Stored one row per key in SiteSetting; anything missing uses its default.
export type SiteSettings = {
  // Shown in a banner under the header on every page. Empty = no banner.
  announcement: string;
  // When false, the sign-up page and API refuse new accounts.
  signupsOpen: boolean;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcement: "",
  signupsOpen: true,
};

export const ANNOUNCEMENT_MAX_LENGTH = 240;

export function parseSiteSettings(rows: { key: string; value: string }[]): SiteSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    announcement: (byKey.get("announcement") ?? DEFAULT_SITE_SETTINGS.announcement).slice(
      0,
      ANNOUNCEMENT_MAX_LENGTH
    ),
    signupsOpen: byKey.has("signupsOpen")
      ? byKey.get("signupsOpen") !== "false"
      : DEFAULT_SITE_SETTINGS.signupsOpen,
  };
}

/**
 * Never throws: these settings decorate every page (the banner lives in the
 * root layout), so a database hiccup here must fall back to the defaults
 * rather than take the whole site down with it.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return parseSiteSettings(await prisma.siteSetting.findMany());
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const rows: [string, string][] = [
    ["announcement", settings.announcement.trim().slice(0, ANNOUNCEMENT_MAX_LENGTH)],
    ["signupsOpen", settings.signupsOpen ? "true" : "false"],
  ];
  await prisma.$transaction(
    rows.map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );
}
