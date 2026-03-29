"use client";

import dynamic from "next/dynamic";

const NHKPage = dynamic(() => import("./NHKPage"), { ssr: false });

export default function HomePage() {
  return <NHKPage />;
}
