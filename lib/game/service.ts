import { randomUUID } from "node:crypto";
import {
  CATEGORIES, getAnswer, getQuestionsByIds, getSession, insertAnswer, insertSession, listAnswers,
  listQuestions, listSessionsByPlayer, listStaleActiveSessions, patchSession, setCurrentServedAt, transaction,
  type AnswerRecord, type CategoryId, type QuestionRecord, type SessionRecord,
} from "@/lib/db";
import { analytics } from "@/lib/analytics";
import { TIME_LIMIT_MS, gradeFor, scoreAnswer } from "@/lib/scoring";
import { GameError } from "./errors";
import { QUESTIONS_PER_CATEGORY, pickQuestions, shuffle, type Rng } from "./selection";

export const TOTAL_QUESTIONS = CATEGORIES.length * QUESTIONS_PER_CATEGORY;
/** 네트워크 지연 보정. 선택한 보기를 제출할 때만 제한 시간에 더해진다. */
export const NETWORK_GRACE_MS = 1000;
/** 이 시간(ms) 미만에 연속 FAST_LIMIT회 이상 제출하면 세션을 flagged 처리한다 (PRD 4.4). */
export const FAST_ANSWER_MS = 300;
export const FAST_LIMIT = 5;
/** active 세션 보존 기간 (PRD F-09) */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ---------- 응답 형태 (answerIndex 없음) ----------

export interface PublicQuestion {
  id: string;
  category: CategoryId;
  overallIndex: number; // 1..40
  overallTotal: number;
  categoryIndex: number; // 1..10
  categoryTotal: number;
  question: string;
  choices: string[]; // 서버가 저장한 셔플 순서
  timeLimitMs: number;
}

export interface CategorySummary {
  category: CategoryId;
  score: number;
  correct: number;
  total: number;
  timeMs: number;
}

export interface AnswerResponse {
  isCorrect: boolean;
  timedOut: boolean;
  correctIndex: number; // 표시 순서 기준
  explanation: string | null;
  points: number;
  breakdown: { base: number; speed: number; streak: number };
  streak: number;
  totalScore: number;
  categoryComplete: CategorySummary | null;
  finished: boolean;
  next: PublicQuestion | null;
}

// ---------- 내부 도우미 ----------

const lastActivity = (s: SessionRecord) =>
  Math.max(s.startedAt, s.currentDeliveredAt, s.currentServedAt ?? 0, s.pausedAt ?? 0);
const effectiveServedAt = (s: SessionRecord) => s.currentServedAt ?? s.currentDeliveredAt;

/** 현재 문제에서 일시정지 시간을 뺀 경과 시간 */
function elapsedFor(s: SessionRecord, now: number): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, end - effectiveServedAt(s) - s.currentPauseMs);
}

