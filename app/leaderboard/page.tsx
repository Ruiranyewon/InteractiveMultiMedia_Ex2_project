import type { Metadata } from "next";
import Leaderboard from "@/components/Leaderboard";

export const metadata: Metadata = { title: "순위", description: "전체·주간·카테고리별 상식 퀴즈 순위표" };

export default function LeaderboardPage() {
  return <Leaderboard />;
}
