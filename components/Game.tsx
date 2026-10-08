"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerResponse, CategorySummary, PublicQuestion } from "@/lib/game/service";
import { CATEGORY_LABELS } from "@/lib/db/types";
import { REPORT_REASON_LABELS, REPORT_REASONS_LIST } from "@/lib/report-reasons";
import { api, ApiError, formatScore } from "@/lib/client/api";
import { feedbackCue } from "@/lib/client/feedback";
import { useSettings } from "@/lib/client/settings";
import { Button, Card, ErrorBox, Spinner } from "./ui";
import SettingsDialog from "./SettingsDialog";

type Phase = "boot" | "resume" | "playing" | "paused" | "summary" | "error";
interface ResumeInfo { sessionId: string; overallIndex: number; overallTotal: number; totalScore: number }
interface SummaryState { cat: CategorySummary; finished: boolean; next: PublicQuestion | null }
type ReportState = "closed" | "open" | "sending" | "done" | "error";

const AUTO_ADVANCE_MS = 2500;
const URGENT_SEC = 5;

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
const isInteractive = (t: EventTarget | null) => t instanceof HTMLElement && ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(t.tagName);

export default function Game() {
  const router = useRouter();
  const settings = useSettings();

  const [phase, setPhase] = useState<Phase>("boot");
  const [errorMsg, setErrorMsg] = useState("");
  const retryRef = useRef<(() => void) | null>(null);

  const [sessionId, setSessionId] = useState("");
  const [q, setQ] = useState<PublicQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [pauseUsed, setPauseUsed] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [summary, setSummary] = useState<SummaryState | null>(null);

  const [deadline, setDeadline] = useState<number | null>(null);
  const [msLeft, setMsLeft] = useState(20000);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [announce, setAnnounce] = useState("");

  const [reportState, setReportState] = useState<ReportState>("closed");
  const [reportReason, setReportReason] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const started = useRef(false);

  const fail = useCallback((e: unknown, retry?: () => void) => {
    setErrorMsg(e instanceof ApiError ? e.message : "알 수 없는 오류가 발생했어요.");
    retryRef.current = retry ?? null;
    setPhase("error");
  }, []);

  // ---------- 문제 표시 ----------
  const present = useCallback(async (question: PublicQuestion, sid: string) => {
    setQ(question);
    setAnswer(null);
    setSelected(null);
    setSubmitting(false);
    setNotice("");
    setReportState("closed");
    setReportReason("");
    setSummary(null);
    setPhase("playing");
    setDeadline(performance.now() + question.timeLimitMs);
    setMsLeft(question.timeLimitMs);
    setAnnounce("");
    try {
      // 화면에 문제를 띄운 시점부터 서버가 20초를 센다.
      const r = await api<{ remainingMs: number }>(`/api/sessions/${sid}/start`, { body: { questionId: question.id } });
      setDeadline(performance.now() + r.remainingMs);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return; // 이미 다른 상태: 다음 제출에서 동기화
    }
  }, []);

  useEffect(() => { if (phase === "playing" && q && !answer) headingRef.current?.focus(); }, [q?.id, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (answer) nextRef.current?.focus(); }, [answer]);

  // ---------- 시작 / 이어하기 ----------
  const startNew = useCallback(async () => {
    setPhase("boot");
    try {
      const r = await api<{ sessionId: string; question: PublicQuestion }>("/api/sessions", { method: "POST", body: {} });
      setSessionId(r.sessionId);
      setScore(0);
      setPauseUsed(false);
      await present(r.question, r.sessionId);
    } catch (e) { fail(e, () => void startNew()); }
  }, [fail, present]);

  const resume = useCallback(async (info: ResumeInfo) => {
    setPhase("boot");
    try {
      const r = await api<{ question: PublicQuestion; totalScore: number; pauseUsed: boolean }>(`/api/sessions/${info.sessionId}/resume`, { body: {} });
      setSessionId(info.sessionId);
      setScore(r.totalScore);
      setPauseUsed(r.pauseUsed);
      await present(r.question, info.sessionId);
    } catch (e) { fail(e, () => void startNew()); }
  }, [fail, present, startNew]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { session } = await api<{ session: ResumeInfo | null }>("/api/me/active-session");
        if (session) { setResumeInfo(session); setPhase("resume"); } else await startNew();
      } catch (e) { fail(e, () => { started.current = false; location.reload(); }); }
    })();
  }, [startNew, fail]);

  // ---------- 제출 ----------
  const submit = useCallback(async (idx: number | null) => {
    if (!q || submitting || answer) return;
    setSubmitting(true);
    setSelected(idx);
    setNotice("");
    try {
      const r = await api<AnswerResponse>(`/api/sessions/${sessionId}/answer`, { body: { questionId: q.id, selectedIndex: idx } });
      setAnswer(r);
      setScore(r.totalScore);
      setDeadline(null);
      feedbackCue(r.isCorrect ? "correct" : "wrong");
    } catch (e) {
      setSubmitting(false);
      setSelected(null);
      if (idx === null) { setDeadline(null); fail(e, () => { setPhase("playing"); void submit(null); }); return; }
      setNotice(e instanceof ApiError ? e.message : "제출하지 못했어요. 다시 선택해 주세요.");
    }
  }, [q, submitting, answer, sessionId, fail]);

  // ---------- 타이머 ----------
  useEffect(() => {
    if (phase !== "playing" || !q || answer || deadline === null) return;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      setMsLeft(left);
      if (left <= 0) void submit(null); // 시간 초과: 서버가 최종 판정
    };
    tick();
    const t = setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [phase, q, answer, deadline, submit]);

  const secLeft = Math.ceil(msLeft / 1000);
  useEffect(() => {
    if (phase !== "playing" || answer) return;
    if (secLeft === 10 || secLeft === URGENT_SEC) setAnnounce(`남은 시간 ${secLeft}초`);
  }, [secLeft, phase, answer]);

  // ---------- 다음 ----------
  const goNext = useCallback(() => {
    if (!answer) return;
    if (answer.categoryComplete) {
      setSummary({ cat: answer.categoryComplete, finished: answer.finished, next: answer.next });
      setPhase("summary");
      return;
    }
    if (answer.finished || !answer.next) router.push(`/result/${sessionId}`);
    else void present(answer.next, sessionId);
  }, [answer, present, router, sessionId]);

  const afterSummary = useCallback(() => {
    if (!summary) return;
    if (summary.finished || !summary.next) router.push(`/result/${sessionId}`);
    else void present(summary.next, sessionId);
  }, [summary, present, router, sessionId]);

  useEffect(() => {
    if (!answer || !settings.autoAdvance || reportState === "open" || reportState === "sending") return;
    const t = setTimeout(goNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [answer, settings.autoAdvance, reportState, goNext]);

  // ---------- 일시정지 ----------
  const pause = async () => {
    try {
      await api(`/api/sessions/${sessionId}/pause`, { body: {} });
      setPauseUsed(true);
      setDeadline(null);
      setPhase("paused");
    } catch (e) { setNotice(e instanceof ApiError ? e.message : "일시정지하지 못했어요."); }
  };
  const unpause = async () => {
    try {
      const r = await api<{ remainingMs: number }>(`/api/sessions/${sessionId}/unpause`, { body: {} });
      setPhase("playing");
      setDeadline(performance.now() + r.remainingMs);
    } catch (e) { fail(e); }
  };

  // ---------- 키보드 (1~4 선택, Enter 다음) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (phase === "playing" && q && !answer && !submitting && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        void submit(Number(e.key) - 1);
      } else if (e.key === "Enter" && !isInteractive(e.target)) {
        if (phase === "playing" && answer) { e.preventDefault(); goNext(); }
        else if (phase === "summary") { e.preventDefault(); afterSummary(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, q, answer, submitting, submit, goNext, afterSummary]);

  // 진행 중 이탈 확인 (PRD 7.2)
  useEffect(() => {
    if (phase !== "playing" && phase !== "paused") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  // ---------- 신고 ----------
  const sendReport = async () => {
    if (!q || !reportReason) return;
    setReportState("sending");
    try {
      await api(`/api/questions/${q.id}/report`, { body: { reason: reportReason, sessionId } });
      setReportState("done");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_REPORTED") { setReportState("done"); return; }
      setNotice(e instanceof ApiError ? e.message : "신고하지 못했어요.");
      setReportState("error");
    }
  };

  // ---------- 렌더 ----------
  if (phase === "boot") return <Shell><Spinner label="게임을 준비하고 있어요…" /></Shell>;

  if (phase === "error") {
    return (
      <Shell>
        <ErrorBox message={errorMsg} onRetry={retryRef.current ?? undefined} />
        <Link className="mt-4 inline-block underline" href="/">홈으로</Link>
      </Shell>
    );
  }

  if (phase === "resume" && resumeInfo) {
    return (
      <Shell>
        <Card className="mt-6">
          <h1 className="text-xl font-extrabold">이어서 하시겠어요?</h1>
          <p className="mt-2">
            진행 중인 게임이 있어요. 전체 <b>{resumeInfo.overallIndex}/{resumeInfo.overallTotal}</b>번째 문제, 현재 <b>{formatScore(resumeInfo.totalScore)}점</b>이에요.
          </p>
          <p className="mt-1 text-sm text-muted">이어하면 해당 문제의 20초가 처음부터 다시 시작돼요.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button autoFocus onClick={() => void resume(resumeInfo)}>이어하기</Button>
            <Button variant="secondary" onClick={() => void startNew()}>새로 시작</Button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === "summary" && summary) {
    const nextLabel = summary.next ? CATEGORY_LABELS[summary.next.category] : null;
    return (
      <Shell>
        <Card className="mt-6 text-center">
          <p className="text-sm font-semibold text-brand">카테고리 완료</p>
          <h1 className="mt-1 text-2xl font-extrabold">{CATEGORY_LABELS[summary.cat.category]}</h1>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-brand-soft p-3 text-brand-soft-ink">
              <dt className="text-sm">이번 카테고리 점수</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatScore(summary.cat.score)}</dd>
            </div>
            <div className="rounded-xl bg-brand-soft p-3 text-brand-soft-ink">
              <dt className="text-sm">정답</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{summary.cat.correct}/{summary.cat.total}</dd>
            </div>
          </dl>
          <p className="mt-4">현재 총점 <b className="tabular-nums">{formatScore(score)}점</b></p>
          <Button autoFocus className="mt-5 w-full" onClick={afterSummary}>
            {summary.finished ? "최종 결과 보기" : `다음: ${nextLabel}`}
          </Button>
          <p className="mt-2 text-xs text-muted">Enter 키로도 넘어갈 수 있어요.</p>
        </Card>
      </Shell>
    );
  }

  if (!q) return <Shell><Spinner /></Shell>;

  const urgent = !answer && secLeft <= URGENT_SEC && phase === "playing";
  const correctNo = answer ? answer.correctIndex + 1 : 0;
  const liveText = !answer
    ? announce
    : answer.timedOut
      ? `시간 초과! 정답은 ${correctNo}번, ${q.choices[answer.correctIndex]}입니다.`
      : answer.isCorrect
        ? `정답! ${answer.points}점을 얻었어요.`
        : `오답입니다. 정답은 ${correctNo}번, ${q.choices[answer.correctIndex]}입니다.`;

  return (
    <Shell
      header={
        <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-app/95 px-4 pb-3 pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="font-semibold">
              전체 <span className="tabular-nums">{q.overallIndex}/{q.overallTotal}</span>
              <span className="mx-2 text-muted" aria-hidden>·</span>
              카테고리 <span className="tabular-nums">{q.categoryIndex}/{q.categoryTotal}</span>
            </p>
            <p className="font-bold">
              점수 <span className="tabular-nums text-brand" data-testid="score">{formatScore(score)}</span>
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="전체 진행"
            aria-valuemin={1}
            aria-valuemax={q.overallTotal}
            aria-valuenow={q.overallIndex}
            className="mt-2 h-2 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-brand transition-[width]" style={{ width: `${(q.overallIndex / q.overallTotal) * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              role="timer"
              aria-live="off"
              aria-label={`남은 시간 ${secLeft}초`}
              data-testid="timer"
              className={`flex min-w-[5.5rem] items-center gap-1 text-lg font-extrabold tabular-nums ${urgent ? "timer-urgent text-bad-line" : ""}`}
            >
              <span aria-hidden>{urgent ? "⏰" : "⏱"}</span>
              {answer ? "—" : `${secLeft}초`}
            </div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className={`h-full ${urgent ? "bg-bad-line" : "bg-brand"}`}
                style={{ width: `${answer ? 0 : (msLeft / q.timeLimitMs) * 100}%`, transition: "width 200ms linear" }}
              />
            </div>
            {!answer && phase === "playing" && (
              <Button variant="ghost" className="min-h-12 px-3" disabled={pauseUsed} onClick={() => void pause()}>
                {pauseUsed ? "정지 사용함" : "⏸ 일시정지"}
              </Button>
            )}
            <SettingsDialog label="" />
          </div>
        </div>
      }
    >
      {/* 정답 피드백/타이머 안내를 스크린리더로 낭독 */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only-live" data-testid="live">{liveText}</p>

      {phase === "paused" ? (
        <Card className="mt-6 text-center">
          <h1 className="text-xl font-extrabold">일시정지</h1>
          <p className="mt-2 text-muted">문제는 가려져 있어요. 정지 시간은 제한 시간에 포함되지 않아요.</p>
          <Button autoFocus className="mt-5 w-full" onClick={() => void unpause()}>계속하기</Button>
        </Card>
      ) : (
        <>
          <p className="mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-soft-ink" data-testid="chip">
            <span aria-hidden>🏷</span> {CATEGORY_LABELS[q.category]}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-xl font-extrabold leading-snug outline-none sm:text-2xl" data-testid="question">
            {q.question}
          </h1>

          <div role="radiogroup" aria-label="보기" className="mt-auto grid gap-3 pt-6" data-testid="choices">
            {q.choices.map((c, i) => {
              const isCorrect = !!answer && i === answer.correctIndex;
              const isWrongPick = !!answer && selected === i && !answer.isCorrect;
              const tone = isCorrect
                ? "border-ok-line bg-ok-bg text-ok-ink"
                : isWrongPick
                  ? "border-bad-line bg-bad-bg text-bad-ink"
                  : answer
                    ? "border-line bg-surface opacity-70"
                    : selected === i
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:bg-brand-soft";
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected === i}
                  aria-disabled={!!answer || submitting}
                  disabled={!!answer || (submitting && selected !== i)}
                  onClick={() => void submit(i)}
                  data-testid={`choice-${i}`}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors ${tone}`}
                >
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current text-sm font-bold">{i + 1}</span>
                  <span className="flex-1">{c}</span>
                  {isCorrect && <span className="shrink-0 font-bold" data-testid="mark-correct">✓ 정답</span>}
                  {isWrongPick && <span className="shrink-0 font-bold" data-testid="mark-wrong">✗ 내 선택</span>}
                </button>
              );
            })}
          </div>
          {notice && <p role="alert" className="mt-3 rounded-lg bg-warn-bg p-3 text-sm text-warn-ink">{notice}</p>}

          {answer && (
            <div className="mt-4 grid gap-3" data-testid="feedback">
              <div
                className={`rounded-xl border-2 p-4 ${answer.isCorrect ? "border-ok-line bg-ok-bg text-ok-ink" : "border-bad-line bg-bad-bg text-bad-ink"}`}
              >
                <p className="text-lg font-extrabold" data-testid="verdict">
                  {answer.isCorrect ? "✓ 정답!" : answer.timedOut ? "✗ 시간 초과" : "✗ 오답"}
                  <span className="ml-2 tabular-nums" data-testid="points">+{answer.points}점</span>
                </p>
                {answer.isCorrect && (
                  <p className="mt-1 text-sm">
                    기본 {answer.breakdown.base} + 속도 {answer.breakdown.speed}
                    {answer.breakdown.streak > 0 ? ` + 연속 ${answer.breakdown.streak}` : ""}
                    {answer.streak >= 3 ? ` · 🔥 ${answer.streak}연속` : ""}
                  </p>
                )}
                {!answer.isCorrect && (
                  <p className="mt-1 text-sm">정답은 <b>{correctNo}번 {q.choices[answer.correctIndex]}</b>이에요.</p>
                )}
                {answer.explanation && <p className="mt-2 text-sm" data-testid="explanation">💡 {answer.explanation}</p>}
              </div>

              <Button ref={nextRef} onClick={goNext} data-testid="next" className="w-full">
                {answer.categoryComplete ? "카테고리 결과 보기" : "다음"}
                <span aria-hidden className="text-sm opacity-80">Enter</span>
              </Button>
              {settings.autoAdvance && reportState === "closed" && <p className="text-center text-xs text-muted">자동 진행 켜짐 · 2.5초 뒤 넘어가요</p>}

              <div className="text-sm">
                {reportState === "closed" && (
                  <button type="button" className="min-h-12 px-2 text-muted underline underline-offset-2" onClick={() => setReportState("open")}>
                    ⚑ 문제 신고
                  </button>
                )}
                {(reportState === "open" || reportState === "sending" || reportState === "error") && (
                  <fieldset className="rounded-xl border border-line bg-surface p-3">
                    <legend className="px-1 font-semibold">신고 사유를 선택해 주세요</legend>
                    <div className="grid gap-1">
                      {REPORT_REASONS_LIST.map((r) => (
                        <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2">
                          <input type="radio" name="reason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} className="h-5 w-5" />
                          {REPORT_REASON_LABELS[r]}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button disabled={!reportReason || reportState === "sending"} onClick={() => void sendReport()}>
                        {reportState === "sending" ? "보내는 중…" : "신고하기"}
                      </Button>
                      <Button variant="secondary" onClick={() => setReportState("closed")}>취소</Button>
                    </div>
                  </fieldset>
                )}
                {reportState === "done" && <p role="status" className="py-2 text-muted" data-testid="report-done">신고가 접수됐어요. 고마워요!</p>}
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-8">
      {header}
      {children}
    </main>
  );
}
