// 서버/클라이언트가 함께 쓰는 닉네임 형식 검사 (fs를 쓰는 금칙어 검사는 서버 전용 lib/nickname.ts)
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

export type FormatCheck =
  | { ok: true; value: string }
  | { ok: false; code: "TOO_SHORT" | "TOO_LONG" | "INVALID_CHARS"; message: string };

export function checkNicknameFormat(input: unknown): FormatCheck {
  const value = typeof input === "string" ? input.trim() : "";
  const len = [...value].length;
  if (len < NICKNAME_MIN) return { ok: false, code: "TOO_SHORT", message: `닉네임은 ${NICKNAME_MIN}자 이상이어야 해요.` };
  if (len > NICKNAME_MAX) return { ok: false, code: "TOO_LONG", message: `닉네임은 ${NICKNAME_MAX}자 이하여야 해요.` };
  if (!/^[가-힣a-zA-Z0-9 _-]+$/.test(value)) {
    return { ok: false, code: "INVALID_CHARS", message: "한글, 영문, 숫자, 공백, _ , - 만 사용할 수 있어요." };
  }
  return { ok: true, value };
}
