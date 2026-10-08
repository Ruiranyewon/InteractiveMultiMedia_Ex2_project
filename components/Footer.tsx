import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 text-sm text-muted">
      <nav aria-label="사이트 정보" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link className="underline underline-offset-2 py-2" href="/help">도움말</Link>
        <Link className="underline underline-offset-2 py-2" href="/privacy">개인정보처리방침</Link>
        <Link className="underline underline-offset-2 py-2" href="/terms">이용약관</Link>
      </nav>
    </footer>
  );
}
