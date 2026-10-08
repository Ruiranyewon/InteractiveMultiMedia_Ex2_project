import { GameError } from "@/lib/game/errors";
import { logServerError } from "@/lib/errorlog";

export type IdContext = { params: Promise<{ id: string }> };

/** 본문 외에 쿠키·상태 코드를 함께 지정하고 싶을 때 반환한다. */
export class Reply {
  constructor(public body: unknown, public init: { status?: number; cookies?: Array<string | null> } = {}) {}
}

function build(body: unknown, init: { status?: number; cookies?: Array<string | null> } = {}): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const c of init.cookies ?? []) if (c) headers.append("Set-Cookie", c);
  return Response.json(body, { status: init.status ?? 200, headers });
}

/** 핸들러를 감싸 GameError → JSON 오류 응답으로 변환하고, 예상치 못한 오류는 로그에 남긴다. */
export async function respond(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Reply ? build(out.body, out.init) : build(out);
  } catch (e) {
    if (e instanceof GameError) {
      const extra = e.extra ? { ...e.extra } : {};
      return build({ error: { code: e.code, message: e.message, ...extra } }, { status: e.status });
    }
    logServerError("api", e);
    return build({ error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw new GameError(400, "BAD_JSON", "요청 본문이 올바른 JSON 객체가 아닙니다.");
}
