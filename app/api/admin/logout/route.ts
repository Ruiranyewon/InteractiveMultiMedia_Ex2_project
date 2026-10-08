import { Reply, respond } from "@/lib/api";
import { logoutCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export function POST() {
  return respond(() => new Reply({ ok: true }, { cookies: [logoutCookie()] }));
}
