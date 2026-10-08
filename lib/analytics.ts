import { insertEvent } from "@/lib/db";

// PRD 9장 이벤트. 개인정보(실명·연락처 등)는 수집하지 않으며 player_id는 익명 UUID이다.
export const EVENT_NAMES = [
  "game_start", "question_view", "answer_submit", "category_complete", "game_complete",
  "game_abandon", "leaderboard_submit", "share_click", "question_report",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface TrackInput {
  playerId?: string | null;
  sessionId?: string | null;
  props?: Record<string, unknown>;
}

/** 분석 백엔드 추상화. PostHog/GA4 등으로 바꿀 때는 이 인터페이스를 구현해 setAnalyticsLogger로 교체한다. */
export interface AnalyticsLogger {
  track(name: EventName, input?: TrackInput): void;
}

const PII_KEY = /nick|name|e-?mail|phone|address|realname/i;
function scrub(props: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !PII_KEY.test(k)));
}

export const consoleSqliteLogger: AnalyticsLogger = {
  track(name, input = {}) {
    try {
      const row = {
        name, ts: Date.now(), playerId: input.playerId ?? null, sessionId: input.sessionId ?? null, props: scrub(input.props),
      };
      if (process.env.NODE_ENV !== "test" && process.env.ANALYTICS_CONSOLE !== "0") {
        console.log("[analytics]", JSON.stringify(row));
      }
      insertEvent(row);
    } catch (e) {
      // 분석 실패가 게임을 막으면 안 된다.
      console.error("[analytics] 기록 실패", e instanceof Error ? e.message : e);
    }
  },
};

let logger: AnalyticsLogger = consoleSqliteLogger;
export function setAnalyticsLogger(l: AnalyticsLogger): void {
  logger = l;
}
export const analytics: AnalyticsLogger = { track: (name, input) => logger.track(name, input) };
