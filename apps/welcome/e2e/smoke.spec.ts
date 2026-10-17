import { expect, test } from "@playwright/test";

// The placeholder home page must load from a production build in a real
// Chromium browser (design D6).
test("home page shows the app heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome");
});
