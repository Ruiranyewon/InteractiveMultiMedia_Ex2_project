import { Reply, readJson, respond } from "@/lib/api";
import { login } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return respond(async () => {
    const { password } = await readJson(req);
    return new Reply({ ok: true }, { cookies: [login(req, password)] });
  });
}
