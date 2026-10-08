"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadMe, type Me } from "@/lib/client/player";
import { formatScore } from "@/lib/client/api";

/** 홈의 '내 최고 점수' 카드. 정적 본문과 분리해 첫 화면 표시를 막지 않는다. */
export default function HomeStats() {
  const [me, setMe] = useState<Me | null | "error">(null);
  useEffect(() => { loadMe().then(setMe).catch(() => setMe("error")); }, []);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-4" aria-live="polite">
      <p className="text-sm text-muted">내 최고 점수</p>
      {me === null ? (
        <p className="mt-1 text-2xl font-bold text-muted">…</p>
      ) : me === "error" ? (
        <p className="mt-1 text-sm text-muted">기록을 불러오지 못했어요.</p>
      ) : me.bestScore ? (
        <p className="mt-1 text-3xl font-extrabold tabular-nums">
          {formatScore(me.bestScore)}<span className="ml-1 text-base font-semibold text-muted">점</span>
        </p>
      ) : (
        <p className="mt-1 text-lg font-semibold">아직 완주한 기록이 없어요</p>
      )}
      {me && me !== "error" && (
        <p className="mt-2 text-sm text-muted">
          {me.nickname ? `${me.nickname} · ` : ""}완주 {me.gamesCompleted}회 ·{" "}
          <Link className="underline underline-offset-2" href="/me">내 기록 보기</Link>
        </p>
      )}
    </div>
  );
}
