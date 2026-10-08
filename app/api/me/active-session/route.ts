import { respond } from "@/lib/api";
import { findResumableSession } from "@/lib/game/service";
import { findPlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** 이어하기 가능한 판(24시간 이내 active)이 있으면 요약을, 없으면 null을 돌려준다. */
export function GET(req: Request) {
  return respond(() => {
    const p = findPlayer(req);
    return { session: p ? findResumableSession(p.id) : null };
  });
}
