"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Skip in development: a live service worker fights Next's dev-mode
    // hot-reloading by serving stale cached chunks. Test offline behavior
    // against a production build (npm run build && npm run start) instead.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error.message);
    });
  }, []);

  return null;
}
