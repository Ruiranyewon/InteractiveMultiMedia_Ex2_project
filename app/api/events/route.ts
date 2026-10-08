import { readJson, respond } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { findPlayer } from "@/lib/identity";
import { GameError } from "@/lib/game/errors";

export const dynamic = "force-dynamic";

const CHANNELS = ["web_share", "copy_link"];

/** 클라이언트에서 발생하는 이벤트는 share_click만 받는다(그 외는 서버가 직접 기록). */
export function POST(req: Request) {
  return respond(async () => {
    const { name, channel } = await readJson(req);
    if (name !== "share_click") throw new GameError(400, "UNSUPPORTED_EVENT", "지원하지 않는 이벤트입니다.");
    analytics.track("share_click", { playerId: findPlayer(req)?.id ?? null, props: { channel: CHANNELS.includes(channel as string) ? channel : "other" } });
    return { ok: true };
  });
}
