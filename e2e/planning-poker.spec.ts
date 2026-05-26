import { expect, test } from "@playwright/test";

test("creates, joins, votes, reveals, and celebrates consensus", async ({ browser }) => {
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  await hostPage.goto("/");
  await hostPage.getByLabel("Your name").fill("Ada");
  await hostPage.getByRole("button", { name: "Create session" }).click();
  await expect(hostPage.getByRole("heading", { name: "Round 1" })).toBeVisible();

  await guestPage.goto(hostPage.url());
  await guestPage.getByLabel("Your name").fill("Grace");
  await guestPage.getByRole("button", { name: "Join session" }).click();

  await hostPage.getByRole("button", { name: "5" }).click();
  await guestPage.getByRole("button", { name: "5" }).click();
  await hostPage.getByRole("button", { name: "Reveal votes" }).click();

  await expect(hostPage.getByText("Consensus: 5")).toBeVisible();
  await expect(hostPage.locator("#session-room")).toHaveAttribute("data-consensus", "true");
  await expect(hostPage.locator(".confetti-burst")).toBeVisible();

  await host.close();
  await guest.close();
});

test("question mark card is keyboard accessible and prevents consensus", async ({
  page,
  browser,
}) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();

  await page.goto("/");
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Create session" }).click();

  await guestPage.goto(page.url());
  await guestPage.getByLabel("Your name").fill("Grace");
  await guestPage.getByRole("button", { name: "Join session" }).click();

  await page.getByRole("button", { exact: true, name: "3" }).click();
  await guestPage.getByRole("button", { name: "I don't know" }).focus();
  await guestPage.keyboard.press("Enter");
  await page.getByRole("button", { name: "Reveal votes" }).click();

  await expect(page.getByText("Revealed votes")).toBeVisible();
  await expect(page.locator("#session-room")).toHaveAttribute("data-consensus", "false");

  await guest.close();
});
