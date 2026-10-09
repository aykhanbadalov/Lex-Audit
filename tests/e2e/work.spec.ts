import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("the three new sections load directly and after a reload", async ({ page }) => {
  await signIn(page);
  for (const [path, heading] of [
    ["/excel", "Excel"],
    ["/reconciliation", "Uzlaşdırma"],
    ["/integrations", "İnteqrasiyalar"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("run an Excel operation and find the result as a new file", async ({ page }) => {
  await signIn(page);
  await page.goto("/excel/wb-sales");
  await page.getByRole("button", { name: "İcra et" }).click();
  await expect(page.getByRole("link", { name: "Satış reyestri (təmizlənmiş).xlsx" })).toBeVisible({ timeout: 15_000 });
});

test("confirm a suggested match in a reconciliation", async ({ page }) => {
  await signIn(page);
  await page.goto("/reconciliation/rec-1?status=suggested");
  await page.getByRole("button", { name: "Təsdiq et" }).first().click();
  await expect(page.getByRole("row")).toHaveCount(2); // header + the one suggestion left
});

test("map a bank statement and import it, with a confirmation before anything is written", async ({ page }) => {
  await signIn(page);
  await page.goto("/integrations/imp-2");
  await expect(page.getByRole("button", { name: "İdxal et" })).toBeDisabled();
  await page.getByLabel(/Məbləğ/).selectOption("Debet");
  await page.getByRole("button", { name: "Xəritələməni saxla" }).click();
  await expect(page.getByRole("button", { name: "İdxal et" })).toBeEnabled();
  await page.getByRole("button", { name: "İdxal et" }).click();
  await expect(page.getByRole("dialog")).toContainText("geri qaytarmaq mümkün deyil");
  await page.getByRole("dialog").getByRole("button", { name: "İdxal et" }).click();
  await expect(page.getByText("Tamamlanıb")).toBeVisible({ timeout: 15_000 });
});
