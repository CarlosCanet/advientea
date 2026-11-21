import type { Metadata } from "next";

import { Figtree, Griffy } from "next/font/google";

import "./globals.css";
import Navbar from "@/components/Navbar";
import SentryUser from "@/components/SentryUser";
import { Toaster } from "@/components/ui/sonner";
import { verifySession } from "@/lib/dal";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const griffy = Griffy({
  subsets: ["latin"],
  variable: "--font-griffy",
  weight: "400",
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
    <html className={`${figtree.variable} ${griffy.variable}`} lang="es">
      <body className="leaf-background min-h-screen antialiased">
        <Navbar />
        <main className="pt-16">{children}</main>
        <Toaster position="top-center" richColors />
        <SentryUser user={user ? { id: user.id, username: user.username } : null} />
      </body>
    </html>
  );
}
