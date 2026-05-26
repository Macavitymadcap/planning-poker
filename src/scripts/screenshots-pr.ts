import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createApp } from "../app";
import { SqlitePlanningPokerRepository } from "../db/sqlite";

const outputDir = ".cache/pr-screenshots/pp-0001";
await mkdir(outputDir, { recursive: true });

const port = Number(process.env.SCREENSHOT_PORT ?? 3300);
const repository = new SqlitePlanningPokerRepository(":memory:");
await repository.migrate();
const app = createApp({ baseUrl: `http://127.0.0.1:${port}`, repository });
const server = Bun.serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
const browser = await chromium.launch();

try {
  for (const viewport of [
    { height: 900, name: "desktop", width: 1280 },
    { height: 915, name: "mobile", width: 412 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-home.png` });
    await page.getByLabel("Your name").fill("Ada");
    await page.getByRole("button", { name: "Create session" }).click();
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-room.png` });
    await page.close();
  }
  console.log(`Screenshots written to ${outputDir}`);
} finally {
  await browser.close();
  server.stop(true);
  await repository.close();
}
