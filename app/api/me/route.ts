import { Reply, respond } from "@/lib/api";
import { getMe } from "@/lib/game/leaderboard-service";
import { ensurePlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** 플레이어를 식별(없으면 익명 ID 발급)하고 내 요약을 돌려준다. */
export function GET(req: Request) {
  return respond(() => {
    const { player, setCookie } = ensurePlayer(req);
    return new Reply(getMe(player.id), { cookies: [setCookie] });
  });
}
