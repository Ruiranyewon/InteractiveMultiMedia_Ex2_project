import type { Metadata } from "next";
import Result from "@/components/Result";

export const metadata: Metadata = { title: "결과", robots: { index: false } };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Result sessionId={id} />;
}
