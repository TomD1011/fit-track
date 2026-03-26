"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem("install-dismissed");
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 72) return; // Don't show for 3 days after dismiss
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !isInStandalone) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    try {
      localStorage.setItem("install-dismissed", Date.now().toString());
    } catch {
      // localStorage not available
    }
  }

  if (dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--accent)]/30 rounded-xl p-4 mx-4 mt-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-sm">Install FitTrack</h3>
          {deferredPrompt ? (
            <p className="text-xs text-[var(--muted)] mt-1">
              Add to your home screen for quick access
            </p>
          ) : (
            <p className="text-xs text-[var(--muted)] mt-1">
              Tap the share button, then &quot;Add to Home Screen&quot;
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--muted)] hover:text-[var(--fg)] ml-2 text-sm"
        >
          &#10005;
        </button>
      </div>
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="w-full mt-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
        >
          Install App
        </button>
      )}
    </div>
  );
}
