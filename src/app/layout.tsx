import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";
import Navbar from "@/components/Navbar";
import SentryUser from "@/components/SentryUser";
import { verifySession } from "@/lib/dal";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await verifySession();
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
        <Toaster richColors />
        <SentryUser user={user ? { id: user.id, username: user.username } : null} />
      </body>
    </html>
  );
}
