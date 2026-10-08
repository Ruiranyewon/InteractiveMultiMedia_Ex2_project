import { insertErrorLog } from "@/lib/db";

/** 서버 에러를 콘솔과 DB(error_logs)에 남긴다. 로깅 실패는 삼킨다. 요청 본문 등 개인정보는 넣지 않는다. */
export function logServerError(source: string, err: unknown, context?: Record<string, unknown>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  if (process.env.NODE_ENV !== "test") console.error(`[server-error] ${source}:`, e);
  try {
    insertErrorLog({ ts: Date.now(), source, message: e.message, stack: e.stack, context });
  } catch {
    /* ignore */
  }
}
