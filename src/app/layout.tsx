import type { Metadata } from "next";
import "./globals.css";
import FeedbackWidget from "@/components/FeedbackWidget";

export const metadata: Metadata = {
  title: "NHK やさしいにほんご | 일본어 뉴스 리더",
  description:
    "NHK News Web Easy 뉴스를 후리가나, 한국어 번역과 함께 읽어보세요.",
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
