import { expect, test } from "@playwright/test";

test("creates, joins, votes, reveals, and celebrates consensus", async ({ browser }) => {
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  await hostPage.goto("/");
  await hostPage.getByLabel("Your name").fill("Ada");
  await hostPage.getByLabel("First ticket").fill("PP-123");
  await hostPage.getByRole("button", { name: "Create session" }).click();
  await expect(hostPage.getByRole("heading", { name: "Round 1" })).toBeVisible();
  await expect(hostPage.getByText("PP-123")).toBeVisible();

  await guestPage.goto(hostPage.url());
  await guestPage.getByLabel("Your name").fill("Grace");
  await guestPage.getByRole("button", { name: "Join session" }).click();

  await hostPage.getByRole("button", { name: "5" }).click();
  await guestPage.getByRole("button", { name: "5" }).click();
  await hostPage.getByRole("button", { name: "Reveal votes" }).click();

  await expect(hostPage.getByText("Consensus: 5")).toBeVisible();
  await expect(hostPage.locator("#session-room")).toHaveAttribute("data-consensus", "true");
  await expect(hostPage.locator(".confetti-burst")).toBeVisible();
  await expect(hostPage.locator(".confetti-burst span")).toHaveCount(42);
  await expect(hostPage.locator(".confetti-burst span").first()).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(hostPage.getByText("Nearest Fibonacci")).toBeVisible();
  await expect(hostPage.getByText("Average")).toBeVisible();

  await hostPage.getByLabel("Next ticket").fill("PP-124");
  await hostPage.getByRole("button", { name: "Next round" }).click();
  await expect(hostPage.getByRole("heading", { name: "Round 2" })).toBeVisible();
  await expect(hostPage.getByText("PP-124")).toBeVisible();
  await expect(hostPage.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(hostPage.getByText("PP-123").last()).toBeVisible();
  await expect(guestPage.getByRole("heading", { name: "Round 2" })).toBeVisible();
  await expect(guestPage.getByText("PP-124")).toBeVisible();

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

test("theme switch persists the selected colour mode", async ({ page }) => {
  await page.goto("/");

  const toggle = page.getByRole("switch", { name: "Colour mode" });
  const initialTheme = await page.locator("html").getAttribute("data-theme");

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    initialTheme === "dark" ? "light" : "dark",
  );

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    initialTheme === "dark" ? "light" : "dark",
  );
});
