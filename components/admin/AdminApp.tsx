"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, formatDate, formatScore, formatTime } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/db/types";
import { REPORT_REASON_LABELS, type ReportReasonId } from "@/lib/report-reasons";
import { Button, ErrorBox, Spinner } from "@/components/ui";
import AdminShell from "./AdminShell";

type Tab = "questions" | "reports" | "leaderboard" | "flags";
const TABS: Array<[Tab, string]> = [["questions", "문제"], ["reports", "신고 검토"], ["leaderboard", "순위 항목"], ["flags", "검토 대기(플래그)"]];
const STATUS_LABEL: Record<string, string> = { published: "게시", draft: "비공개", under_review: "검토 중", visible: "노출", hidden: "숨김", pending: "대기", rejected: "거부" };

const inputCls = "min-h-11 rounded-lg border-2 border-line bg-surface px-2";

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("questions");
  return (
    <AdminShell title="운영">
      <div role="tablist" aria-label="관리 메뉴" className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" type="button" id={`atab-${id}`} aria-selected={tab === id} aria-controls="apanel" onClick={() => setTab(id)}
            className={`min-h-12 rounded-full border-2 px-4 font-semibold ${tab === id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface"}`}>
            {label}
          </button>
        ))}
      </div>
      <div id="apanel" role="tabpanel" aria-labelledby={`atab-${tab}`} className="mt-4">
        {tab === "questions" && <QuestionsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "flags" && <FlagsTab />}
      </div>
    </AdminShell>
  );
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await api<T>(path)); } catch (e) { setError(e instanceof ApiError ? e.message : "불러오지 못했어요."); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, load };
}

// ---------- 문제 ----------
interface QRow { id: string; category: keyof typeof CATEGORY_LABELS; difficulty: number; question: string; status: string; reports: number; answerCount: number; correctRate: number | null }
interface QFull { id?: string; category: string; difficulty: number; question: string; choices: string[]; answerIndex: number; explanation: string | null; source: string | null; status: string }
const EMPTY_Q: QFull = { category: "history", difficulty: 2, question: "", choices: ["", "", "", ""], answerIndex: 0, explanation: "", source: "", status: "draft" };

function QuestionsTab() {
  const [f, setF] = useState({ category: "", status: "", search: "", minRate: "", maxRate: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, error, load } = useLoad<{ items: QRow[] }>(`/api/admin/questions?${qs}`);
  const [editing, setEditing] = useState<QFull | null>(null);
  const [msg, setMsg] = useState("");

  const setStatus = async (id: string, status: string) => {
    try { await api(`/api/admin/questions/${id}`, { method: "PATCH", body: { status } }); setMsg(`${id}: ${STATUS_LABEL[status]}로 변경했어요.`); await load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "변경하지 못했어요."); }
  };
  const edit = async (id: string) => {
    const r = await api<{ question: QFull }>(`/api/admin/questions/${id}`);
    setEditing(r.question);
  };

  return (
    <div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="문제 필터">
        <label className="grid gap-1 text-sm">카테고리
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">전체</option>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="grid gap-1 text-sm">상태
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">전체</option><option value="published">게시</option><option value="draft">비공개</option><option value="under_review">검토 중</option>
          </select></label>
        <label className="grid gap-1 text-sm">검색
          <input className={inputCls} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="문제 또는 ID" /></label>
        <label className="grid gap-1 text-sm">정답률 ≥ (%)
          <input className={`${inputCls} w-24`} inputMode="numeric" value={f.minRate} onChange={(e) => setF({ ...f, minRate: e.target.value })} /></label>
        <label className="grid gap-1 text-sm">정답률 ≤ (%)
          <input className={`${inputCls} w-24`} inputMode="numeric" value={f.maxRate} onChange={(e) => setF({ ...f, maxRate: e.target.value })} /></label>
        <Button type="button" onClick={() => setEditing({ ...EMPTY_Q })}>＋ 문제 추가</Button>
      </form>
      <p role="status" className="mt-2 min-h-6 text-sm text-muted">{msg}</p>

      {error ? <ErrorBox message={error} onRetry={() => void load()} /> : !data ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm" data-testid="admin-questions">
            <caption className="sr-only">문제 목록 {data.items.length}건</caption>
            <thead><tr className="border-b border-line">{["ID", "분류", "난이도", "문제", "상태", "신고", "응답 수", "정답률", "작업"].map((h) => <th key={h} scope="col" className="py-2 pr-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {data.items.map((q) => (
                <tr key={q.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{q.id}</td>
                  <td className="pr-3">{CATEGORY_LABELS[q.category]}</td>
                  <td className="pr-3">{q.difficulty}</td>
                  <td className="max-w-md pr-3">{q.question}</td>
                  <td className="pr-3">{STATUS_LABEL[q.status] ?? q.status}</td>
                  <td className="pr-3">{q.reports}</td>
                  <td className="pr-3 tabular-nums">{q.answerCount}</td>
                  <td className="pr-3 tabular-nums">{q.correctRate === null ? "—" : `${q.correctRate}%`}</td>
                  <td className="whitespace-nowrap">
                    <Button variant="ghost" className="min-h-11 px-2" onClick={() => void edit(q.id)}>수정</Button>
                    {q.status === "published"
                      ? <Button variant="ghost" className="min-h-11 px-2" onClick={() => void setStatus(q.id, "draft")}>비공개</Button>
                      : <Button variant="ghost" className="min-h-11 px-2" onClick={() => void setStatus(q.id, "published")}>게시</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <p className="py-6 text-center text-muted">조건에 맞는 문제가 없어요.</p>}
        </div>
      )}
      {editing && <QuestionForm initial={editing} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); setMsg(m); void load(); }} />}
    </div>
  );
}

