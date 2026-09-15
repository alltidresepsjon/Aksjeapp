import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Børsliga",
    short_name: "Børsliga",
    description:
      "Sosialt aksjespill med fiktive penger. Demodata — ingen ekte handel, innskudd eller pengepremier.",
    start_url: "/oversikt",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    lang: "nb",
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
