import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assay — Small, exact tools for work that gets audited",
  description: "Small, exact tools for work that gets audited. Zero-backend, deterministic, client-side tools engineered for financial accounting, audit verification, and privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-stone-50 text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900 min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
