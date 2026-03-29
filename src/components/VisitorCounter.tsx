"use client";

import { useState, useEffect } from "react";

export default function VisitorCounter() {
  const [counts, setCounts] = useState<{ total: number; daily: number } | null>(null);

  useEffect(() => {
    fetch("/api/visitors", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setCounts(data))
      .catch(() => {});
  }, []);

  if (!counts) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 12,
      left: 12,
      fontSize: 11,
      color: "#aaa",
      fontFamily: "-apple-system, sans-serif",
      zIndex: 900,
    }}>
      today {counts.daily.toLocaleString()} · total {counts.total.toLocaleString()}
    </div>
  );
}
