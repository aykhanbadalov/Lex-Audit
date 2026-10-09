import { expect, test } from "@playwright/test";

test("an administrator proposes a tax rate that waits for somebody else's approval", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("admin@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Tənzimləmələr" }).click();
  await page.getByRole("tab", { name: "Vergi dərəcələri" }).click();
  await page.getByRole("button", { name: "Dərəcə təklif et" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kod").fill("AZ_VAT_REDUCED");
  await dialog.getByLabel("Dərəcə (%)").fill("8");
  await dialog.getByLabel("Qüvvəyə minir").fill("2027-01-01");
  await dialog.getByRole("button", { name: "Dərəcə təklif et" }).click();

  const row = page.getByRole("row", { name: /AZ_VAT_REDUCED/ });
  await expect(row).toContainText("Təsdiq gözləyir");
});
