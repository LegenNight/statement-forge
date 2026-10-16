import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatementForge — Modern Chase Statement Converter",
  description: "Secure, client-side bank statement-to-ledger converter tailored for Chase Business Checking. Fast, zero server uploads, QuickBooks & Xero export.",
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
      <body className="bg-gray-50 text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900 min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
