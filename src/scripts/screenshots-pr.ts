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
    const host = await browser.newContext({ viewport });
    const guest = await browser.newContext({ viewport });
    const page = await host.newPage();
    const guestPage = await guest.newPage();

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-home.png` });
    await page.getByLabel("Your name").fill("Ada");
    await page.getByLabel("First ticket").fill("PP-123");
    await page.getByRole("button", { name: "Create session" }).click();
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-room.png` });
    if (viewport.name === "desktop") {
      await page.getByRole("button", { exact: true, name: "5" }).hover();
      await page.waitForTimeout(120);
      await page.screenshot({ fullPage: true, path: `${outputDir}/desktop-card-hover.png` });
    }

    await guestPage.goto(page.url());
    await guestPage.getByLabel("Your name").fill("Grace");
    await guestPage.getByRole("button", { name: "Join session" }).click();
    await page.getByRole("button", { name: "5" }).click();
    await guestPage.getByRole("button", { name: "8" }).click();
    await page.getByRole("button", { name: "Reveal votes" }).click();
    await page.getByText("Nearest Fibonacci").waitFor();
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-revealed.png` });

    await page.getByLabel("Next ticket").fill("PP-124");
    await page.getByRole("button", { name: "Next round" }).click();
    await page.getByRole("heading", { name: "History" }).waitFor();
    await page.screenshot({ fullPage: true, path: `${outputDir}/${viewport.name}-history.png` });

    await page.getByRole("button", { name: "5" }).click();
    await guestPage.getByRole("button", { name: "5" }).click();
    await page.getByRole("button", { name: "Reveal votes" }).click();
    await page.locator(".confetti-burst").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({
      fullPage: true,
      path: `${outputDir}/${viewport.name}-celebration.png`,
    });

    await host.close();
    await guest.close();
  }
  console.log(`Screenshots written to ${outputDir}`);
} finally {
  await browser.close();
  server.stop(true);
  await repository.close();
}
