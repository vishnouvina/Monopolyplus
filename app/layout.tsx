import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monopoly Plus MVP",
  description: "Hybrid Monopoly-like board game platform MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
