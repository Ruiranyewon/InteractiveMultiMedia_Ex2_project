import {
  CATEGORIES, CATEGORY_LABELS, countEntriesForSession, countRanked, getPlayer, getSession, insertEntries,
  listEntriesForPlayer, listSessionsByPlayer, rankedForPlayer, rankedRange, setPlayerNickname, topRanked,
  transaction, answeredCount, type CategoryId, type EntryStatus, type RankedEntry,
} from "@/lib/db";
import { analytics } from "@/lib/analytics";
import { NICKNAME_COOLDOWN_MS, validateNickname } from "@/lib/nickname";
import { weekKey } from "@/lib/week";
import { GameError } from "./errors";
import { getCategoryBreakdown } from "./service";

export const TOP_N = 100;
export const AROUND = 3;

export type Scope = { kind: "all" } | { kind: "week" } | { kind: "cat"; category: CategoryId };

export function parseScope(raw: string | null): Scope {
  if (raw === null || raw === "" || raw === "all") return { kind: "all" };
  if (raw === "week") return { kind: "week" };
  if (raw.startsWith("cat:")) {
    const c = raw.slice(4) as CategoryId;
    if (CATEGORIES.includes(c)) return { kind: "cat", category: c };
  }
  throw new GameError(400, "INVALID_SCOPE", "scope는 all, week, cat:<카테고리> 중 하나여야 합니다.");
}

/** DB에 저장되는 scope 키. week는 조회 시점 기준 주 키를 붙인다. */
export function scopeKey(scope: Scope, now = Date.now()): string {
  if (scope.kind === "all") return "all";
  if (scope.kind === "week") return `week:${weekKey(now)}`;
  return `cat:${scope.category}`;
}

function scopeLabel(scope: Scope): string {
  return scope.kind === "all" ? "전체" : scope.kind === "week" ? "주간" : CATEGORY_LABELS[scope.category];
}

// ---------- 등록 ----------

export interface RegisterResult {
  status: EntryStatus;
  nickname: string;
  /** 각 scope에서 내 현재 순위. pending이면 null */
  ranks: Record<string, number | null>;
}

