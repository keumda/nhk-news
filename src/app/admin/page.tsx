"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
  const [translationPrompt, setTranslationPrompt] = useState("");
  const [verbAnalysisPrompt, setVerbAnalysisPrompt] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/nhk/prompts")
      .then((r) => r.json())
      .then((data) => {
        setTranslationPrompt(data.translationPrompt);
        setVerbAnalysisPrompt(data.verbAnalysisPrompt);
        setUpdatedAt(data.updatedAt);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nhk/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translationPrompt, verbAnalysisPrompt }),
      });
      if (res.ok) {
        setUpdatedAt(new Date().toISOString());
        setMessage({ type: "success", text: "저장 완료" });
      } else {
        setMessage({ type: "error", text: "저장 실패" });
      }
    } catch {
      setMessage({ type: "error", text: "네트워크 오류" });
    }
    setSaving(false);
  };

  const handleReset = async (field: "translation" | "verb") => {
    setMessage(null);
    try {
      // Fetch defaults by clearing saved and getting fresh
      const res = await fetch("/api/nhk/prompts");
      const data = await res.json();

      // To get actual defaults we need to import — but since this is client side,
      // we just refetch after resetting
      const module = await import("@/lib/prompts");
      if (field === "translation") {
        setTranslationPrompt(module.DEFAULT_TRANSLATION_PROMPT);
      } else {
        setVerbAnalysisPrompt(module.DEFAULT_VERB_ANALYSIS_PROMPT);
      }
      setMessage({ type: "success", text: "기본값으로 복원됨 (저장을 눌러야 반영됩니다)" });
    } catch {
      setMessage({ type: "error", text: "기본값 복원 실패" });
    }
  };

  if (loading) return <div style={styles.container}><p style={styles.loading}>로딩 중...</p></div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Admin - Prompt Settings</h1>
        <a href="/" style={styles.backLink}>← 메인으로</a>
      </div>

      {message && (
        <div style={{
          ...styles.message,
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
        }}>
          {message.text}
        </div>
      )}

      {updatedAt && (
        <p style={styles.updatedAt}>
          마지막 수정: {new Date(updatedAt).toLocaleString("ko-KR")}
        </p>
      )}

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>번역 프롬프트</h2>
          <button onClick={() => handleReset("translation")} style={styles.resetBtn}>
            기본값 복원
          </button>
        </div>
        <p style={styles.hint}>
          기사 문단을 번역할 때 사용됩니다. 번호 형식의 문단이 이 프롬프트 뒤에 자동으로 추가됩니다.
        </p>
        <textarea
          value={translationPrompt}
          onChange={(e) => setTranslationPrompt(e.target.value)}
          style={styles.textarea}
          rows={8}
        />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>단어 분석 프롬프트</h2>
          <button onClick={() => handleReset("verb")} style={styles.resetBtn}>
            기본값 복원
          </button>
        </div>
        <p style={styles.hint}>
          기사의 모든 단어(동사/형용사/한자 명사/문법 표현 등)를 분석할 때 사용됩니다.{" "}
          <code style={styles.code}>{"{{plainText}}"}</code>는 기사 본문으로 자동 치환됩니다.
          AI가 기사에서 학습 가치가 있는 모든 단어를 자동으로 찾아 분석합니다.
        </p>
        <textarea
          value={verbAnalysisPrompt}
          onChange={(e) => setVerbAnalysisPrompt(e.target.value)}
          style={styles.textarea}
          rows={24}
        />
      </section>

      <button onClick={handleSave} disabled={saving} style={{
        ...styles.saveBtn,
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
  },
  backLink: {
    fontSize: 14,
    color: "#3498db",
    textDecoration: "none",
  },
  loading: {
    textAlign: "center" as const,
    color: "#999",
    padding: 40,
  },
  message: {
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
  },
  updatedAt: {
    fontSize: 13,
    color: "#999",
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#333",
    margin: 0,
  },
  resetBtn: {
    fontSize: 12,
    color: "#e67e22",
    background: "none",
    border: "1px solid #e67e22",
    borderRadius: 6,
    padding: "4px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  hint: {
    fontSize: 13,
    color: "#888",
    marginBottom: 10,
    lineHeight: 1.5,
  },
  code: {
    background: "#f5f5f5",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#c0392b",
  },
  textarea: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 1.6,
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  saveBtn: {
    width: "100%",
    padding: "14px 0",
    background: "#2c6fbb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
