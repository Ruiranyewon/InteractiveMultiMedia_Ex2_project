"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { applySettings, getSettings, updateSettings, useSettings, type Settings } from "@/lib/client/settings";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-line bg-line transition-colors checked:border-brand checked:bg-brand relative before:absolute before:left-0.5 before:top-0.5 before:h-4.5 before:w-4.5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-5"
      />
    </label>
  );
}

/** 설정 버튼 + 모달. 값은 localStorage에 저장된다. */
export default function SettingsDialog({ label = "설정" }: { label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = useSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); applySettings(getSettings()); }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>);

  return (
    <>
      <Button variant="ghost" className="min-h-12 px-3" onClick={() => ref.current?.showModal()} aria-haspopup="dialog" aria-label="설정">
        <span aria-hidden>⚙</span> {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="settings-title"
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      >
        <h2 id="settings-title" className="text-lg font-bold">설정</h2>
        {mounted && (
          <div className="mt-2 divide-y divide-line">
            <Toggle label="효과음" checked={s.sound} onChange={(v) => set("sound", v)} />
            <Toggle label="진동" hint="지원하는 기기에서만 동작해요" checked={s.vibration} onChange={(v) => set("vibration", v)} />
            <Toggle label="자동 진행" hint="정답 확인 후 2.5초 뒤 다음 문제로" checked={s.autoAdvance} onChange={(v) => set("autoAdvance", v)} />
            <Toggle label="모션 줄이기" hint="끄면 기기의 시스템 설정을 따라요" checked={s.reduceMotion === "on"} onChange={(v) => set("reduceMotion", v ? "on" : "system")} />
            <fieldset className="py-3">
              <legend className="font-medium">글자 크기</legend>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="글자 크기">
                {([100, 125, 150] as const).map((n) => (
                  <label
                    key={n}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 ${
                      s.fontScale === n ? "border-brand bg-brand-soft text-brand-soft-ink" : "border-line"
                    }`}
                  >
                    <input type="radio" name="fontScale" className="sr-only" checked={s.fontScale === n} onChange={() => set("fontScale", n)} />
                    {n}%
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        <Button className="mt-3 w-full" onClick={() => ref.current?.close()}>닫기</Button>
      </dialog>
    </>
  );
}
