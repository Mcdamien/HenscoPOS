import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Quicksand, Crimson_Text, Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SyncProvider } from "@/components/providers/SyncProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Custom fonts for POS receipt print preview
// Arnel Rounded equivalent (Headers) - Quicksand
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Geo Sans Light equivalent (Body/Session) - Nunito (rounded sans)
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Chopin equivalent (Footer) - Playfair Display (elegant serif)
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Z.ai Code Scaffold - AI-Powered Development",
  description: "Modern Next.js scaffold optimized for AI-powered development with Z.ai. Built with TypeScript, Tailwind CSS, and shadcn/ui.",
  keywords: ["Z.ai", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Z.ai Code Scaffold",
    description: "AI-powered development with modern React stack",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Z.ai Code Scaffold",
    description: "AI-powered development with modern React stack",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${quicksand.variable} ${nunito.variable} ${playfairDisplay.variable} ${crimsonText.variable} antialiased bg-background text-foreground`}
      >
        <SyncProvider>
          {children}
        </SyncProvider>
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
