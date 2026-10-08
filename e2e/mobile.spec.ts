import { test, expect } from "@playwright/test";
import { answerOne, startGame } from "./helpers";

test("(e) 360px 모바일: 가로 스크롤 없이 한 문제를 풀 수 있다", async ({ page }) => {
  for (const path of ["/", "/leaderboard", "/help"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await startGame(page);
  const box = await page.getByTestId("choice-0").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  await answerOne(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
