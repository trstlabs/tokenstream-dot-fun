import type { Metadata } from "next";
import "./globals.css";
import { BetaBanner } from "@/components/BetaBanner";

export const metadata: Metadata = {
  title: "tokenstream.fun",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <BetaBanner />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}
