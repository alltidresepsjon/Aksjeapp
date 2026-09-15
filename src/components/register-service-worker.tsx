"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Stille feiler — PWA-installasjon er en progressiv forbedring,
        // ikke en forutsetning for at appen skal fungere.
      });
    }
  }, []);
  return null;
}
