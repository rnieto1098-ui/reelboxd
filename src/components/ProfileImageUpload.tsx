"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileImageUpload({
  type,
  label,
  hasImage,
}: {
  type: "avatar" | "background";
  label: string;
  hasImage: boolean;
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
    formData.append("type", type);

    let res: Response;
    try {
      res = await fetch("/api/profile/image", { method: "POST", body: formData });
    } catch {
      setSaving(false);
      setError("Upload failed — try again.");
      return;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setError(body?.error ?? "Upload failed");
      return;
    }

    router.refresh();
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch(`/api/profile/image?type=${type}`, { method: "DELETE" });
    } catch {
      setSaving(false);
      setError("Couldn't remove that — try again.");
      return;
    }

    setSaving(false);

    // Previously unchecked, unlike handleFileChange above — a failed delete
    // still refreshed as if it had succeeded, leaving the stale image in
    // place with nothing to say the request hadn't actually landed.
    if (!res.ok) {
      setError("Couldn't remove that — try again.");
      return;
    }

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
          {saving ? "Uploading..." : label}
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
