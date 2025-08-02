import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tokenstream.fun",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
