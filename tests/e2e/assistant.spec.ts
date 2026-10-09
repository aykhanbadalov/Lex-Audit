import { expect, test } from "@playwright/test";

test("the assistant streams an answer in a real browser and links its sources", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/news/news-einvoice-bill");
  await page.getByRole("link", { name: "AI-dan soruş" }).click();
  await expect(page).toHaveURL(/\/assistant/);

  await page.getByLabel("Mesajınız").fill("ƏDV qaimə haqqında nə deyilir?");
  await page.getByLabel("Mesajınız").press("Enter");

  const sources = page.getByRole("region", { name: "Mənbələr" });
  await expect(sources).toBeVisible({ timeout: 15_000 });
  await sources.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/(legislation|news)\//);
});
