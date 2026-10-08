import { readJson, respond } from "@/lib/api";
import { logServerError } from "@/lib/errorlog";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** 에러 바운더리가 보내는 클라이언트 오류 보고. 메시지·경로만 저장하고 사용자 식별 정보는 받지 않는다. */
export function POST(req: Request) {
  return respond(async () => {
    if (!allow(`client-error:${clientIp(req)}`, 10, 60_000)) return { ok: false };
    const { message, digest, path } = await readJson(req);
    logServerError("client", new Error(String(message ?? "unknown").slice(0, 500)), {
      digest: typeof digest === "string" ? digest.slice(0, 64) : undefined,
      path: typeof path === "string" ? path.slice(0, 200) : undefined,
    });
    return { ok: true };
  });
}
