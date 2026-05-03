import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppChrome } from "../components/AppChrome";
import "./globals.css";

// Bind Inter as a CSS variable so globals.css can reference it alongside the
// existing font stack (`var(--font-sans)`), matching the Vite/index.html setup.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vamsha — Family Heritage Tracker",
  description: "Family History & Heritage Tracker",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
