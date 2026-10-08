import fs from "node:fs";
import path from "node:path";

/** 비교용 정규화: 소문자, 한글·영문 이외 모두 제거(숫자·공백·기호로 우회하는 것 방지) */
export function normalizeForFilter(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[^가-힣a-z]/g, "");
}

let cache: string[] | null = null;
let cachePath = "";

export function blocklistPath(): string {
  return process.env.BLOCKLIST_PATH ?? path.join(process.cwd(), "data", "blocklist.txt");
}

export function loadBlocklist(file = blocklistPath()): string[] {
  if (cache && cachePath === file) return cache;
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  cache = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map(normalizeForFilter)
    .filter(Boolean);
  cachePath = file;
  return cache;
}

export function resetBlocklistCache(): void {
  cache = null;
}

/** 금칙어가 포함돼 있으면 true */
export function containsProfanity(text: string, list: string[] = loadBlocklist()): boolean {
  const n = normalizeForFilter(text);
  return list.some((w) => n.includes(w));
}
