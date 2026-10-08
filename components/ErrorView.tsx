"use client";
import { useEffect } from "react";

/** error.tsx / global-error.tsx 공용 본문. 오류를 서버 로그에 보고한다(개인정보 없이 메시지만). */
export default function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }),
    }).catch(() => {});
  }, [error]);

  return (
    <main id="main" style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>앗, 문제가 생겼어요</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>일시적인 오류일 수 있어요. 다시 시도해도 안 되면 홈으로 돌아가 주세요.</p>
      <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#4338ca", color: "#fff", fontWeight: 700, fontSize: 16 }}
        >
          다시 시도
        </button>
        <a href="/" style={{ minHeight: 48, display: "inline-flex", alignItems: "center", padding: "0 20px", borderRadius: 12, border: "1px solid #888", color: "inherit", fontWeight: 700 }}>
          홈으로
        </a>
      </div>
    </main>
  );
}
