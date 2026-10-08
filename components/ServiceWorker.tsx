"use client";
import { useEffect } from "react";

/** 프로덕션에서만 서비스 워커를 등록한다(개발 중 캐시로 인한 혼란 방지). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
