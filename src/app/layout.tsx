import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://plate-showcase.vercel.app",
  ),
  title: {
    default: "Yanco — A table that feels like you",
    template: "%s | Yanco Dinnerware",
  },
  description:
    "Find Yanco dinnerware for your restaurant. Explore the full 2026 collection, get thoughtful recommendations, and preview your tabletop.",
  openGraph: {
    title: "Yanco Dinnerware Selector",
    description: "The right pieces. Your restaurant.",
    images: ["/catalog/legna-hero.webp"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
