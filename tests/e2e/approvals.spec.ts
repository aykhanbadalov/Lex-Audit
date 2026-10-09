import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a chief accountant approves a request with a comment, and it shows up in the audit log", async ({ page }) => {
  await signIn(page, "bas.muhasib@lexaudit.test");
  await page.getByRole("link", { name: "Təsdiqlər" }).click();

  const card = page.getByRole("article").filter({ hasText: "Yeni vergi dərəcəsi" });
  await expect(card.getByRole("button", { name: "Təsdiq et" })).toBeDisabled();
  await card.getByLabel(/Şərh/).fill("Qanuna uyğundur");
  await card.getByRole("button", { name: "Təsdiq et" }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("link", { name: "Audit jurnalı" }).click();
  await page.getByRole("searchbox", { name: "Axtarış" }).fill("approval");
  await expect(page.getByRole("row").nth(1)).toContainText("Təsdiq qərarı");
});
