import { NICKNAME_MAX, NICKNAME_MIN, checkNicknameFormat } from "./nickname-rules";
import { containsProfanity } from "./profanity";

export { NICKNAME_MAX, NICKNAME_MIN };
export const NICKNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type NicknameCheck =
  | { ok: true; value: string }
  | { ok: false; code: "TOO_SHORT" | "TOO_LONG" | "INVALID_CHARS" | "PROFANITY"; message: string };

/** 2~12자, 한글/영문/숫자/공백·_·- 만 허용, 금칙어 불가. 앞뒤 공백은 제거한다. */
export function validateNickname(input: unknown): NicknameCheck {
  const f = checkNicknameFormat(input);
  if (!f.ok) return f;
  if (containsProfanity(f.value)) return { ok: false, code: "PROFANITY", message: "사용할 수 없는 단어가 포함되어 있어요." };
  return f;
}
