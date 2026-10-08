"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { checkNicknameFormat, NICKNAME_MAX, NICKNAME_MIN } from "@/lib/nickname-rules";
import { Button } from "./ui";

export interface RegisterResult {
  status: "visible" | "pending";
  nickname: string;
  ranks: Record<string, number | null>;
}

/** 순위 등록용 닉네임 입력 모달. 형식 오류는 즉시, 금칙어·쿨다운은 서버 메시지로 안내한다. */
export default function RegisterDialog({
  open, sessionId, initialNickname, onClose, onDone,
}: { open: boolean; sessionId: string; initialNickname: string; onClose: () => void; onDone: (r: RegisterResult) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [nick, setNick] = useState(initialNickname);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNick(initialNickname); }, [initialNickname]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = checkNicknameFormat(nick);
    if (!f.ok) { setError(f.message); return; }
    setBusy(true);
    setError("");
    try {
      onDone(await api<RegisterResult>("/api/leaderboard", { body: { sessionId, nickname: f.value } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "등록하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="reg-title"
      onClose={onClose}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 shadow-xl"
    >
      <form onSubmit={submit} noValidate>
        <h2 id="reg-title" className="text-lg font-bold">순위에 등록하기</h2>
        <p className="mt-1 text-sm text-muted">순위표에 보일 닉네임을 정해 주세요. 가입은 필요 없어요.</p>
        <label htmlFor="nickname" className="mt-4 block font-medium">닉네임</label>
        <input
          id="nickname"
          name="nickname"
          value={nick}
          onChange={(e) => { setNick(e.target.value); setError(""); }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby="nick-help nick-error"
          className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-app px-3 text-base"
        />
        <p id="nick-help" className="mt-1 text-xs text-muted">
          {NICKNAME_MIN}~{NICKNAME_MAX}자 · 한글, 영문, 숫자, 공백, _ , - · 7일에 한 번만 바꿀 수 있어요
        </p>
        <p id="nick-error" role="alert" className="mt-2 min-h-5 text-sm font-semibold text-bad-ink dark:text-bad-line">
          {error && <>⚠ {error}</>}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={busy}>{busy ? "등록 중…" : "등록"}</Button>
        </div>
      </form>
    </dialog>
  );
}
