import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const DB = "data/e2e.db";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    // 시스템 Chrome 사용(브라우저 다운로드 불필요). 없으면 `npx playwright install chromium` 후 channel 줄 제거.
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 360, height: 740 } }, testMatch: /mobile/ },
  ],
  webServer: {
    command: `rm -f ${DB}* && QUIZ_DB_PATH=${DB} npm run seed >/dev/null && npm run build >/dev/null && QUIZ_DB_PATH=${DB} ADMIN_PASSWORD=e2e-pass SESSION_RATE_LIMIT_PER_MIN=1000 ANSWER_RATE_LIMIT_PER_SEC=100 ANALYTICS_CONSOLE=0 npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
