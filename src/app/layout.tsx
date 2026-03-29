import type { Metadata } from "next";
import "./globals.css";
import FeedbackWidget from "@/components/FeedbackWidget";
import VisitorCounter from "@/components/VisitorCounter";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://nhk-news-production.up.railway.app",
  ),
  title: "やさしいにほんご 리더",
  description:
    "NHK 쉬운 일본어 뉴스 · 한국어 번역 · 동사 분석",
  openGraph: {
    title: "やさしいにほんご 리더",
    description:
      "한국어 번역 · 후리가나 · 동사 분석",
    type: "website",
    locale: "ko_KR",
    siteName: "やさしいにほんご 리더",
  },
  twitter: {
    card: "summary_large_image",
    title: "やさしいにほんご 리더",
    description:
      "한국어 번역 · 후리가나 · 동사 분석",
  },
  other: {
    "naver-site-verification": "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <FeedbackWidget />
        <VisitorCounter />
      </body>
    </html>
  );
}
