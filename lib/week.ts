const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 주간 순위 키(예: "2026-W41"). 한국 표준시(KST) 기준 월요일 00:00에 새 주가 시작한다(ISO 8601 주 번호).
 * 일요일 23:59:59.999 KST와 월요일 00:00:00.000 KST는 서로 다른 키를 갖는다.
 */
export function weekKey(epochMs: number): string {
  const kst = new Date(epochMs + KST_OFFSET_MS);
  const day = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const dow = day.getUTCDay() || 7; // 월=1 … 일=7
  day.setUTCDate(day.getUTCDate() + 4 - dow); // 그 주의 목요일
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
