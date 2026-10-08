import { respond, type IdContext } from "@/lib/api";
import { unpauseSession } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(() => unpauseSession(id));
}
