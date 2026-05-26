import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://127.0.0.1:39100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=39100 DB_PATH=:memory: bun src/index.ts",
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:39100/healthz",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
