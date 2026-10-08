import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors select-none disabled:opacity-60 disabled:cursor-not-allowed";
const variants = {
  primary: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-brand-soft",
  ghost: "text-brand hover:bg-brand-soft",
  danger: "bg-bad-line text-white hover:opacity-90",
} as const;
export type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function LinkButton({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function Card({ className = "", ...p }: ComponentProps<"section">) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`} {...p} />;
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-2xl"} px-4 py-6`}>{children}</div>;
}

export function Spinner({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-muted">
      <span aria-hidden className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand align-[-2px]" />
      {label}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-bad-line bg-bad-bg p-4 text-bad-ink">
      <p className="font-semibold">문제가 생겼어요</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>다시 시도</Button>}
    </div>
  );
}