function requireSession(id: string): SessionRecord {
  const s = getSession(id);
  if (!s) throw new GameError(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다.");
  return s;
}

function abandon(s: SessionRecord): void {
  patchSession(s.id, { status: "abandoned", pausedAt: null });
  analytics.track("game_abandon", { playerId: s.playerId, sessionId: s.id, props: { lastIndex: s.currentIndex } });
}

/** 24시간 넘게 활동이 없는 active 세션은 조회 시점에 abandoned 처리한다. */
function requireLiveSession(id: string, now = Date.now()): SessionRecord {
  const s = requireSession(id);
  if (s.status === "active" && now - lastActivity(s) > SESSION_TTL_MS) {
    abandon(s);
    return requireSession(id);
  }
  return s;
}

function requireActive(id: string): SessionRecord {
  const s = requireLiveSession(id);
  if (s.status !== "active") throw new GameError(409, "SESSION_NOT_ACTIVE", "진행 중인 세션이 아닙니다.");
  return s;
}

function toPublic(s: SessionRecord, idx: number, questions: Map<string, QuestionRecord>): PublicQuestion {
  const q = questions.get(s.questionIds[idx])!;
  const order = s.choiceOrders[idx];
  return {
    id: q.id,
    category: q.category,
    overallIndex: idx + 1,
    overallTotal: TOTAL_QUESTIONS,
    categoryIndex: (idx % QUESTIONS_PER_CATEGORY) + 1,
    categoryTotal: QUESTIONS_PER_CATEGORY,
    question: q.question,
    choices: order.map((o) => q.choices[o]),
    timeLimitMs: TIME_LIMIT_MS,
  };
}

function currentPublic(s: SessionRecord): PublicQuestion {
  return toPublic(s, s.currentIndex, getQuestionsByIds([s.questionIds[s.currentIndex]]));
}

function summarize(answers: AnswerRecord[], catPos: number): CategorySummary {
  const from = catPos * QUESTIONS_PER_CATEGORY;
  const part = answers.filter((a) => a.idx >= from && a.idx < from + QUESTIONS_PER_CATEGORY);
  return {
    category: CATEGORIES[catPos],
    score: part.reduce((n, a) => n + a.points, 0),
    correct: part.filter((a) => a.isCorrect).length,
    total: QUESTIONS_PER_CATEGORY,
    timeMs: part.reduce((n, a) => n + a.elapsedMs, 0),
  };
}

// ---------- 세션 생성 ----------

export function createSession(
  playerId: string | null = null,
  rng: Rng = Math.random,
): { sessionId: string; question: PublicQuestion } {
  const ids: string[] = [];
  for (const cat of CATEGORIES) {
    const pool = listQuestions({ category: cat, publishedOnly: true });
    if (pool.length < QUESTIONS_PER_CATEGORY) {
      throw new GameError(503, "NOT_ENOUGH_QUESTIONS", `'${cat}' 카테고리 출제 가능 문제가 부족합니다. npm run seed 를 실행하거나 문제를 게시하세요.`);
    }
    ids.push(...pickQuestions(pool, rng).map((q) => q.id));
  }
  const now = Date.now();
  const session: SessionRecord = {
    id: randomUUID(),
    playerId,
    questionIds: ids,
    choiceOrders: ids.map(() => shuffle([0, 1, 2, 3], rng)),
    currentIndex: 0,
    currentDeliveredAt: now,
    currentServedAt: null,
    pausedAt: null,
    pauseUsed: false,
    currentPauseMs: 0,
    fastStreak: 0,
    flagged: false,
    status: "active",
    startedAt: now,
    completedAt: null,
    totalScore: 0,
    correctCount: 0,
    totalTimeMs: 0,
    streak: 0,
  };
  transaction(() => {
    // 한 플레이어당 진행 중인 판은 하나만 둔다.
    if (playerId) for (const old of listSessionsByPlayer(playerId, "active")) abandon(old);
    insertSession(session);
  });
  analytics.track("game_start", { playerId, sessionId: session.id, props: { mode: "normal" } });
  return { sessionId: session.id, question: toPublic(session, 0, getQuestionsByIds([ids[0]])) };
}

// ---------- 현재 상태 / 시작 / 일시정지 / 이어하기 ----------

export interface SessionState {
  sessionId: string;
  status: SessionRecord["status"];
  totalScore: number;
  paused: boolean;
  pauseUsed: boolean;
  /** 일시정지 중이거나 진행 중이 아니면 null (문제를 가린다) */
  question: PublicQuestion | null;
  remainingMs: number | null;
}

const remaining = (s: SessionRecord, now: number) => Math.max(0, TIME_LIMIT_MS - elapsedFor(s, now));

export function getSessionState(id: string): SessionState {
  const s = requireLiveSession(id);
  const base = { sessionId: s.id, status: s.status, totalScore: s.totalScore, paused: s.pausedAt !== null, pauseUsed: s.pauseUsed };
  if (s.status !== "active" || s.pausedAt !== null) {
    return { ...base, question: null, remainingMs: s.status === "active" ? remaining(s, Date.now()) : null };
  }
  return { ...base, question: currentPublic(s), remainingMs: remaining(s, Date.now()) };
}

/**
 * 클라이언트가 현재 문제를 화면에 띄운 시점에 호출한다. 이 시각부터 20초가 흐른다.
 * (피드백·소결과 화면을 보는 시간이 풀이 시간에 포함되지 않도록 하기 위함)
 * 호출하지 않으면 문제가 전달된 시각이 기준이 되므로 불리할 뿐이다. 이미 시작된 문제는 시간이 리셋되지 않는다.
 */
export function startQuestion(id: string, questionId: string): { remainingMs: number } {
  const s = requireActive(id);
  if (s.questionIds[s.currentIndex] !== questionId) throw new GameError(409, "NOT_CURRENT_QUESTION", "현재 문제가 아닙니다.");
  if (s.pausedAt !== null) throw new GameError(409, "PAUSED", "일시정지 중입니다.");
  const now = Date.now();
  if (s.currentServedAt === null) {
    setCurrentServedAt(id, now);
    analytics.track("question_view", {
      playerId: s.playerId, sessionId: id,
      props: { questionId, category: CATEGORIES[Math.floor(s.currentIndex / QUESTIONS_PER_CATEGORY)], index: s.currentIndex + 1 },
    });
  }
  return { remainingMs: remaining(requireSession(id), now) };
}

/** 일시정지: 판당 1회. 정지 시간은 시간 초과 계산에서 제외된다. */
export function pauseSession(id: string): SessionState {
  const s = requireActive(id);
  if (s.pausedAt !== null) throw new GameError(409, "ALREADY_PAUSED", "이미 일시정지 중입니다.");
  if (s.pauseUsed) throw new GameError(409, "PAUSE_LIMIT", "일시정지는 한 판에 한 번만 사용할 수 있어요.");
  patchSession(id, { pausedAt: Date.now(), pauseUsed: true });
  return getSessionState(id);
}

export function unpauseSession(id: string): SessionState {
  const s = requireActive(id);
  if (s.pausedAt === null) throw new GameError(409, "NOT_PAUSED", "일시정지 중이 아닙니다.");
  patchSession(id, { pausedAt: null, currentPauseMs: s.currentPauseMs + (Date.now() - s.pausedAt) });
  return getSessionState(id);
}

/** 플레이어의 이어하기 가능한 판(24시간 이내 active). 오래된 active 세션은 여기서 정리한다. */
export function findResumableSession(playerId: string, now = Date.now()) {
  for (const stale of listStaleActiveSessions(now - SESSION_TTL_MS, playerId)) abandon(stale);
  const s = listSessionsByPlayer(playerId, "active")[0];
  if (!s) return null;
  return {
    sessionId: s.id,
    overallIndex: s.currentIndex + 1,
    overallTotal: TOTAL_QUESTIONS,
    totalScore: s.totalScore,
    lastActivityAt: lastActivity(s),
  };
}

/** 이어하기: 현재 문제부터 다시, 20초를 처음부터 시작(served_at 재설정). 일시정지 상태도 해제된다. */
export function resumeSession(id: string, playerId: string | null): { question: PublicQuestion; remainingMs: number; totalScore: number; pauseUsed: boolean } {
  const s = requireActive(id);
  if (s.playerId && s.playerId !== playerId) throw new GameError(403, "NOT_OWNER", "본인의 게임만 이어서 할 수 있어요.");
  patchSession(id, { currentServedAt: Date.now(), pausedAt: null, currentPauseMs: 0 });
  const fresh = requireSession(id);
  analytics.track("question_view", {
    playerId: s.playerId, sessionId: id,
    props: { questionId: s.questionIds[s.currentIndex], index: s.currentIndex + 1, resumed: true },
  });
  return { question: currentPublic(fresh), remainingMs: TIME_LIMIT_MS, totalScore: fresh.totalScore, pauseUsed: fresh.pauseUsed };
}

// ---------- 답 제출 ----------

function buildResponse(
  s: SessionRecord,
  a: AnswerRecord,
  answers: AnswerRecord[],
  questions: Map<string, QuestionRecord>,
): AnswerResponse {
  const q = questions.get(a.questionId)!;
  const order = s.choiceOrders[a.idx];
  const lastOfCategory = (a.idx + 1) % QUESTIONS_PER_CATEGORY === 0;
  const hasNext = a.idx + 1 < TOTAL_QUESTIONS;
  return {
    isCorrect: a.isCorrect,
    timedOut: a.timedOut,
    correctIndex: order.indexOf(q.answerIndex),
    explanation: q.explanation,
    points: a.points,
    breakdown: { base: a.isCorrect ? 100 : 0, speed: a.speedBonus, streak: a.streakBonus },
    streak: a.streakAfter,
    totalScore: a.totalAfter,
    categoryComplete: lastOfCategory ? summarize(answers, Math.floor(a.idx / QUESTIONS_PER_CATEGORY)) : null,
    finished: !hasNext,
    next: hasNext ? toPublic(s, a.idx + 1, questions) : null,
  };
}

export function submitAnswer(id: string, questionId: string, selectedIndex: number | null): AnswerResponse {
  if (selectedIndex !== null && !(Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex <= 3)) {
    throw new GameError(400, "INVALID_SELECTION", "selectedIndex는 0~3 또는 null이어야 합니다.");
  }
  // 24시간 만료 정리는 트랜잭션 밖에서 먼저 수행한다(롤백되지 않도록).
  requireLiveSession(id);

  const events: Array<() => void> = [];
  const response = transaction(() => {
    const s = requireSession(id);
    const prior = getAnswer(id, questionId);

    if (!prior) {
      if (s.status !== "active") throw new GameError(409, "SESSION_NOT_ACTIVE", "진행 중인 세션이 아닙니다.");
      if (s.questionIds[s.currentIndex] !== questionId) {
        throw new GameError(409, "NOT_CURRENT_QUESTION", "현재 풀어야 할 문제가 아닙니다.");
      }
      if (s.pausedAt !== null) throw new GameError(409, "PAUSED", "일시정지 중에는 답을 제출할 수 없어요.");

      const now = Date.now();
      const served = effectiveServedAt(s);
      const elapsed = elapsedFor(s, now);
      const q = getQuestionsByIds([questionId]).get(questionId)!;
      const timedOut = elapsed > TIME_LIMIT_MS + (selectedIndex === null ? 0 : NETWORK_GRACE_MS);
      const isCorrect = !timedOut && selectedIndex !== null && s.choiceOrders[s.currentIndex][selectedIndex] === q.answerIndex;
      const sc = scoreAnswer({ isCorrect, elapsedMs: elapsed, prevStreak: s.streak });

      const idx = s.currentIndex;
      const counted = Math.min(elapsed, TIME_LIMIT_MS);
      const totalAfter = s.totalScore + sc.points;
      insertAnswer({
        sessionId: id, questionId, idx,
        selectedIndex: timedOut ? null : selectedIndex,
        isCorrect, timedOut: timedOut || (selectedIndex === null && elapsed >= TIME_LIMIT_MS),
        points: sc.points, speedBonus: sc.speed, streakBonus: sc.streakBonus,
        elapsedMs: counted, totalAfter, streakAfter: sc.streak,
        servedAt: served, answeredAt: now,
      });

      // 부정행위 탐지: 300ms 미만 제출이 연속 5회 이상이면 flagged
      const fastStreak = selectedIndex !== null && elapsed < FAST_ANSWER_MS ? s.fastStreak + 1 : 0;
      const done = idx + 1 >= TOTAL_QUESTIONS;
      patchSession(id, {
        currentIndex: done ? idx : idx + 1,
        currentDeliveredAt: now,
        currentServedAt: null,
        pausedAt: null,
        currentPauseMs: 0,
        status: done ? "completed" : "active",
        completedAt: done ? now : null,
        totalScore: totalAfter,
        correctCount: s.correctCount + (isCorrect ? 1 : 0),
        totalTimeMs: s.totalTimeMs + counted,
        streak: sc.streak,
        fastStreak,
        flagged: s.flagged || fastStreak >= FAST_LIMIT,
      });

      const category = CATEGORIES[Math.floor(idx / QUESTIONS_PER_CATEGORY)];
      events.push(() => analytics.track("answer_submit", {
        playerId: s.playerId, sessionId: id,
        props: { questionId, isCorrect, timeMs: counted, timedOut: timedOut || (selectedIndex === null && elapsed >= TIME_LIMIT_MS) },
      }));
      if ((idx + 1) % QUESTIONS_PER_CATEGORY === 0) {
        const cat = summarize(listAnswers(id), Math.floor(idx / QUESTIONS_PER_CATEGORY));
        events.push(() => analytics.track("category_complete", { playerId: s.playerId, sessionId: id, props: { category, score: cat.score } }));
      }
      if (done) {
        events.push(() => analytics.track("game_complete", {
          playerId: s.playerId, sessionId: id,
          props: { totalScore: totalAfter, correctCount: s.correctCount + (isCorrect ? 1 : 0), totalTimeMs: s.totalTimeMs + counted },
        }));
      }
    }

    const fresh = requireSession(id);
    const answers = listAnswers(id);
    const a = answers.find((x) => x.questionId === questionId)!;
    const needed = [a.questionId, ...(a.idx + 1 < TOTAL_QUESTIONS ? [fresh.questionIds[a.idx + 1]] : [])];
    return buildResponse(fresh, a, answers, getQuestionsByIds(needed));
  });
  events.forEach((fire) => fire());
  return response;
}

// ---------- 결과 ----------

export interface WrongItem {
  questionId: string;
  category: CategoryId;
  question: string;
  choices: string[];
  selectedIndex: number | null;
  myAnswer: string | null;
  correctIndex: number;
  correctAnswer: string;
  explanation: string | null;
  timedOut: boolean;
}

export interface GameResult {
  sessionId: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number; // 0~100 정수 반올림
  grade: string;
  totalTimeMs: number;
  categories: CategorySummary[];
  wrong: WrongItem[];
}

export function getResult(id: string, requesterId: string | null = null): GameResult {
  const s = requireSession(id);
  // 오답 목록 등 상세 결과는 본인만. (공개 공유 페이지는 getShareSummary로 점수·등급만 제공)
  if (s.playerId && s.playerId !== requesterId) throw new GameError(403, "NOT_OWNER", "본인의 게임 결과만 볼 수 있어요.");
  if (s.status !== "completed") throw new GameError(409, "SESSION_NOT_COMPLETED", "아직 끝나지 않은 게임입니다.");
  const answers = listAnswers(id);
  const questions = getQuestionsByIds(s.questionIds);
  const accuracy = Math.round((s.correctCount / TOTAL_QUESTIONS) * 100);

  const wrong: WrongItem[] = answers
    .filter((a) => !a.isCorrect)
    .map((a) => {
      const q = questions.get(a.questionId)!;
      const order = s.choiceOrders[a.idx];
      const choices = order.map((o) => q.choices[o]);
      const correctIndex = order.indexOf(q.answerIndex);
      return {
        questionId: q.id, category: q.category, question: q.question, choices,
        selectedIndex: a.selectedIndex,
        myAnswer: a.selectedIndex === null ? null : choices[a.selectedIndex],
        correctIndex, correctAnswer: choices[correctIndex], explanation: q.explanation, timedOut: a.timedOut,
      };
    });

  return {
    sessionId: s.id,
    totalScore: s.totalScore,
    correctCount: s.correctCount,
    totalQuestions: TOTAL_QUESTIONS,
    accuracy,
    grade: gradeFor(accuracy),
    totalTimeMs: s.totalTimeMs,
    categories: CATEGORIES.map((_, i) => summarize(answers, i)),
    wrong,
  };
}

/** 공개 공유 페이지용: 점수·등급·정답률만. 문제·오답 정보는 포함하지 않는다. */
export function getShareSummary(id: string): { totalScore: number; grade: string; accuracy: number; correctCount: number; totalQuestions: number } | null {
  const s = getSession(id);
  if (!s || s.status !== "completed") return null;
  const accuracy = Math.round((s.correctCount / TOTAL_QUESTIONS) * 100);
  return { totalScore: s.totalScore, grade: gradeFor(accuracy), accuracy, correctCount: s.correctCount, totalQuestions: TOTAL_QUESTIONS };
}

/** 순위 등록용: 카테고리별 점수·정답 수·소요시간 */
export function getCategoryBreakdown(id: string): CategorySummary[] {
  const answers = listAnswers(id);
  return CATEGORIES.map((_, i) => summarize(answers, i));
}
