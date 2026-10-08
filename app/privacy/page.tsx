import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <>
      <Page>
        <main id="main" className="leading-7">
          <p role="note" className="rounded-xl bg-warn-bg p-3 text-sm text-warn-ink">
            ⚠ 이 문서는 <b>초안</b>이며 법률 검토를 거치지 않았습니다. 정식 서비스 전에 운영자 정보와 내용을 확정해야 합니다.
          </p>
          <h1 className="mt-5 text-2xl font-extrabold">개인정보처리방침 (초안)</h1>
          <p className="mt-1 text-sm text-muted">시행일: [서비스 개시일 기재] · 운영자: [운영자명/연락처 기재]</p>

          <h2 className="mt-6 text-lg font-bold">1. 수집하는 항목</h2>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <caption className="sr-only">수집 항목 표</caption>
            <thead><tr className="border-b border-line"><th scope="col" className="py-2 pr-3">항목</th><th scope="col" className="py-2 pr-3">목적</th><th scope="col" className="py-2">보관 기간</th></tr></thead>
            <tbody className="divide-y divide-line align-top">
              <tr><td className="py-2 pr-3">닉네임 (순위 등록 시 직접 입력)</td><td className="pr-3">순위표 표시</td><td>순위 기록과 함께 보관, 삭제 요청 시 지체 없이 삭제</td></tr>
              <tr><td className="py-2 pr-3">익명 ID (기기에 저장되는 임의의 UUID: 쿠키·localStorage)</td><td className="pr-3">같은 기기의 기록·순위·이어하기 식별</td><td>쿠키 최대 1년, 브라우저 데이터를 지우면 삭제</td></tr>
              <tr><td className="py-2 pr-3">플레이 기록 (문제별 답안·점수·소요 시간·진행 상태)</td><td className="pr-3">점수 계산, 결과·이어하기, 부정행위 방지, 문제 품질 개선</td><td>세션 원본은 90일 후 익명화·집계(운영 절차), 순위 기록은 계속 보존</td></tr>
              <tr><td className="py-2 pr-3">서비스 이용 이벤트 (게임 시작·완주 등, 개인 식별 정보 없음)</td><td className="pr-3">이용 통계</td><td>익명 통계로 보관</td></tr>
              <tr><td className="py-2 pr-3">접속 IP (속도 제한용, 서버 메모리에서 일시 처리)</td><td className="pr-3">과도한 요청 차단</td><td>저장하지 않음(프로세스 종료 시 소멸)</td></tr>
            </tbody>
          </table>
          <p className="mt-3">실명, 연락처, 위치정보 등은 수집하지 않습니다. 소셜 로그인은 현재 제공하지 않습니다.</p>

          <h2 className="mt-6 text-lg font-bold">2. 제3자 제공 및 위탁</h2>
          <p className="mt-1">이용자의 정보를 제3자에게 제공하지 않습니다. 호스팅·분석 도구를 도입하면 이 항목에 수탁자와 위탁 내용을 기재합니다. [호스팅 사업자 기재]</p>

          <h2 className="mt-6 text-lg font-bold">3. 이용자의 권리</h2>
          <p className="mt-1">이용자는 언제든지 브라우저의 쿠키·사이트 데이터를 삭제해 익명 ID를 지울 수 있으며, 닉네임 삭제 및 순위 기록 삭제를 운영자에게 요청할 수 있습니다. [문의 이메일 기재]</p>

          <h2 className="mt-6 text-lg font-bold">4. 아동의 개인정보</h2>
          <p className="mt-1">이 서비스는 만 14세 미만 아동을 대상으로 하지 않습니다. 만 14세 미만의 이용 허용 여부와 법정대리인 동의 절차는 정식 서비스 전에 확정합니다.</p>

          <h2 className="mt-6 text-lg font-bold">5. 안전성 확보 조치</h2>
          <p className="mt-1">HTTPS 전송, 정답 판정·점수 계산의 서버 처리, 입력 검증, 관리자 화면 인증, 요청 속도 제한 등을 적용합니다.</p>

          <h2 className="mt-6 text-lg font-bold">6. 변경 고지</h2>
          <p className="mt-1">내용이 바뀌면 이 페이지에 시행일과 함께 공지합니다.</p>

          <p className="mt-8"><Link className="underline underline-offset-2" href="/terms">이용약관 보기</Link></p>
        </main>
      </Page>
      <Footer />
    </>
  );
}
