// 메모리 기반 슬라이딩 윈도우 속도 제한. 단일 프로세스 전용 (다중 인스턴스에서는 Redis 등으로 교체).
const hits = new Map<string, number[]>();

/** 허용되면 true. 한도를 넘으면 false(기록하지 않음). */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) sweep(now, windowMs);
  return true;
}

function sweep(now: number, windowMs: number) {
  for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
}

export function resetRateLimits(): void {
  hits.clear();
}

const num = (v: string | undefined, d: number) => (v && Number(v) > 0 ? Number(v) : d);
/** 기본값은 PRD 8.4. 테스트·E2E에서 환경변수로 조정한다. */
export const limits = () => ({
  sessionCreatePerMin: num(process.env.SESSION_RATE_LIMIT_PER_MIN, 10),
  answerPerSec: num(process.env.ANSWER_RATE_LIMIT_PER_SEC, 2),
  adminLoginFailPer15Min: num(process.env.ADMIN_LOGIN_FAIL_LIMIT, 5),
});

/** 프록시 뒤에서는 신뢰할 수 있는 프록시가 설정한 X-Forwarded-For 첫 값을 사용한다. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local").slice(0, 64);
}

/** 기록하지 않고, 지금 한 번 더 허용될지만 확인한다. */
export function wouldAllow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length < limit;
}
/** 실패 같은 이벤트를 기록만 한다. */
export function record(key: string, windowMs: number, now = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
}
