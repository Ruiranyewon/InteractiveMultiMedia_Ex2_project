"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HistoryItem } from "@/lib/game/leaderboard-service";
import { api, ApiError, formatDate, formatScore } from "@/lib/client/api";
import { loadMe, type Me } from "@/lib/client/player";
import { Card, ErrorBox, LinkButton, Spinner } from "./ui";

const STATUS: Record<HistoryItem["status"], string> = { completed: "완주", active: "진행 중", abandoned: "중단" };

function regLabel(h: HistoryItem): string {
  if (h.status !== "completed") return "—";
  if (!h.registered) return "미등록";
  return h.registrationStatus === "pending" ? "검토 중" : h.registrationStatus === "rejected" ? "미노출" : h.registrationStatus === "hidden" ? "숨김" : "등록됨";
}

export default function MyHistory() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, h] = await Promise.all([loadMe(), api<{ items: HistoryItem[] }>("/api/me/history")]);
      setMe(m);
      setItems(h.items);
    } catch (e) { setError(e instanceof ApiError ? e.message : "기록을 불러오지 못했어요."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
      <nav className="mb-2"><Link href="/" className="inline-flex min-h-12 items-center text-sm text-muted underline underline-offset-2">← 홈</Link></nav>
      <h1 className="text-2xl font-extrabold">내 기록</h1>
      {me && (
        <Card className="mt-4">
          <p className="text-sm text-muted">{me.nickname ? `닉네임 ${me.nickname}` : "닉네임 미설정 (순위 등록 때 정해요)"}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{me.bestScore ? `${formatScore(me.bestScore)}점` : "—"}<span className="ml-2 text-base font-semibold text-muted">최고 점수</span></p>
        </Card>
      )}
      <p className="mt-4 text-sm text-muted">최근 20판만 보여요. 이 기기(브라우저)의 익명 기록이에요.</p>
      {error ? (
        <div className="mt-3"><ErrorBox message={error} onRetry={() => void load()} /></div>
      ) : !items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-line p-8 text-center" data-testid="empty">
          <p className="text-lg font-bold">아직 플레이 기록이 없어요</p>
          <LinkButton href="/play" className="mt-4">게임 시작</LinkButton>
        </div>
      ) : (
        <ul className="mt-3 grid gap-2" data-testid="history-list">
          {items.map((h) => (
            <li key={h.sessionId} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted">{formatDate(h.startedAt)}</span>
                <span className="text-sm font-semibold">{STATUS[h.status]}</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <span className="text-2xl font-extrabold tabular-nums">{formatScore(h.totalScore)}<span className="ml-1 text-sm font-semibold text-muted">점</span></span>
                <span className="text-sm">
                  {h.status === "completed" ? `정답 ${h.correctCount}/40` : `${h.answered}/40 진행`} · 순위 {regLabel(h)}
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-sm">
                {h.status === "completed" && <Link className="inline-flex min-h-12 items-center underline underline-offset-2" href={`/result/${h.sessionId}`}>결과 보기</Link>}
                {h.status === "active" && <Link className="inline-flex min-h-12 items-center underline underline-offset-2" href="/play">이어하기</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
