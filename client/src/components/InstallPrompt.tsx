import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if user previously dismissed
    if (localStorage.getItem("pwa-install-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide if already running as installed PWA
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setVisible(false);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem("pwa-install-dismissed", "1");
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div className="install-banner">
      <div className="install-banner-content">
        <img src="/icon-192.png" alt="Stableford" className="install-banner-icon" />
        <div className="install-banner-text">
          <strong>Install Stableford</strong>
          <span className="muted">Add to home screen for quick access</span>
        </div>
      </div>
      <div className="install-banner-actions">
        <button className="btn btn-primary" onClick={handleInstall}>
          Install
        </button>
        <button className="btn-icon" onClick={handleDismiss} title="Dismiss" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
