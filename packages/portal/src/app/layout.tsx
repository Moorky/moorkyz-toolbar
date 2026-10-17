import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "../components/portal-shell";
import "./globals.css";
import "./playground.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://toolbar.moorkyz.com"),
  title: {
    default: "Moorkyz Toolbar — One toolbar. Every interface.",
    template: "%s — Moorkyz Toolbar",
  },
  description:
    "A framework-independent toolbar for modern web applications. Easy to start, easy to use, powerful to master.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://toolbar.moorkyz.com/",
    siteName: "Moorkyz Toolbar",
    title: "Moorkyz Toolbar — One toolbar. Every interface.",
    description:
      "Explore the real toolbar SDK in an interactive, developer-focused product experience.",
    images: [
      {
        url: "/moorkyz-toolbar-github.png",
        width: 1280,
        height: 640,
        alt: "Moorkyz Toolbar dock preview",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Moorkyz Toolbar — One toolbar. Every interface.",
    description: "A framework-independent toolbar for modern web applications.",
    images: ["/moorkyz-toolbar-github.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#08060d" },
  ],
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <PortalShell>{children}</PortalShell>
      </body>
    </html>
  );
}
