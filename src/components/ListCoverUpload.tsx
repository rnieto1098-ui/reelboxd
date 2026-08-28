"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ListCoverUpload({
  endpoint,
  hasImage,
  addLabel = "Add cover image",
  changeLabel = "Change cover image",
}: {
  endpoint: string;
  hasImage: boolean;
  addLabel?: string;
  changeLabel?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(endpoint, { method: "POST", body: formData });
    const body = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }

    router.refresh();
  }

  async function handleRemove() {
    setSaving(true);
    await fetch(endpoint, { method: "DELETE" });
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors disabled:opacity-50"
        >
          {saving ? "Uploading..." : hasImage ? changeLabel : addLabel}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={saving}
            onClick={handleRemove}
            className="text-xs text-muted hover:text-red-400 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
