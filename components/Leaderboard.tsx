"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardResponse, PublicEntry } from "@/lib/game/leaderboard-service";
import { api, ApiError, formatScore, formatTime } from "@/lib/client/api";
import { Button, ErrorBox, LinkButton, Spinner } from "./ui";

const TABS = [
  { id: "all", label: "전체" },
  { id: "week", label: "주간" },
  { id: "cat:history", label: "역사·사회" },
  { id: "cat:science", label: "과학·기술" },
  { id: "cat:culture", label: "문화·예술" },
  { id: "cat:geo", label: "지리·생활" },
] as const;

export default function Leaderboard() {
  const [scope, setScope] = useState<string>("all");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAround, setShowAround] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (s: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api<LeaderboardResponse>(`/api/leaderboard?scope=${encodeURIComponent(s)}`);
      if (id === reqId.current) setData(r);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof ApiError ? e.message : "순위를 불러오지 못했어요.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);
  useEffect(() => { void load(scope); }, [scope, load]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setScope(TABS[n].id);
    document.getElementById(`tab-${TABS[n].id}`)?.focus();
  };

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6">
      <nav className="mb-2"><Link href="/" className="inline-flex min-h-12 items-center text-sm text-muted underline underline-offset-2">← 홈</Link></nav>
      <h1 className="text-2xl font-extrabold">순위</h1>
      <p className="mt-1 text-sm text-muted">한 사람당 최고 점수 1건만 보여요. 주간 순위는 월요일 00:00(KST)에 초기화돼요.</p>

      <div role="tablist" aria-label="순위 종류" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={scope === t.id}
            aria-controls="board"
            tabIndex={scope === t.id ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => setScope(t.id)}
            className={`min-h-12 shrink-0 rounded-full border-2 px-4 font-semibold ${scope === t.id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="board" role="tabpanel" aria-labelledby={`tab-${scope}`} aria-busy={loading} className="mt-3">
        {loading && !data ? (
          <Spinner label="순위를 불러오고 있어요…" />
        ) : error ? (
          <ErrorBox message={error} onRetry={() => void load(scope)} />
        ) : data && data.entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center" data-testid="empty">
            <p className="text-lg font-bold">아직 등록된 기록이 없어요</p>
            <p className="mt-1 text-muted">첫 번째 주인공이 되어 보세요!</p>
            <LinkButton href="/play" className="mt-4">게임 시작</LinkButton>
          </div>
        ) : data ? (
          <>
            <p className="mb-2 text-sm text-muted" aria-live="polite">{data.label} · 총 {data.total}명</p>
            <ol className={`grid gap-2 ${loading ? "opacity-60" : ""}`} data-testid="board-list">
              {data.entries.map((e) => <Row key={e.rank} e={e} />)}
            </ol>
          </>
        ) : null}
      </div>

      <MyBar data={data} showAround={showAround} setShowAround={setShowAround} />
    </main>
  );
}

function Row({ e }: { e: PublicEntry }) {
  const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${e.isMe ? "border-brand bg-brand-soft text-brand-soft-ink" : "border-line bg-surface"}`}
      aria-current={e.isMe ? "true" : undefined}
      data-testid="row"
    >
      <span className="w-10 shrink-0 text-center text-lg font-extrabold tabular-nums" aria-label={`${e.rank}위`}>
        {medal ? <><span aria-hidden>{medal}</span><span className="sr-only">{e.rank}위</span></> : e.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {e.nickname}
          {e.isMe && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs text-brand-ink">나</span>}
        </span>
        <span className="block text-xs opacity-80">정답 {e.correctCount}/40 · {formatTime(e.totalTimeMs)}</span>
      </span>
      <span className="text-right">
        <span className="block text-lg font-extrabold tabular-nums">{formatScore(e.score)}</span>
        {e.tied && <span className="block text-xs opacity-80">동점 · 정답수/시간순</span>}
      </span>
    </li>
  );
}

function MyBar({ data, showAround, setShowAround }: { data: LeaderboardResponse | null; showAround: boolean; setShowAround: (v: boolean) => void }) {
  if (!data) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" data-testid="my-bar">
      {showAround && data.me && (
        <div className="mx-auto max-h-[45vh] w-full max-w-2xl overflow-y-auto px-4 pt-3">
          <p className="mb-2 text-sm font-semibold">내 주변 순위 (앞뒤 3명)</p>
          <ol className="grid gap-2 pb-2">{data.me.around.map((e) => <Row key={e.rank} e={e} />)}</ol>
        </div>
      )}
      <div className="mx-auto flex min-h-16 w-full max-w-2xl items-center justify-between gap-3 px-4 py-2">
        {data.me ? (
          <>
            <p aria-live="polite">
              <span className="text-sm text-muted">내 순위 </span>
              <b className="text-xl tabular-nums" data-testid="my-rank">{data.me.entry.rank}위</b>
              <span className="ml-2 tabular-nums">{formatScore(data.me.entry.score)}점</span>
            </p>
            <Button variant="secondary" aria-expanded={showAround} onClick={() => setShowAround(!showAround)}>
              {showAround ? "닫기" : "주변 순위"}
            </Button>
          </>
        ) : data.myPending ? (
          <p className="text-sm">내 기록은 <b>검토 중</b>이에요. 확인되면 순위표에 표시돼요.</p>
        ) : (
          <>
            <p className="text-sm text-muted">아직 이 순위에 내 기록이 없어요.</p>
            <LinkButton href="/play">도전하기</LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
