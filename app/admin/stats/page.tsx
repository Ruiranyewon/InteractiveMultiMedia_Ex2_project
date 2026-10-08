import type { Metadata } from "next";
import AdminStats from "@/components/admin/AdminStats";

export const metadata: Metadata = { title: "관리자 통계", robots: { index: false, follow: false } };

export default function AdminStatsPage() {
  return <AdminStats />;
}
