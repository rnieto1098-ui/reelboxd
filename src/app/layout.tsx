import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { RewatchIdsProvider } from "@/components/RewatchIdsProvider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteUrl";
import { PageBackground } from "@/components/PageBackground";

const TITLE = "Flixtally";
const DESCRIPTION = "Track films you've watched. Discover what to watch next.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Signed-out visitors (no user) get the per-tab backgrounds too. */}
        <PageBackground stored={user?.backgroundImage ?? null} />
        <ToastProvider>
          <RewatchIdsProvider ids={rewatchTmdbIds}>
            <NavBar />
            <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 py-8">{children}</main>
            <Footer />
          </RewatchIdsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
