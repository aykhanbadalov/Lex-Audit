import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("filter the news, open an item, and see it become read", async ({ page }) => {
  await signIn(page);
  await page.getByRole("navigation", { name: "Əsas naviqasiya" }).getByRole("link", { name: "Xəbərlər" }).click();

  await expect(page.getByRole("article")).toHaveCount(8);
  await page.getByLabel("Oxunma").selectOption("unread");
  await expect(page).toHaveURL(/read=unread/);

  await page.getByRole("link", { name: /Sadələşdirilmiş vergi/ }).click();
  await expect(page.getByRole("region", { name: "Süni intellekt tərəfindən yaradılıb" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mənbə mətni" })).toBeVisible();

  await page.getByRole("link", { name: "Xəbərlərə qayıt" }).click();
  // Back restores the filter, and the item we just read is no longer in the unread list.
  await expect(page).toHaveURL(/read=unread/);
  await expect(page.getByRole("link", { name: /Sadələşdirilmiş vergi/ })).toHaveCount(0);
});

test("a filtered news URL can be opened directly and survives a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/news?q=Sad%C9%99l%C9%99%C5%9Fdirilmi%C5%9F");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("search keeps every typed character while the URL updates", async ({ page }) => {
  await signIn(page);
  await page.goto("/news");
  await page.getByRole("searchbox", { name: "Axtarış" }).pressSequentially("depozit hesabı", { delay: 120 });
  await expect(page.getByRole("searchbox", { name: "Axtarış" })).toHaveValue("depozit hesabı");
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("compare two versions of a law and see the changes", async ({ page }) => {
  await signIn(page);
  await page.goto("/legislation");
  await page.getByRole("link", { name: "Vergi Məcəlləsi" }).click();
  await page.getByRole("tab", { name: "Versiyaları müqayisə et" }).click();

  await expect(page.locator("ins").first()).toBeVisible();
  await expect(page.locator("del").first()).toBeVisible();
  await expect(page).toHaveURL(/view=diff/);
});
