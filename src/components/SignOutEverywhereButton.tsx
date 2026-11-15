"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useToast } from "@/components/Toast";

/**
 * Two ways out: this device only, or every device the account is signed in
 * on (for a lost phone, or a computer you forgot to sign out of).
 */
export function SignOutEverywhereButton() {
  const showToast = useToast();
  const [busy, setBusy] = useState<"here" | "everywhere" | null>(null);

  async function signOutEverywhere() {
    setBusy("everywhere");
    try {
      const res = await fetch("/api/account/sessions", { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setBusy(null);
      showToast("Couldn't sign out your other devices. Try again.", "error");
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => {
            setBusy("here");
            signOut({ callbackUrl: "/" });
          }}
          className="btn btn-secondary"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {busy === "here" ? "Signing out…" : "Sign out"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={signOutEverywhere}
          className="btn btn-outline"
        >
          {busy === "everywhere" ? "Signing out…" : "Sign out of all devices"}
        </button>
      </div>
      <p className="mt-2 text-xs text-subtle">
        Signing out of all devices also signs you out here. Use it if you left your account open
        somewhere.
      </p>
    </div>
  );
}
