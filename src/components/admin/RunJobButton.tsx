"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { useToast } from "@/components/Toast";

// "Run now" for one background job. The request stays open until the job
// finishes, which for a sync across many accounts can take a while, so the
// button says so rather than looking stuck.
export function RunJobButton({ job, label }: { job: string; label: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        showToast(body?.error ?? `${label} didn't finish. Check the history below.`, "error");
      } else if (body.ok) {
        showToast(`${label}: ${body.summary}`);
      } else {
        showToast(`${label} failed: ${body.summary}`, "error");
      }
    } catch {
      // Most likely the request outlived the server's time limit. The job
      // may still have completed; the history shows what was recorded.
      showToast(`Lost contact while running ${label}. Check the history below.`, "error");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={run} disabled={running} className="btn btn-secondary btn-sm">
      <Play aria-hidden className={`h-3.5 w-3.5 ${running ? "animate-pulse" : "fill-current"}`} />
      {running ? "Running…" : "Run now"}
    </button>
  );
}
