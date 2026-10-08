"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/db/types";
import { ErrorBox, Spinner } from "@/components/ui";
import AdminShell from "./AdminShell";

interface QStat { id: string; category: keyof typeof CATEGORY_LABELS; question: string; answerCount: number; correctRate: number }
interface Stats {
  overview: { sessionsStarted: number; sessionsCompleted: number; sessionsAbandoned: number; completionRate: number | null; leaderboardSubmits: number; daily: Array<{ date: string; started: number; completed: number }> };
  minAnswers: number; easiest: QStat[]; hardest: QStat[]; events: Array<{ name: string; count: number }>; errors: Array<{ ts: number; source: string; message: string }>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-surface p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd></div>;
}

function QTable({ title, rows, min }: { title: string; rows: QStat[]; min: number }) {
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-bold">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">응답이 {min}건 이상인 문제가 아직 없어요.</p> : (
        <ol className="mt-2 grid gap-2 text-sm">
          {rows.map((q) => <li key={q.id}><b className="tabular-nums">{q.correctRate}%</b> <span className="text-muted">({q.answerCount}건)</span> · {CATEGORY_LABELS[q.category]} · {q.question}</li>)}
        </ol>
      )}
    </section>
  );
}

export default function AdminStats() {
  return <AdminShell title="통계"><Body /></AdminShell>;
}

function Body() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e instanceof ApiError ? e.message : "불러오지 못했어요.")); }, []);
  if (err) return <div className="mt-4"><ErrorBox message={err} /></div>;
  if (!s) return <Spinner />;
  const o = s.overview;
  const maxDay = Math.max(1, ...o.daily.map((d) => d.started));
  return (
    <div className="mt-4 grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="게임 시작" value={String(o.sessionsStarted)} />
        <Tile label="완주" value={String(o.sessionsCompleted)} />
        <Tile label="완주율" value={o.completionRate === null ? "—" : `${o.completionRate}%`} />
        <Tile label="순위 등록" value={String(o.leaderboardSubmits)} />
      </dl>
      <section aria-label="일별 플레이 수" className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-bold">일별 플레이 수 (KST)</h2>
        {o.daily.length === 0 ? <p className="mt-2 text-sm text-muted">아직 플레이 기록이 없어요.</p> : (
          <ul className="mt-2 grid gap-1.5" data-testid="daily">
            {o.daily.map((d) => (
              <li key={d.date} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
                <span className="tabular-nums">{d.date}</span>
                <span className="h-3 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full bg-brand" style={{ width: `${(d.started / maxDay) * 100}%` }} /></span>
                <span className="tabular-nums">{d.started}판 (완주 {d.completed})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <QTable title="정답률 높은 문제 TOP 5" rows={s.easiest} min={s.minAnswers} />
        <QTable title="정답률 낮은 문제 TOP 5" rows={s.hardest} min={s.minAnswers} />
      </div>
      <section aria-label="이벤트 집계" className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-bold">이벤트 집계</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">{s.events.map((e) => <li key={e.name} className="rounded-full bg-brand-soft px-3 py-1 text-brand-soft-ink">{e.name} <b>{e.count}</b></li>)}</ul>
      </section>
      <section aria-label="최근 서버 오류" className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-bold">최근 오류 로그</h2>
        {s.errors.length === 0 ? <p className="mt-2 text-sm text-muted">기록된 오류가 없어요.</p> : (
          <ul className="mt-2 grid gap-1 text-sm">{s.errors.map((e, i) => <li key={i}><span className="text-muted">{new Date(e.ts).toLocaleString("ko-KR")}</span> [{e.source}] {e.message}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
