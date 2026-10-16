import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "../components/portal-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://toolbar.moorkyz.com"),
  title: {
    default: "Moorkyz Toolbar — One toolbar. Every interface.",
    template: "%s — Moorkyz Toolbar",
  },
  description:
    "A framework-independent toolbar for modern web applications. Easy to start, easy to use, powerful to master.",
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
    { media: "(prefers-color-scheme: light)", color: "#f8f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111411" },
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
