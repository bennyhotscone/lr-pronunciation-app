import type { Metadata, Viewport } from "next";
import { PhotoTreasureHunt } from "@/components/photo-treasure-hunt/PhotoTreasureHunt";
import "./hunt.css";

export const metadata: Metadata = {
  title: { absolute: "Rita’s Melbourne Photo Hunt" },
  description:
    "15 Melbourne CBD photo and vocabulary missions. Photos, words, and sentences stay on this device.",
  manifest: "/photo-treasure-hunt/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rita’s Photo Hunt",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/photo-treasure-hunt/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/photo-treasure-hunt/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/photo-treasure-hunt/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff0f7",
};

export default function PhotoTreasureHuntPage() {
  return <PhotoTreasureHunt />;
}
