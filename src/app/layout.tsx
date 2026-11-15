import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ToastProvider } from "@/components/Toast";
import { RewatchIdsProvider } from "@/components/RewatchIdsProvider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteUrl";
import { PageBackground } from "@/components/PageBackground";

// Self-hosted by next/font at build time: no request to Google from the
// visitor's browser, and no layout shift while the font loads.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const TITLE = "Flixtally";
const DESCRIPTION = "Track films you've watched. Discover what to watch next.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          backgroundImage: true,
          rewatchList: { select: { movie: { select: { tmdbId: true } } } },
        },
      })
    : null;
  const rewatchTmdbIds = user?.rewatchList.map((r) => r.movie.tmdbId) ?? [];

  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${interTight.variable}`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="btn btn-primary fixed left-3 top-3 z-[100] -translate-y-20 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        {/* Signed-out visitors (no user) get the per-tab backgrounds too. */}
        <PageBackground stored={user?.backgroundImage ?? null} />
        <ToastProvider>
          <RewatchIdsProvider ids={rewatchTmdbIds}>
            <NavBar />
            {/* pb on small screens leaves room for the fixed tab bar. */}
            <main id="main" className="container-page flex-1 py-8 pb-24 lg:pb-12">
              {children}
            </main>
            <Footer />
            <MobileTabBar username={session?.user?.name ?? null} />
          </RewatchIdsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
