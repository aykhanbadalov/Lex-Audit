import { expect, test } from "@playwright/test";

test("the assistant streams an answer in a real browser, with its tool and sources", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Pointing the assistant at a news item starts the question with its name and id.
  await page.goto("/news/news-einvoice-bill");
  await page.getByRole("link", { name: "AI-dan soruş" }).click();
  await expect(page).toHaveURL(/\/assistant/);
  await expect(page.getByLabel("Mesajınız")).toHaveValue(/news-einvoice-bill/);

  await page.getByLabel("Mesajınız").fill("ƏDV qaimə haqqında nə deyilir?");
  await page.getByLabel("Mesajınız").press("Enter");

  await expect(page.getByText("Qanunvericilikdə axtarış")).toBeVisible({ timeout: 15_000 });
  const sources = page.getByRole("region", { name: "Mənbələr" });
  await expect(sources).toBeVisible({ timeout: 15_000 });
  await expect(sources.getByRole("listitem")).toHaveCount(2);
});
