import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteUrl";

const TITLE = "reelboxd";
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
        select: { backgroundImage: true },
      })
    : null;

  const bodyStyle: React.CSSProperties | undefined = user?.backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(20, 24, 28, 0.88), rgba(20, 24, 28, 0.88)), url(${user.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={bodyStyle}>
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