function QuestionForm({ initial, onClose, onSaved }: { initial: QFull; onClose: () => void; onSaved: (msg: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<QFull>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { ref.current?.showModal(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    try {
      const r = await api<{ id: string }>(q.id ? `/api/admin/questions/${q.id}` : "/api/admin/questions", { method: q.id ? "PUT" : "POST", body: q });
      onSaved(`${r.id} 저장했어요.`);
    } catch (e2) {
      const list = e2 instanceof ApiError ? (e2.data?.errors as string[] | undefined) ?? [e2.message] : ["저장하지 못했어요."];
      setErrors(list);
    }
  };
  const set = <K extends keyof QFull>(k: K, v: QFull[K]) => setQ({ ...q, [k]: v });

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="qf-title" className="m-auto w-[min(94vw,40rem)] rounded-2xl border border-line bg-surface p-5">
      <form onSubmit={save} className="grid gap-3">
        <h2 id="qf-title" className="text-lg font-bold">{q.id ? `문제 수정 (${q.id})` : "문제 추가"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">카테고리
            <select className={inputCls} value={q.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="grid gap-1 text-sm">난이도
            <select className={inputCls} value={q.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              <option value={1}>1 (하)</option><option value={2}>2 (중)</option><option value={3}>3 (상)</option></select></label>
        </div>
        <label className="grid gap-1 text-sm">문제
          <textarea className={`${inputCls} py-2`} rows={2} value={q.question} onChange={(e) => set("question", e.target.value)} /></label>
        <fieldset className="grid gap-2">
          <legend className="text-sm">보기 (정답을 선택)</legend>
          {q.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="answer" aria-label={`${i + 1}번을 정답으로`} checked={q.answerIndex === i} onChange={() => set("answerIndex", i)} className="h-5 w-5" />
              <input className={`${inputCls} flex-1`} aria-label={`보기 ${i + 1}`} value={c} onChange={(e) => set("choices", q.choices.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </fieldset>
        <label className="grid gap-1 text-sm">해설 (필수)
          <textarea className={`${inputCls} py-2`} rows={2} value={q.explanation ?? ""} onChange={(e) => set("explanation", e.target.value)} /></label>
        <label className="grid gap-1 text-sm">출처 (URL, 권장)
          <input className={inputCls} value={q.source ?? ""} onChange={(e) => set("source", e.target.value)} /></label>
        <label className="grid gap-1 text-sm">상태
          <select className={inputCls} value={q.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">비공개(초안)</option><option value="published">게시</option><option value="under_review">검토 중</option></select></label>
        {errors.length > 0 && <ul role="alert" className="list-disc rounded-lg bg-bad-bg p-3 pl-7 text-sm text-bad-ink">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>취소</Button><Button type="submit">저장</Button></div>
      </form>
    </dialog>
  );
}

// ---------- 신고 ----------
interface ReportItem { question: QFull & { id: string; status: string; reports: number }; stat?: { answerCount: number; correctRate: number | null }; reports: Array<{ id: number; reason: string; createdAt: number }> }

function ReportsTab() {
  const { data, error, load } = useLoad<{ items: ReportItem[] }>("/api/admin/reports");
  const act = async (id: string, body: object) => { await api(`/api/admin/questions/${id}`, { method: "PATCH", body }); await load(); };
  if (error) return <ErrorBox message={error} onRetry={() => void load()} />;
  if (!data) return <Spinner />;
  if (data.items.length === 0) return <p className="py-8 text-center text-muted" data-testid="no-reports">접수된 신고가 없어요.</p>;
  return (
    <ul className="grid gap-3" data-testid="admin-reports">
      {data.items.map((it) => {
        const counts: Record<string, number> = {};
        it.reports.forEach((r) => (counts[r.reason] = (counts[r.reason] ?? 0) + 1));
        return (
          <li key={it.question.id} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-muted">{it.question.id} · {STATUS_LABEL[it.question.status]} · 신고 {it.reports.length}건</p>
            <p className="mt-1 font-semibold">{it.question.question}</p>
            <ol className="mt-1 text-sm">{it.question.choices.map((c, i) => <li key={i}>{i === it.question.answerIndex ? "✓" : "·"} {c}</li>)}</ol>
            <p className="mt-1 text-sm text-muted">해설: {it.question.explanation}</p>
            <p className="mt-1 text-sm">사유: {Object.entries(counts).map(([r, n]) => `${REPORT_REASON_LABELS[r as ReportReasonId] ?? r} ×${n}`).join(", ")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void act(it.question.id, { status: "published", clearReports: true })}>이상 없음 · 게시 복구</Button>
              <Button variant="secondary" onClick={() => void act(it.question.id, { status: "draft" })}>비공개로 전환</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- 순위 ----------
interface AdminEntry { id: number; nickname: string | null; score: number; correctCount: number; totalTimeMs: number; status: string; createdAt: number; sessionId: string }
function LeaderboardTab() {
  const [scope, setScope] = useState("all");
  const { data, error, load } = useLoad<{ scope: string; items: AdminEntry[] }>(`/api/admin/leaderboard?scope=${encodeURIComponent(scope)}`);
  const patch = async (id: number, status: string) => { await api(`/api/admin/leaderboard/${id}`, { method: "PATCH", body: { status } }); await load(); };
  const del = async (id: number) => { if (confirm("이 순위 항목을 삭제할까요? 되돌릴 수 없어요.")) { await api(`/api/admin/leaderboard/${id}`, { method: "DELETE" }); await load(); } };
  return (
    <div>
      <label className="grid w-fit gap-1 text-sm">순위 종류
        <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">전체</option><option value="week">이번 주</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={`cat:${k}`}>{v}</option>)}</select></label>
      {error ? <ErrorBox message={error} onRetry={() => void load()} /> : !data ? <Spinner /> : data.items.length === 0 ? <p className="py-8 text-center text-muted">항목이 없어요.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm" data-testid="admin-entries">
            <caption className="sr-only">순위 항목</caption>
            <thead><tr className="border-b border-line">{["닉네임", "점수", "정답", "시간", "상태", "등록", "작업"].map((h) => <th key={h} scope="col" className="py-2 pr-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3">{e.nickname ?? "—"}</td><td className="pr-3 tabular-nums">{formatScore(e.score)}</td>
                  <td className="pr-3">{e.correctCount}</td><td className="pr-3">{formatTime(e.totalTimeMs)}</td>
                  <td className="pr-3">{STATUS_LABEL[e.status] ?? e.status}</td><td className="pr-3">{formatDate(e.createdAt)}</td>
                  <td className="whitespace-nowrap">
                    {e.status === "visible" ? <Button variant="ghost" className="min-h-11 px-2" onClick={() => void patch(e.id, "hidden")}>숨김</Button>
                      : <Button variant="ghost" className="min-h-11 px-2" onClick={() => void patch(e.id, "visible")}>노출</Button>}
                    <Button variant="ghost" className="min-h-11 px-2" onClick={() => void del(e.id)}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- 플래그 ----------
interface FlagItem { sessionId: string; startedAt: number; status: string; totalScore: number; correctCount: number; answered: number; totalTimeMs: number; nickname: string | null; entryStatus: string | null }
function FlagsTab() {
  const { data, error, load } = useLoad<{ items: FlagItem[] }>("/api/admin/flags");
  const act = async (id: string, action: "approve" | "reject") => { await api(`/api/admin/flags/${id}`, { body: { action } }); await load(); };
  if (error) return <ErrorBox message={error} onRetry={() => void load()} />;
  if (!data) return <Spinner />;
  if (data.items.length === 0) return <p className="py-8 text-center text-muted" data-testid="no-flags">검토할 플래그 세션이 없어요.</p>;
  return (
    <div>
      <p className="mb-2 text-sm text-muted">300ms 미만 제출이 연속 5회 이상 감지된 세션이에요. 승인하면 순위표에 노출되고, 거부하면 숨겨져요.</p>
      <ul className="grid gap-3" data-testid="admin-flags">
        {data.items.map((f) => (
          <li key={f.sessionId} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-muted">{formatDate(f.startedAt)} · {f.sessionId}</p>
            <p className="mt-1 font-semibold">{f.nickname ?? "(닉네임 없음)"} · {formatScore(f.totalScore)}점 · 정답 {f.correctCount}/40 · {formatTime(f.totalTimeMs)}</p>
            <p className="text-sm">진행 {f.answered}/40 · 세션 {f.status} · 순위 항목 {f.entryStatus ? STATUS_LABEL[f.entryStatus] : "미등록"}</p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => void act(f.sessionId, "approve")}>승인</Button>
              <Button variant="danger" onClick={() => void act(f.sessionId, "reject")}>거부</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
