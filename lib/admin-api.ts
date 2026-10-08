import { respond } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";

/** 관리자 인증을 거친 뒤 핸들러를 실행한다. */
export function adminRespond(req: Request, fn: () => unknown | Promise<unknown>): Promise<Response> {
  return respond(async () => {
    requireAdmin(req);
    return fn();
  });
}
