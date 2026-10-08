import { readJson, respond } from "@/lib/api";
import { getLeaderboard, registerEntry } from "@/lib/game/leaderboard-service";
import { findPlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return respond(() => {
    const scope = new URL(req.url).searchParams.get("scope");
    return getLeaderboard(scope, findPlayer(req)?.id ?? null);
  });
}

export function POST(req: Request) {
  return respond(async () => {
    // sessionId와 nickname만 읽는다. 점수 관련 필드가 와도 무시한다(점수는 서버 저장값 사용).
    const { sessionId, nickname } = await readJson(req);
    return registerEntry(findPlayer(req)?.id ?? null, sessionId, nickname);
  });
}
