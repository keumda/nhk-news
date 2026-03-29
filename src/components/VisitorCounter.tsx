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
    <span style={{ fontSize: 11, color: "#bbb" }}>
      today {counts.daily.toLocaleString()} · total {counts.total.toLocaleString()}
    </span>
  );
}
