import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBrowsableProviders, getUserProviderIds } from "@/lib/streaming";
import { StreamingServicesGrid } from "@/components/StreamingServicesGrid";

export default async function StreamingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/streaming");

  const [providers, selectedIds] = await Promise.all([
    getBrowsableProviders(),
    getUserProviderIds(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="page-title mb-2">Your Streaming Services</h1>
      <p className="mb-6 text-sm text-muted">
        Select the services you subscribe to. We&apos;ll use this to show you which movies on
        your watchlist are ready to watch right now.
      </p>

      <StreamingServicesGrid
        providers={providers.map(({ provider_id, provider_name, logo_path }) => ({
          provider_id,
          provider_name,
          logo_path,
        }))}
        selectedIds={[...selectedIds]}
      />
    </div>
  );
}
