import { respond } from "@/lib/api";
import { getHistory } from "@/lib/game/leaderboard-service";
import { findPlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return respond(() => {
    const p = findPlayer(req);
    return { items: p ? getHistory(p.id) : [] };
  });
}
