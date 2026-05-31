import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zynq — Your AI Assistant",
  description: "A powerful AI assistant for daily use. Ask anything, get instant answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
