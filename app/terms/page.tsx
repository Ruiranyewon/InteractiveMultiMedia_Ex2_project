import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <>
      <Page>
        <main id="main" className="leading-7">
          <p role="note" className="rounded-xl bg-warn-bg p-3 text-sm text-warn-ink">
            ⚠ 이 문서는 <b>초안</b>이며 법률 검토를 거치지 않았습니다. 정식 서비스 전에 운영자 정보와 내용을 확정해야 합니다.
          </p>
          <h1 className="mt-5 text-2xl font-extrabold">이용약관 (초안)</h1>
          <p className="mt-1 text-sm text-muted">시행일: [서비스 개시일 기재] · 운영자: [운영자명/연락처 기재]</p>

          <h2 className="mt-6 text-lg font-bold">1. 서비스</h2>
          <p className="mt-1">QuizUp 상식(이하 &quot;서비스&quot;)은 객관식 상식 퀴즈를 풀고 점수를 순위표에 남길 수 있는 무료 웹 서비스입니다. 게임은 인터넷 연결이 필요합니다.</p>

          <h2 className="mt-6 text-lg font-bold">2. 이용 규칙</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>자동화 도구, 정답 유출, 비정상적인 요청 등 순위의 공정성을 해치는 행위를 금지합니다.</li>
            <li>부적절하거나 타인을 비방·사칭하는 닉네임을 사용할 수 없으며, 운영자는 이를 삭제하거나 변경을 요구할 수 있습니다.</li>
            <li>비정상적인 응답 패턴이 감지된 기록은 검토 후 순위표에 표시되거나 제외될 수 있습니다.</li>
          </ul>

          <h2 className="mt-6 text-lg font-bold">3. 콘텐츠</h2>
          <p className="mt-1">문제와 해설은 일반 상식을 바탕으로 작성되었으나 오류가 있을 수 있습니다. 오류를 발견하면 문제 화면의 &quot;문제 신고&quot;로 알려 주세요. 신고가 누적된 문제는 검토를 위해 출제에서 제외될 수 있습니다.</p>

          <h2 className="mt-6 text-lg font-bold">4. 면책</h2>
          <p className="mt-1">서비스는 있는 그대로 제공되며, 점검·장애·데이터 정리로 기록이 변경되거나 삭제될 수 있습니다.</p>

          <h2 className="mt-6 text-lg font-bold">5. 연령</h2>
          <p className="mt-1">이 서비스는 만 14세 미만을 대상으로 하지 않습니다. (확정 전 초안)</p>

          <h2 className="mt-6 text-lg font-bold">6. 약관의 변경</h2>
          <p className="mt-1">약관이 바뀌면 이 페이지에 시행일과 함께 공지합니다.</p>

          <p className="mt-8"><Link className="underline underline-offset-2" href="/privacy">개인정보처리방침 보기</Link></p>
        </main>
      </Page>
      <Footer />
    </>
  );
}
