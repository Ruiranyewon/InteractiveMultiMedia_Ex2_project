import { adminRespond } from "@/lib/admin-api";
import { getPlayer, listEntriesForSession, listFlaggedSessions, answeredCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return adminRespond(req, () => ({
    items: listFlaggedSessions().map((s) => {
      const entries = listEntriesForSession(s.id);
      return {
        sessionId: s.id,
        startedAt: s.startedAt,
        status: s.status,
        totalScore: s.totalScore,
        correctCount: s.correctCount,
        answered: answeredCount(s.id),
        totalTimeMs: s.totalTimeMs,
        nickname: s.playerId ? getPlayer(s.playerId)?.nickname ?? null : null,
        entryStatus: entries.length ? entries[0].status : null,
      };
    }),
  }));
}
