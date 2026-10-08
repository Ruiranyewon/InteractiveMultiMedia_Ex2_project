import { Reply, readJson, respond, type IdContext } from "@/lib/api";
import { reportQuestion } from "@/lib/game/report-service";
import { ensurePlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(async () => {
    const body = await readJson(req);
    const { player, setCookie } = ensurePlayer(req);
    return new Reply(reportQuestion(player.id, id, body), { cookies: [setCookie] });
  });
}
