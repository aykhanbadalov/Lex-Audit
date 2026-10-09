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

test("analyse a spreadsheet and read what each column holds", async ({ page }) => {
  await signIn(page);
  await page.goto("/excel");
  await page.locator("#excel-file-pick").selectOption("file-bank-sep");
  await page.getByRole("button", { name: "Təhlil et" }).click();
  await expect(page.getByRole("rowheader", { name: "Məbləğ" })).toBeVisible({ timeout: 15_000 });
});

test("run a reconciliation and confirm a suggested match", async ({ page }) => {
  await signIn(page);
  await page.goto("/reconciliation");
  await page.locator("#left-type").selectOption("bank");
  await page.locator("#right-type").selectOption("bank");
  await page.getByRole("button", { name: "Uzlaşdır" }).click();
  await page.getByRole("button", { name: "Təsdiq et" }).first().click();
  await expect(page.getByText("Təsdiqlənib").first()).toBeVisible();
});

test("preview an import, then send it for approval: nothing is written before somebody else agrees", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/integrations");
  await page.locator("#import-file").selectOption("file-bank-sep");
  await page.getByRole("button", { name: "Önbaxış" }).click();
  await expect(page.getByText("Hələ heç nə yazılmayıb.")).toBeVisible();
  await page.getByRole("button", { name: "İdxala göndər" }).click();
  await expect(page.getByText(/başqa şəxsin təsdiqini gözləyir/)).toBeVisible();
});
