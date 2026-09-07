"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logoUrl } from "@/lib/tmdb";
import { useToast } from "@/components/Toast";

export function StreamingServiceToggle({
  providerId,
  providerName,
  logoPath,
  initialSelected,
}: {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  initialSelected: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [selected, setSelected] = useState(initialSelected);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    // Flipped immediately, not after the round trip — this grid is
    // usually clicked through rapidly while setting up services, and a
    // round trip per tile before the ring highlight moves reads as
    // sluggish. Rolled back on failure, same as every other toggle in the
    // app; the failure toast is still needed since a silent revert alone
    // would look like the click just didn't register.
    const next = !selected;
    setSelected(next);
    setSaving(true);

    let res: Response;
    try {
      res = next
        ? await fetch(`/api/streaming-services/${providerId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerName, logoPath }),
          })
        : await fetch(`/api/streaming-services/${providerId}`, { method: "DELETE" });
    } catch {
      setSaving(false);
      setSelected(!next);
      showToast(`Couldn't update ${providerName} — try again.`, "error");
      return;
    }
    setSaving(false);

    // No success toast here on purpose — this grid is usually clicked
    // several times in a row while setting up services, and a toast per
    // tile would pile up. The ring highlight is the success feedback;
    // failure still needs a toast since the toggle would otherwise look
    // like it worked.
    if (!res.ok) {
      setSelected(!next);
      showToast(`Couldn't update ${providerName} — try again.`, "error");
      return;
    }

    router.refresh();
  }

  const logo = logoUrl(logoPath, "w92");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`flex w-20 flex-col items-center gap-1.5 rounded-lg p-2 transition-all disabled:opacity-50 ${
        selected
          ? "ring-2 ring-accent-green"
          : "opacity-50 grayscale hover:opacity-80 hover:grayscale-0"
      }`}
    >
      <div className="h-14 w-14 overflow-hidden rounded-lg border border-border bg-surface">
        {logo ? (
          <Image
            src={logo}
            alt={providerName}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">
            {providerName[0]}
          </div>
        )}
      </div>
      <span className="text-center text-[11px] leading-tight text-muted">{providerName}</span>
    </button>
  );
}
