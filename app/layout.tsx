import type { Metadata, Viewport } from "next";
import ServiceWorker from "@/components/ServiceWorker";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/client/settings";
import "./globals.css";

const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "QuizUp 상식 — 가볍게 한 판", template: "%s · QuizUp 상식" },
  description: "4개 카테고리, 40문제의 상식 퀴즈. 가입 없이 바로 시작하고 순위에 도전하세요.",
  applicationName: "QuizUp 상식",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "QuizUp 상식", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "QuizUp 상식", locale: "ko_KR" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4338ca" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:text-brand-ink">
          본문으로 건너뛰기
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
