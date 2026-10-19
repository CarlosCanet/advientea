import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description: "Advientea page",
  icons: {
    icon: "/favicon.png",
  },
  title: "Advienté",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-cover`}
        style={{
          backgroundAttachment: "scroll",
          backgroundImage: "url('/BackgroundLeaves.svg')",
          backgroundPosition: "top left",
          backgroundRepeat: "repeat",
          backgroundSize: "cover",
          minHeight: "100vh",
        }}
      >
        <Navbar />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
