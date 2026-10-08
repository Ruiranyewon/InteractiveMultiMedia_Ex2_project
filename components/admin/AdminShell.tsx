"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Spinner } from "@/components/ui";

type Auth = "checking" | "in" | "out" | "disabled";

/** 관리자 인증 게이트. 로그인되어 있으면 children을 렌더링한다. */
export default function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [auth, setAuth] = useState<Auth>("checking");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const check = useCallback(async () => {
    try {
      await api("/api/admin/reports");
      setAuth("in");
    } catch (e) {
      setAuth(e instanceof ApiError && e.status === 503 ? "disabled" : "out");
    }
  }, []);
  useEffect(() => { void check(); }, [check]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/admin/login", { body: { password: pw } });
      setPw("");
      setAuth("in");
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : "로그인하지 못했어요."); }
  };
  const logout = async () => { await api("/api/admin/logout", { body: {} }).catch(() => {}); setAuth("out"); };

  if (auth === "checking") return <main id="main" className="p-6"><Spinner /></main>;
  if (auth === "disabled") {
    return (
      <main id="main" className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">관리자 기능이 꺼져 있어요</h1>
        <p className="mt-2 text-muted">서버에 <code>ADMIN_PASSWORD</code> 환경변수를 설정한 뒤 다시 시작하세요. (.env.example 참고)</p>
      </main>
    );
  }
  if (auth === "out") {
    return (
      <main id="main" className="mx-auto max-w-sm p-6">
        <h1 className="text-xl font-bold">관리자 로그인</h1>
        <form onSubmit={login} className="mt-4 grid gap-3">
          <label htmlFor="admin-pw" className="font-medium">비밀번호</label>
          <input id="admin-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="min-h-12 rounded-xl border-2 border-line bg-surface px-3" />
          <p role="alert" className="min-h-5 text-sm font-semibold text-bad-ink dark:text-bad-line">{err}</p>
          <Button type="submit">로그인</Button>
        </form>
      </main>
    );
  }
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">관리자 · {title}</h1>
        <nav aria-label="관리자 메뉴" className="flex flex-wrap items-center gap-1 text-sm">
          <Link className="inline-flex min-h-12 items-center px-3 underline underline-offset-2" href="/admin">운영</Link>
          <Link className="inline-flex min-h-12 items-center px-3 underline underline-offset-2" href="/admin/stats">통계</Link>
          <Link className="inline-flex min-h-12 items-center px-3 underline underline-offset-2" href="/">사이트</Link>
          <Button variant="secondary" className="min-h-12" onClick={() => void logout()}>로그아웃</Button>
        </nav>
      </header>
      {children}
    </main>
  );
}