export function registerEntry(playerId: string | null, sessionId: unknown, nicknameRaw: unknown): RegisterResult {
  if (!playerId) throw new GameError(403, "NO_PLAYER", "플레이어를 확인할 수 없어요. 게임을 다시 시작해 주세요.");
  if (typeof sessionId !== "string") throw new GameError(400, "INVALID_SESSION", "sessionId가 필요합니다.");

  const result = transaction(() => {
    const session = getSession(sessionId);
    if (!session) throw new GameError(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다.");
    if (session.playerId !== playerId) throw new GameError(403, "NOT_OWNER", "본인의 게임만 등록할 수 있어요.");
    if (session.status !== "completed") throw new GameError(409, "SESSION_NOT_COMPLETED", "완주한 게임만 순위에 등록할 수 있어요.");
    if (countEntriesForSession(sessionId) > 0) throw new GameError(409, "ALREADY_REGISTERED", "이미 등록한 게임이에요.");

    const check = validateNickname(nicknameRaw);
    if (!check.ok) throw new GameError(400, `NICKNAME_${check.code}`, check.message);

    const now = Date.now();
    const player = getPlayer(playerId)!;
    if (player.nickname !== check.value) {
      if (player.nickname && player.nicknameChangedAt && now - player.nicknameChangedAt < NICKNAME_COOLDOWN_MS) {
        const days = Math.ceil((NICKNAME_COOLDOWN_MS - (now - player.nicknameChangedAt)) / 86_400_000);
        throw new GameError(409, "NICKNAME_COOLDOWN", `닉네임은 7일에 한 번만 바꿀 수 있어요. ${days}일 뒤에 다시 시도해 주세요.`, { retryAfterDays: days });
      }
      // 최초 설정은 변경으로 치지 않는다.
      setPlayerNickname(playerId, check.value, player.nickname ? now : null);
    }

    const status: EntryStatus = session.flagged ? "pending" : "visible";
    const completedAt = session.completedAt ?? now;
    const base = { playerId, sessionId, status, createdAt: now };
    const cats = getCategoryBreakdown(sessionId);
    insertEntries([
      { ...base, scope: "all", score: session.totalScore, correctCount: session.correctCount, totalTimeMs: session.totalTimeMs },
      { ...base, scope: `week:${weekKey(completedAt)}`, score: session.totalScore, correctCount: session.correctCount, totalTimeMs: session.totalTimeMs },
      ...cats.map((c) => ({ ...base, scope: `cat:${c.category}`, score: c.score, correctCount: c.correct, totalTimeMs: c.timeMs })),
    ]);

    const ranks: Record<string, number | null> = {};
    const keys = ["all", `week:${weekKey(completedAt)}`, ...CATEGORIES.map((c) => `cat:${c}`)];
    for (const k of keys) ranks[k.startsWith("week:") ? "week" : k] = status === "visible" ? rankedForPlayer(k, playerId)?.rank ?? null : null;
    return { status, nickname: check.value, ranks };
  });

  analytics.track("leaderboard_submit", { playerId, sessionId, props: { scope: "all", rank: result.ranks.all, status: result.status } });
  return result;
}

// ---------- 조회 ----------

export interface PublicEntry {
  rank: number;
  nickname: string;
  score: number;
  correctCount: number;
  totalTimeMs: number;
  isMe: boolean;
  /** 같은 점수의 다른 항목이 있음(정렬 규칙으로 순위는 구분됨) */
  tied: boolean;
}

function toPublic(list: RankedEntry[], me: string | null): PublicEntry[] {
  return list.map((e, i) => ({
    rank: e.rank,
    nickname: e.nickname,
    score: e.score,
    correctCount: e.correctCount,
    totalTimeMs: e.totalTimeMs,
    isMe: !!me && e.playerId === me,
    tied: (i > 0 && list[i - 1].score === e.score) || (i < list.length - 1 && list[i + 1].score === e.score),
  }));
}

export interface LeaderboardResponse {
  scope: string;
  label: string;
  total: number;
  entries: PublicEntry[];
  me: { entry: PublicEntry; around: PublicEntry[] } | null;
  /** 내 기록이 있지만 검토 대기 중(순위표에 숨김) */
  myPending: boolean;
}

export function getLeaderboard(scopeRaw: string | null, playerId: string | null, now = Date.now()): LeaderboardResponse {
  const scope = parseScope(scopeRaw);
  const key = scopeKey(scope, now);
  const top = topRanked(key, TOP_N);

  let me: LeaderboardResponse["me"] = null;
  let myPending = false;
  if (playerId) {
    const mine = rankedForPlayer(key, playerId);
    if (mine) {
      const around = rankedRange(key, Math.max(1, mine.rank - AROUND), mine.rank + AROUND);
      me = { entry: toPublic([mine], playerId)[0], around: toPublic(around, playerId) };
    }
    myPending = listEntriesForPlayer(playerId).some((e) => e.scope === key && e.status === "pending");
  }
  return { scope: key, label: scopeLabel(scope), total: countRanked(key), entries: toPublic(top, playerId), me, myPending };
}

// ---------- 내 정보 / 기록 ----------

export interface HistoryItem {
  sessionId: string;
  startedAt: number;
  status: "active" | "completed" | "abandoned";
  totalScore: number;
  correctCount: number;
  answered: number;
  registered: boolean;
  registrationStatus: EntryStatus | null;
}

export function getHistory(playerId: string): HistoryItem[] {
  const entries = listEntriesForPlayer(playerId);
  return listSessionsByPlayer(playerId)
    .slice(0, 20)
    .map((s) => {
      const mine = entries.filter((e) => e.sessionId === s.id);
      const all = mine.find((e) => e.scope === "all");
      return {
        sessionId: s.id,
        startedAt: s.startedAt,
        status: s.status,
        totalScore: s.totalScore,
        correctCount: s.correctCount,
        answered: answeredCount(s.id),
        registered: mine.length > 0,
        registrationStatus: all?.status ?? null,
      };
    });
}

export function getMe(playerId: string) {
  const p = getPlayer(playerId)!;
  const sessions = listSessionsByPlayer(playerId);
  const completed = sessions.filter((s) => s.status === "completed");
  const nextChange = p.nickname && p.nicknameChangedAt ? p.nicknameChangedAt + NICKNAME_COOLDOWN_MS : null;
  return {
    playerId: p.id,
    nickname: p.nickname,
    bestScore: completed.reduce((m, s) => Math.max(m, s.totalScore), 0) || null,
    gamesCompleted: completed.length,
    nicknameChangeAvailableAt: nextChange && nextChange > Date.now() ? nextChange : null,
  };
}
