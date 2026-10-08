import { adminRespond } from "@/lib/admin-api";
import { adminListEntries } from "@/lib/db";
import { parseScope, scopeKey } from "@/lib/game/leaderboard-service";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return adminRespond(req, () => {
    const scope = scopeKey(parseScope(new URL(req.url).searchParams.get("scope")));
    return { scope, items: adminListEntries(scope).map(({ playerId: _p, ...rest }) => rest) };
  });
}
