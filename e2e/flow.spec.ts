import { test, expect, request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { answerOne, playThrough, playViaApi, startGame } from "./helpers";

test("(a) 완주 → 순위 등록 → 순위표 확인", async ({ page }) => {
  await startGame(page);
  await playThrough(page);
  await expect(page.getByTestId("grade")).toBeVisible();
  await page.getByTestId("register-open").click();
  await page.getByLabel("닉네임").fill("E2E플레이어");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByTestId("rank-info")).toBeVisible();

  await page.goto("/leaderboard");
  await expect(page.getByText("E2E플레이어").first()).toBeVisible();
});

test("(b) 중간 이탈 → 이어하기", async ({ page }) => {
  await startGame(page);
  await answerOne(page);
  await page.getByTestId("next").click();
  await expect(page.getByTestId("question")).toBeVisible();
  await page.goto("/");
  await page.goto("/play");
  await expect(page.getByRole("heading", { name: "이어서 하시겠어요?" })).toBeVisible();
  await page.getByRole("button", { name: "이어하기" }).click();
  await expect(page.getByTestId("question")).toBeVisible();
  await expect(page.getByText(/2\s*\/\s*40/).first()).toBeVisible();
});

test("(c) 시간 초과는 오답·0점으로 처리되고 정답이 공개된다", async ({ page }) => {
  test.setTimeout(60_000);
  await startGame(page);
  await expect(page.getByTestId("feedback")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("points")).toHaveText("+0점");
  await expect(page.getByTestId("mark-correct")).toBeVisible();
});

test("(d) 신고 3건이 쌓인 문제는 출제에서 제외된다", async ({ baseURL }) => {
  test.setTimeout(180_000);
  const ctxs = await Promise.all([1, 2, 3].map(() => request.newContext({ baseURL })));
  const plays = await Promise.all(ctxs.map((c) => playViaApi(c)));
  const common = plays[0].questionIds.find((id) => plays.every((p) => p.questionIds.includes(id)));
  test.skip(!common, "세 판에 공통으로 나온 문제가 없음(확률적으로 드묾)");
  for (let i = 0; i < 3; i++) {
    const res = await ctxs[i].post(`/api/questions/${common}/report`, { data: { reason: "wrong_answer", sessionId: plays[i].sessionId } });
    expect(res.ok()).toBeTruthy();
  }
  const fresh = await request.newContext({ baseURL });
  for (let n = 0; n < 5; n++) {
    const created = await (await fresh.post("/api/sessions")).json();
    const r = await (await fresh.get(`/api/sessions/${created.sessionId}`)).json();
    expect(JSON.stringify(r)).not.toContain(common!); // 첫 문제 외에도 전체 목록은 노출되지 않지만 최소한 현재 문제 확인
    expect(created.question.id).not.toBe(common);
  }
});

test("정답(answerIndex)이 답 제출 전 네트워크 응답에 노출되지 않는다", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/sessions") && res.request().method() !== "POST" || res.url().endsWith("/api/sessions")) {
      try { bodies.push(await res.text()); } catch {}
    }
  });
  await startGame(page);
  await page.waitForTimeout(500);
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) {
    expect(b).not.toMatch(/answerIndex|correctIndex|explanation/);
  }
});

test("(f) axe: 홈·도움말·순위표·퀴즈 화면에 심각한 접근성 위반이 없다", async ({ page }) => {
  for (const path of ["/", "/help", "/leaderboard", "/privacy"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`), path).toEqual([]);
  }
  await startGame(page);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => `quiz: ${v.id}`)).toEqual([]);
  await answerOne(page);
  const r2 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r2.violations.map((v) => `feedback: ${v.id}`)).toEqual([]);
});
