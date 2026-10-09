import { expect, test, type Page } from "@playwright/test";

const password = process.env.REAL_DEMO_PASSWORD ?? "Demo-Passw0rd-2026";

async function signIn(page: Page, who: string) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(`${who}@demo.lexaudit.local`);
  await page.getByLabel("Şifrə").fill(password);
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("an accountant corrects an invoice; a checked invoice becomes a journal entry that only another person can post", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, "accountant");

  // Correct a line of an invoice that is not posted yet: it is saved and checked again.
  await page.goto("/invoices?status=needs_review");
  const draft = page.getByRole("row").nth(1).getByRole("link").first();
  await expect(draft).toBeVisible({ timeout: 15_000 });
  await draft.click();
  const description = page.getByLabel("Təsvir").first();
  await description.fill("Düzəliş edilmiş təsvir");
  await page.getByRole("button", { name: "Yadda saxla" }).click();
  await expect(page.getByText("Qaimə yadda saxlanıldı")).toBeVisible({ timeout: 15_000 });

  // A validated invoice can be turned into a proposed entry, which then waits for approval.
  await page.goto("/invoices?status=validated");
  const checked = page.getByRole("row").nth(1).getByRole("link").first();
  await expect(checked).toBeVisible({ timeout: 15_000 });
  await checked.click();
  await page.getByRole("button", { name: "Jurnal yazılışı təklif et" }).click();
  await expect(page.getByText("Balanslıdır")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Jurnalda aç" }).click();
  await page.getByRole("button", { name: "Təsdiqə göndər" }).click();
  await expect(page.getByText(/təsdiqini gözləyir/)).toBeVisible({ timeout: 15_000 });

  // The accountant cannot decide it; the approver can, with a comment.
  await page.getByRole("button", { name: /Çıxış/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, "approver");
  await page.goto("/approvals");
  const card = page.getByRole("article").filter({ hasText: "Jurnal yazılışı" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByLabel(/Şərh/).fill("Yoxlandı, uyğundur");
  await card.getByRole("button", { name: "Təsdiq et" }).click();
  await expect(page.getByText("Qərar saxlanıldı")).toBeVisible({ timeout: 15_000 });
});
