import { Reply, readJson, respond } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { getMe } from "@/lib/game/leaderboard-service";
import { findPlayer, restorePlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** 쿠키가 사라졌을 때 localStorage에 백업해 둔 익명 ID로 복구한다. 이미 쿠키가 있으면 쿠키가 우선한다. */
export function POST(req: Request) {
  return respond(async () => {
    const existing = findPlayer(req);
    if (existing) return getMe(existing.id);
    const { playerId } = await readJson(req);
    const restored = restorePlayer(playerId);
    if (!restored) throw new GameError(404, "PLAYER_NOT_FOUND", "복구할 수 있는 기록이 없습니다.");
    return new Reply(getMe(restored.player.id), { cookies: [restored.setCookie] });
  });
}
