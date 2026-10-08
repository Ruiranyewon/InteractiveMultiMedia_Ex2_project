import type { Metadata } from "next";
import Game from "@/components/Game";

export const metadata: Metadata = { title: "퀴즈", robots: { index: false } };

export default function PlayPage() {
  return <Game />;
}
