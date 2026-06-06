import type { Metadata } from "next";

import { AppNavbar } from "@/components/AppNavbar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Intentify",
  description: "Intent-first plan approval for agentic coding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppNavbar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
