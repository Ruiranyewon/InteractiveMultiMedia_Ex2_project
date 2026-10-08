import type { Metadata } from "next";
import MyHistory from "@/components/MyHistory";

export const metadata: Metadata = { title: "내 기록", robots: { index: false } };

export default function MePage() {
  return <MyHistory />;
}
