import { Reply, respond } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { createSession } from "@/lib/game/service";
import { ensurePlayer } from "@/lib/identity";
import { allow, clientIp, limits } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return respond(() => {
    if (!allow(`session:${clientIp(req)}`, limits().sessionCreatePerMin, 60_000)) {
      throw new GameError(429, "RATE_LIMITED", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
    }
    const { player, setCookie } = ensurePlayer(req);
    return new Reply(createSession(player.id), { cookies: [setCookie] });
  });
}
