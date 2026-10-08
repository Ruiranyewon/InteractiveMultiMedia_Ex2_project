import { randomUUID } from "node:crypto";
import { getPlayer, insertPlayer, type PlayerRecord } from "@/lib/db";

export const PLAYER_COOKIE = "qid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function buildCookie(name: string, value: string, maxAgeS: number): string {
  const secure = process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`;
}

/** 쿠키로 식별되는 기존 플레이어. 없거나 DB에 없으면 null (생성하지 않음). */
export function findPlayer(req: Request): PlayerRecord | null {
  const id = parseCookies(req.headers.get("cookie"))[PLAYER_COOKIE];
  return id && UUID_RE.test(id) ? getPlayer(id) : null;
}

/** 플레이어를 식별하고, 없으면 새로 발급한다. 새로 발급했다면 setCookie에 Set-Cookie 값이 들어 있다. */
export function ensurePlayer(req: Request): { player: PlayerRecord; setCookie: string | null } {
  const existing = findPlayer(req);
  if (existing) return { player: existing, setCookie: null };
  const player = insertPlayer(randomUUID(), Date.now());
  return { player, setCookie: buildCookie(PLAYER_COOKIE, player.id, ONE_YEAR_S) };
}

/** localStorage에 백업된 ID로 쿠키를 복구한다(쿠키 삭제 후 복귀용). 존재하는 ID만 허용. */
export function restorePlayer(id: unknown): { player: PlayerRecord; setCookie: string } | null {
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  const player = getPlayer(id);
  return player ? { player, setCookie: buildCookie(PLAYER_COOKIE, player.id, ONE_YEAR_S) } : null;
}
