import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "PGPals", template: "%s · PGPals" },
  description: "PGPR's 2-week buddy challenge: complete tasks, earn points, top the board!",
};

export const viewport: Viewport = {
  themeColor: "#f97350",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  );
}
