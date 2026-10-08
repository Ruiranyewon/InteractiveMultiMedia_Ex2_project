import { expect, type Page, type APIRequestContext } from "@playwright/test";

export async function startGame(page: Page) {
  await page.goto("/play");
  await expect(page.getByTestId("question")).toBeVisible();
}

/** 보기 하나를 눌러 피드백이 나올 때까지 기다린다. 0.3초 미만 연속 제출 의심을 피하려고 약간 대기. */
export async function answerOne(page: Page, idx = 0) {
  await page.waitForTimeout(450);
  await page.getByTestId(`choice-${idx}`).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
}

/** 화면을 통해 40문제를 끝까지 푼다(자동 진행은 꺼진 상태 가정). */
export async function playThrough(page: Page) {
  for (let i = 0; i < 40; i++) {
    await answerOne(page, i % 4);
    await page.getByTestId("next").click();
    // 카테고리 종료마다 소결과 화면
    const summaryBtn = page.getByRole("button", { name: /^(다음: |최종 결과 보기)/ });
    if ((i + 1) % 10 === 0) await summaryBtn.click();
  }
  await expect(page.getByTestId("total-score")).toBeVisible();
}

/** API만으로 한 판을 끝까지 풀고 푼 문제 id 목록을 돌려준다(다른 플레이어를 흉내 내기 위함). */
export async function playViaApi(api: APIRequestContext): Promise<{ sessionId: string; questionIds: string[] }> {
  const created = await (await api.post("/api/sessions")).json();
  const sessionId: string = created.sessionId;
  let q = created.question;
  const ids: string[] = [];
  while (q) {
    ids.push(q.id);
    await new Promise((r) => setTimeout(r, 350));
    const res = await api.post(`/api/sessions/${sessionId}/answer`, { data: { questionId: q.id, selectedIndex: 0 } });
    expect(res.ok()).toBeTruthy();
    q = (await res.json()).next;
  }
  return { sessionId, questionIds: ids };
}
