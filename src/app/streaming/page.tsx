import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBrowsableProviders, getUserProviderIds } from "@/lib/streaming";
import { StreamingServiceToggle } from "@/components/StreamingServiceToggle";

export default async function StreamingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [providers, selectedIds] = await Promise.all([
    getBrowsableProviders(),
    getUserProviderIds(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Your Streaming Services</h1>
      <p className="mb-6 text-sm text-muted">
        Select the services you subscribe to. We&apos;ll use this to show you which movies on
        your watchlist are ready to watch right now.
      </p>

      <div className="flex flex-wrap gap-3">
        {providers.map((provider) => (
          <StreamingServiceToggle
            key={provider.provider_id}
            providerId={provider.provider_id}
            providerName={provider.provider_name}
            logoPath={provider.logo_path}
            initialSelected={selectedIds.has(provider.provider_id)}
          />
        ))}
      </div>
    </div>
  );
}
