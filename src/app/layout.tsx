import type { Metadata } from "next";
import "./globals.css";
import FeedbackWidget from "@/components/FeedbackWidget";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://nhk-news-production.up.railway.app",
  ),
  title: "NHK やさしいにほんご | 쉬운 일본어 뉴스 리더",
  description:
    "NHK Easy News를 후리가나, 한국어 번역, 동사 활용 분석과 함께 읽어보세요. 매일 업데이트되는 쉬운 일본어 뉴스로 일본어를 공부하세요.",
  openGraph: {
    title: "NHK やさしいにほんご | 쉬운 일본어 뉴스 리더",
    description:
      "한국어 번역 · 후리가나 · 동사 활용 분석 · 음성 재생 — 매일 업데이트되는 NHK Easy News로 일본어를 공부하세요.",
    type: "website",
    locale: "ko_KR",
    siteName: "NHK やさしいにほんご",
  },
  twitter: {
    card: "summary_large_image",
    title: "NHK やさしいにほんご | 쉬운 일본어 뉴스 리더",
    description:
      "한국어 번역 · 후리가나 · 동사 활용 분석 · 음성 재생",
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
      </body>
    </html>
  );
}
