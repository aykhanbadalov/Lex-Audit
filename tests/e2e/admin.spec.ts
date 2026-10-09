import { expect, test } from "@playwright/test";

test("an administrator proposes a rate change that waits for approval", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("admin@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Tənzimləmələr" }).click();
  await page.getByRole("tab", { name: "Vergi dərəcələri" }).click();
  await page
    .getByRole("row", { name: /ƏDV 18%/ })
    .getByRole("button")
    .click();
  await page.getByLabel("Yeni dərəcə (%)").fill("20");
  await page.getByLabel("Qüvvəyə minib").fill("2027-01-01");
  await page.getByLabel(/Səbəb/).fill("Qanun dəyişdi");
  await page.getByRole("button", { name: "Təsdiqə göndər" }).click();

  await expect(page.getByText(/Təsdiqə göndərildi/)).toBeVisible();
  await expect(page.getByRole("row", { name: /ƏDV 18%/ })).toContainText("18%"); // unchanged until approved
});
