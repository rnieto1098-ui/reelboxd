import Image from "next/image";
import { logoUrl, type TmdbWatchProvider } from "@/lib/tmdb";

export function ProviderLogos({ providers }: { providers: TmdbWatchProvider[] }) {
  if (providers.length === 0) return null;

  return (
    <div className="mt-1.5 flex gap-1">
      {providers.slice(0, 5).map((p) => {
        const logo = logoUrl(p.logo_path, "w45");
        return logo ? (
          <div
            key={p.provider_id}
            title={p.provider_name}
            className="h-5 w-5 overflow-hidden rounded border border-border"
          >
            <Image src={logo} alt={p.provider_name} width={20} height={20} />
          </div>
        ) : null;
      })}
    </div>
  );
}
