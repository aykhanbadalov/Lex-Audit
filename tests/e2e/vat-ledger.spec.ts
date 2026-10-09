import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("the VAT screen survives a reload, and keeps its period and tab in the URL", async ({ page }) => {
  await signIn(page);
  await page.goto("/vat?period=2026-09&tab=deposit");
  await expect(page.getByText("Depozit hesabı qalığı")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Dövr")).toHaveValue("2026-09");
  await expect(page.getByRole("tab", { name: "Depozit hesabı" })).toHaveAttribute("aria-selected", "true");
});

test("tabs can be driven from the keyboard", async ({ page }) => {
  await signIn(page);
  await page.goto("/vat?period=2026-09");
  await page.getByRole("tab", { name: "Xülasə" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Depozit hesabı" })).toBeFocused();
  await expect(page).toHaveURL(/tab=deposit/);
});

test("the chart of accounts is its own page, not mistaken for a journal entry", async ({ page }) => {
  await signIn(page);
  await page.goto("/ledger/accounts");
  await expect(page.getByRole("heading", { name: "Aktivlər" })).toBeVisible();
  await page.getByRole("link", { name: "Yazılışlar" }).click();
  await expect(page.getByText("Ofis icarəsi — oktyabr")).toBeVisible();
});

test("drilling down from the VAT summary lands on that period's invoices of that direction", async ({ page }) => {
  await signIn(page);
  await page.goto("/vat?period=2026-09");
  await page
    .getByRole("link", { name: /Qaimələr: \d+/ })
    .first()
    .click();
  await expect(page).toHaveURL(/from=2026-09-01/);
  await expect(page).toHaveURL(/direction=/);
  await expect(page.getByRole("row").nth(1)).toBeVisible();
});
