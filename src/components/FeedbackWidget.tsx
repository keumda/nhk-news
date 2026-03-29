"use client";

import { useState, useEffect, type CSSProperties } from "react";
import type { Lang } from "@/lib/i18n";

type Status = "idle" | "sending" | "success" | "error";

const text = {
  fabLabel: { ko: "피드백 보내기", en: "Send Feedback" },
  close: { ko: "닫기", en: "Close" },
  title: { ko: "피드백 보내기", en: "Send Feedback" },
  subtitle: { ko: "개선 아이디어나 버그를 알려주세요", en: "Share ideas or report bugs" },
  categoryLabel: { ko: "분류", en: "Category" },
  catFeature: { ko: "기능 요청", en: "Feature Request" },
  catBug: { ko: "버그 신고", en: "Bug Report" },
  catOther: { ko: "기타", en: "Other" },
  contentLabel: { ko: "내용", en: "Message" },
  placeholder: { ko: "자유롭게 작성해주세요...", en: "Write your feedback here..." },
  sending: { ko: "전송 중...", en: "Sending..." },
  submit: { ko: "보내기", en: "Submit" },
  success: { ko: "감사합니다! 소중한 의견이 전달되었습니다.", en: "Thank you! Your feedback has been submitted." },
  error: { ko: "전송에 실패했습니다. 다시 시도해주세요.", en: "Failed to send. Please try again." },
} as const;

export default function FeedbackWidget({ lang = "ko" }: { lang?: Lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<string>(text.catFeature[lang]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [isMobile, setIsMobile] = useState(false);

  // Update category when language changes
  useEffect(() => {
    setCategory(text.catFeature[lang]);
  }, [lang]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 420);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggle = () => {
    setIsOpen((v) => !v);
    if (status === "success" || status === "error") setStatus("idle");
  };

  const submit = async () => {
    if (!message.trim()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });

      if (!res.ok) throw new Error();
      setStatus("success");
      setMessage("");
      setCategory(text.catFeature[lang]);
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 1800);
    } catch {
      setStatus("error");
    }
  };

  const panelWidth = isMobile ? "calc(100vw - 32px)" : 340;
  const panelRight = isMobile ? 16 : 24;

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={toggle}
        style={{
          ...s.fab,
          ...(isOpen ? s.fabOpen : {}),
        }}
        aria-label={isOpen ? text.close[lang] : text.fabLabel[lang]}
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Panel */}
      <div
        style={{
          ...s.panel,
          width: panelWidth,
          right: panelRight,
          transform: isOpen ? "scale(1)" : "scale(0)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <h3 style={s.title}>{text.title[lang]}</h3>
        <p style={s.subtitle}>{text.subtitle[lang]}</p>

        <label style={s.label}>{text.categoryLabel[lang]}</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={s.select}
        >
          <option>{text.catFeature[lang]}</option>
          <option>{text.catBug[lang]}</option>
          <option>{text.catOther[lang]}</option>
        </select>

        <label style={s.label}>{text.contentLabel[lang]}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={text.placeholder[lang]}
          rows={4}
          style={s.textarea}
        />

        <button
          onClick={submit}
          disabled={status === "sending" || !message.trim()}
          style={{
            ...s.submitBtn,
            opacity: status === "sending" || !message.trim() ? 0.6 : 1,
          }}
        >
          {status === "sending" ? text.sending[lang] : text.submit[lang]}
        </button>

        {status === "success" && (
          <p style={s.success}>{text.success[lang]}</p>
        )}
        {status === "error" && (
          <p style={s.error}>{text.error[lang]}</p>
        )}
      </div>
    </>
  );
}

/* ─── styles ─── */
const s: Record<string, CSSProperties> = {
  fab: {
    position: "fixed",
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: "none",
    background: "#3498db",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    zIndex: 1100,
    boxShadow: "0 4px 14px rgba(52,152,219,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s, transform 0.2s",
  },
  fabOpen: {
    background: "#555",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  },
  panel: {
    position: "fixed",
    bottom: 88,
    zIndex: 1100,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e0e0e0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
    padding: 20,
    transformOrigin: "bottom right",
    transition: "transform 0.22s ease, opacity 0.22s ease",
  },
  title: {
    margin: "0 0 2px",
    fontSize: 17,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  subtitle: {
    margin: "0 0 16px",
    fontSize: 13,
    color: "#888",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#444",
    marginBottom: 4,
  },
  select: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    background: "#fff",
    font: "inherit",
  },
  textarea: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    color: "#333",
    marginBottom: 14,
    resize: "vertical",
    font: "inherit",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 10,
    border: "none",
    background: "#3498db",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    font: "inherit",
    transition: "opacity 0.2s",
  },
  success: {
    marginTop: 10,
    marginBottom: 0,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    color: "#2e7d32",
    background: "#e8f5e9",
    textAlign: "center",
  },
  error: {
    marginTop: 10,
    marginBottom: 0,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    color: "#c62828",
    background: "#ffebee",
    textAlign: "center",
  },
};
