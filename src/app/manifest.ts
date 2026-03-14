import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KAT Academy",
    short_name: "KAT",
    description:
      "KAT helps kids and teens learn coding through guided lessons, projects, mentorship, and live classes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7FA",
    theme_color: "#132B5E",
    categories: ["education", "productivity"],
    lang: "en-US",
    icons: [
      {
        // Tight-cropped — used for browser tabs, bookmarks, splash screens
        src: "/kindle-a-techie.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        // Full-canvas with background — used by OS for adaptive icon shapes (circle, squircle, etc.)
        src: "/kindle-a-techie-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/landing.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "KAT Academy — Home",
      },
      {
        src: "/screenshots/dashboard.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Student Dashboard",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        icons: [{ src: "/kindle-a-techie.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Messages",
        short_name: "Messages",
        url: "/dashboard/messages",
        icons: [{ src: "/kindle-a-techie.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Meetings",
        short_name: "Meetings",
        url: "/dashboard/meetings",
        icons: [{ src: "/kindle-a-techie.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
