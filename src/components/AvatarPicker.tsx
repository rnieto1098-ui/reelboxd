"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_PRESETS } from "@/lib/avatars";

/**
 * The preset profile pictures as a row of tiles. `current` is the stored
 * User.image (a preset path, an upload URL, or null for the default), and
 * `hasUpload` says it's the user's own photo, which picking a preset deletes,
 * so that takes a second click.
 */
export function AvatarPicker({ current, hasUpload }: { current: string | null; hasUpload: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string, src: string) {
    if (pending || src === current) return;
    if (hasUpload && confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setPending(id);
    setError(null);
    let ok = false;
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      ok = res.ok;
    } catch {
      // handled below
    }
    setPending(null);
    if (!ok) {
      setError("Couldn't change your picture. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted">Or pick one of these</p>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.map((p) => {
          const active = current === p.src;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id, p.src)}
              disabled={pending != null}
              aria-pressed={active}
              aria-label={p.name}
              title={p.name}
              className={`h-11 w-11 overflow-hidden rounded-full ring-2 transition-[box-shadow,opacity] disabled:opacity-50 ${
                active
                  ? "ring-accent-green"
                  : confirmId === p.id
                    ? "ring-accent-gold"
                    : "ring-transparent hover:ring-white/30"
              }`}
            >
              <Image src={p.src} alt="" width={44} height={44} className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
      {confirmId && (
        <p className="mt-2 text-xs text-accent-gold">
          This replaces your uploaded photo. Click it again to confirm.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
