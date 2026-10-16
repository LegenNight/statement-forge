import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatementForge // Chase Business Statement Converter",
  description: "High-density, client-side bank statement-to-ledger converter tailored for Chase Business Checking PDFs. Zero server uploads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas text-foregroundBright antialiased selection:bg-zinc-800 selection:text-zinc-100 min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
