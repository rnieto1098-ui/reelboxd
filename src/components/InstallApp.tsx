"use client";

import { useState } from "react";
import { Download, PlusSquare, Share, Smartphone } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { promptInstall, useInstallState } from "@/lib/installPrompt";

const STEPS = [
  {
    icon: Share,
    title: "1. Tap the Share button",
    detail: "It's in Safari's toolbar: a square with an arrow pointing up.",
  },
  {
    icon: PlusSquare,
    title: "2. Choose “Add to Home Screen”",
    detail: "Scroll down the list of actions to find it.",
  },
  {
    icon: Smartphone,
    title: "3. Tap “Add”",
    detail: "Flixtally then opens from its own icon, full screen, like any other app.",
  },
];

// iPhones and iPads have no install prompt a site can trigger, so this
// walks through the three taps it takes in Safari.
function IosSteps({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Add Flixtally to your Home Screen"
      size="sm"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="btn btn-primary">
          Got it
        </button>
      }
    >
      <ol className="space-y-4 text-sm">
        {STEPS.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-green-soft text-accent-green">
              <Icon aria-hidden className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="text-muted">{detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

function useInstall() {
  const state = useInstallState();
  const showToast = useToast();
  const [showSteps, setShowSteps] = useState(false);

  async function install() {
    if (state === "ios") {
      setShowSteps(true);
      return;
    }
    if (await promptInstall()) showToast("Flixtally is installed.");
  }

  return { state, install, showSteps, closeSteps: () => setShowSteps(false) };
}

/** The "Install the app" row at the foot of the phone menu. Renders nothing when there's nothing to install. */
export function InstallAppMenuItem() {
  const { state, install, showSteps, closeSteps } = useInstall();
  if (state !== "prompt" && state !== "ios") return null;

  return (
    <div className="shrink-0 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={install}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-accent-green transition-colors hover:bg-accent-green-soft"
      >
        <Download aria-hidden className="h-5 w-5" />
        Install the app
      </button>
      {showSteps && <IosSteps onClose={closeSteps} />}
    </div>
  );
}

/** The "Get the app" block in Settings, which always says something useful. */
export function InstallAppCard() {
  const { state, install, showSteps, closeSteps } = useInstall();

  if (state === "installed") {
    return (
      <p className="text-sm text-muted">
        You&apos;re using the installed app. Nothing more to do here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Put Flixtally on your home screen. It opens full screen from its own icon, with no
        browser bars, and it&apos;s the same account and the same films.
      </p>
      {state === "none" ? (
        <p className="text-sm text-muted">
          In your browser&apos;s menu, look for{" "}
          <span className="font-medium text-foreground">Install</span> or{" "}
          <span className="font-medium text-foreground">Add to Home Screen</span>.
        </p>
      ) : (
        <button type="button" onClick={install} className="btn btn-primary">
          <Download aria-hidden className="h-4 w-4" />
          {state === "ios" ? "Show me how" : "Install the app"}
        </button>
      )}
      {showSteps && <IosSteps onClose={closeSteps} />}
    </div>
  );
}
