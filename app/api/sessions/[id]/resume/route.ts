import { respond, type IdContext } from "@/lib/api";
import { resumeSession } from "@/lib/game/service";
import { findPlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(() => resumeSession(id, findPlayer(req)?.id ?? null));
}
