import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "L or R?",
  description:
    "Free mobile-first English L/R pronunciation practice for Japanese and Thai learners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b3df5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full antialiased">
        <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 pt-3 sm:max-w-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-10 top-24 h-28 w-28 rounded-full bg-coral/20 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 top-56 h-32 w-32 rounded-full bg-accent/20 blur-2xl"
          />
          <AppHeader />
          <main className="relative z-10 flex-1 pt-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
