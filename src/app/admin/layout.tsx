import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const metadata: Metadata = {
  title: "Admin",
  // Keep the admin area out of search results even if a link to it leaks.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Anyone who isn't an admin gets the ordinary "page not found". Each page
  // and each /api/admin route checks again for itself: a layout can be
  // skipped by client-side navigation, so it is never the only guard.
  const admin = await requireAdmin();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            Admin
          </p>
          <h1 className="page-title">Site administration</h1>
        </div>
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-foreground">{admin.username}</span>
        </p>
      </header>
      <AdminTabs />
      <div className="pt-8">{children}</div>
    </div>
  );
}
