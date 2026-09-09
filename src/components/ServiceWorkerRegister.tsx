"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app still works online without a service worker,
      // it just won't have offline app-shell caching (e.g. in browsers
      // that disable service workers, or over plain http in dev on some
      // setups where it's blocked).
    });
  }, []);

  return null;
}