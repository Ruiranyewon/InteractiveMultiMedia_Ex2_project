import { respond, type IdContext } from "@/lib/api";
import { getSessionState } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(() => getSessionState(id));
}
