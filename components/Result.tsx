"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "@/lib/game/service";
import { CATEGORY_LABELS } from "@/lib/db/types";
import { api, ApiError, formatScore, formatTime } from "@/lib/client/api";
import { loadMe } from "@/lib/client/player";
import { Button, Card, ErrorBox, LinkButton, Spinner } from "./ui";
import RegisterDialog, { type RegisterResult } from "./RegisterDialog";

interface HistoryItem { sessionId: string; registered: boolean; registrationStatus: string | null }

const GRADE_EMOJI: Record<string, string> = { 지식왕: "👑", 박사: "🎓", 탐험가: "🧭", 새싹: "🌱" };

export default function Result({ sessionId }: { sessionId: string }) {
  const [res, setRes] = useState<GameResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [registered, setRegistered] = useState<{ status: string; ranks?: Record<string, number | null>; nickname?: string } | null>(null);
  const [nickname, setNickname] = useState("");
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, me, hist] = await Promise.all([
        api<GameResult>(`/api/sessions/${sessionId}/result`),
        loadMe().catch(() => null),
        api<{ items: HistoryItem[] }>("/api/me/history").catch(() => ({ items: [] as HistoryItem[] })),
      ]);
      setRes(r);
      setNickname(me?.nickname ?? "");
      const mine = hist.items.find((h) => h.sessionId === sessionId);
      if (mine?.registered) setRegistered({ status: mine.registrationStatus ?? "visible" });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "ERROR", "결과를 불러오지 못했어요."));
    }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);

  const share = async () => {
    if (!res) return;
    const url = `${location.origin}/share/${sessionId}`;
    const text = `상식 퀴즈에서 ${formatScore(res.totalScore)}점(${res.grade})을 받았어요!`;
    let channel = "copy_link";
    try {
      if (navigator.share) {
        channel = "web_share";
        await navigator.share({ title: "QuizUp 상식", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast("링크를 복사했어요!");
      }
      void api("/api/events", { body: { name: "share_click", channel } }).catch(() => {});
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return; // 사용자가 공유 창을 닫음
      try { await navigator.clipboard.writeText(url); setToast("링크를 복사했어요!"); void api("/api/events", { body: { name: "share_click", channel: "copy_link" } }).catch(() => {}); }
      catch { setToast(`공유 링크: ${url}`); }
    }
  };

  if (error) {
    return (
      <Shell>
        <ErrorBox
          message={error.status === 409 ? "아직 끝나지 않은 게임이에요." : error.status === 403 ? "이 게임의 결과는 본인만 볼 수 있어요." : error.message}
          onRetry={error.status === 0 || error.status >= 500 ? load : undefined}
        />
        <div className="mt-4"><LinkButton href={error.status === 409 ? "/play" : "/"} variant="secondary">{error.status === 409 ? "이어서 하기" : "홈으로"}</LinkButton></div>
      </Shell>
    );
  }
  if (!res) return <Shell><Spinner label="결과를 계산하고 있어요…" /></Shell>;

  const maxCat = 1950; // 카테고리 최대 점수 (10문제 × 150 + 연속 보너스 상한 근사). 막대는 상대 비교용
  const catMax = Math.max(maxCat, ...res.categories.map((c) => c.score));

  return (
    <Shell>
      <h1 className="text-center text-sm font-semibold text-brand">최종 결과</h1>
      <Card className="mt-2 text-center">
        <p className="text-5xl" aria-hidden>{GRADE_EMOJI[res.grade] ?? "🎉"}</p>
        <p className="mt-2 text-lg font-bold" data-testid="grade">{res.grade}</p>
        <p className="mt-1 text-5xl font-extrabold tabular-nums" data-testid="total-score">{formatScore(res.totalScore)}<span className="ml-1 text-xl font-semibold text-muted">점</span></p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <Stat label="정답" value={`${res.correctCount}/${res.totalQuestions}`} />
          <Stat label="정답률" value={`${res.accuracy}%`} />
          <Stat label="소요 시간" value={formatTime(res.totalTimeMs)} />
        </dl>
      </Card>

      <Card className="mt-4" aria-labelledby="cat-h">
        <h2 id="cat-h" className="font-bold">카테고리별 점수</h2>
        <ul className="mt-3 grid gap-3">
          {res.categories.map((c) => (
            <li key={c.category}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{CATEGORY_LABELS[c.category]}</span>
                <span className="tabular-nums">{formatScore(c.score)}점 · {c.correct}/{c.total}</span>
              </div>
              <div className="mt-1 h-4 overflow-hidden rounded-full bg-line" role="img" aria-label={`${CATEGORY_LABELS[c.category]} ${c.score}점`}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (c.score / catMax) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-3">
        {registered ? (
          <Card className="border-ok-line bg-ok-bg text-ok-ink" role="status">
            {registered.status === "pending" ? (
              <p><b>등록했어요.</b> 비정상적으로 빠른 응답이 감지되어 검토 후 순위표에 표시돼요.</p>
            ) : (
              <p>
                <b>✓ 순위에 등록했어요!</b>
                {registered.ranks && (
                  <span data-testid="rank-info">
                    {" "}전체 {registered.ranks.all ?? "-"}위 · 주간 {registered.ranks.week ?? "-"}위
                  </span>
                )}
              </p>
            )}
            <Link className="mt-2 inline-block min-h-12 py-3 font-semibold underline" href="/leaderboard">순위표 보기</Link>
          </Card>
        ) : (
          <Button onClick={() => setDialog(true)} data-testid="register-open" className="min-h-14 text-lg">🏆 순위 등록</Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => void share()} data-testid="share">🔗 공유</Button>
          <LinkButton href="/leaderboard" variant="secondary">순위표</LinkButton>
        </div>
        <LinkButton href="/play" variant="secondary" data-testid="again">다시 하기</LinkButton>
      </div>
      <p role="status" className="mt-2 min-h-6 text-center text-sm text-muted">{toast}</p>

      <section className="mt-6" aria-labelledby="wrong-h">
        <h2 id="wrong-h" className="text-lg font-bold">오답 복습 <span className="text-muted">({res.wrong.length})</span></h2>
        {res.wrong.length === 0 ? (
          <p className="mt-2 rounded-xl bg-ok-bg p-4 text-ok-ink">🎉 모두 맞혔어요! 복습할 문제가 없어요.</p>
        ) : (
          <ol className="mt-3 grid gap-3">
            {res.wrong.map((w, i) => (
              <li key={w.questionId} className="rounded-xl border border-line bg-surface p-4" data-testid="wrong-item">
                <p className="text-xs font-semibold text-muted">{CATEGORY_LABELS[w.category]}</p>
                <p className="mt-1 font-semibold">{i + 1}. {w.question}</p>
                <p className="mt-2 text-sm"><span className="font-semibold text-bad-ink dark:text-bad-line">✗ 내 답</span> {w.timedOut || w.myAnswer === null ? "시간 초과(무응답)" : w.myAnswer}</p>
                <p className="mt-1 text-sm"><span className="font-semibold text-ok-ink dark:text-ok-line">✓ 정답</span> {w.correctAnswer}</p>
                {w.explanation && <p className="mt-2 rounded-lg bg-brand-soft p-2 text-sm text-brand-soft-ink">💡 {w.explanation}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <RegisterDialog
        open={dialog}
        sessionId={sessionId}
        initialNickname={nickname}
        onClose={() => setDialog(false)}
        onDone={(r) => { setRegistered({ status: r.status, ranks: r.ranks, nickname: r.nickname }); setDialog(false); }}
      />
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-soft p-3 text-brand-soft-ink">
      <dt>{label}</dt>
      <dd className="text-lg font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
      <nav className="mb-3"><Link href="/" className="inline-flex min-h-12 items-center text-sm text-muted underline underline-offset-2">← 홈</Link></nav>
      {children}
    </main>
  );
}
