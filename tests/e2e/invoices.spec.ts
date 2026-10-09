import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "muhasib@lexaudit.test") {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("the original document is rendered next to the fields by the real PDF engine", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices/inv-1001");
  await expect(page.getByRole("heading", { level: 1, name: "AF-0457" })).toBeVisible();
  // react-pdf draws the page into a canvas; seeing a non-empty one proves the worker and the file loaded.
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(100);
});

test("fix a wrong total, save, and let the server recalculate", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices/inv-1002");
  await expect(page.getByText(/hesablanmış məbləğdən/)).toBeVisible();

  await page.getByLabel("Vahidin qiyməti").fill("1483,05");
  await page.getByRole("button", { name: "Yadda saxla" }).click();

  await expect(page.getByText("Problem tapılmadı.")).toBeVisible();
  await expect(page.getByText("Yoxlanılıb", { exact: true }).first()).toBeVisible();
  const totals = page.getByRole("heading", { name: "Yekun məbləğlər" }).locator("xpath=ancestor::section");
  await expect(totals).toContainText("1.750,00");
});

test("leaving with unsaved changes asks first", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices/inv-1002");
  await page.getByLabel("Vahidin qiyməti").fill("1");
  await page.getByRole("link", { name: "Qaimələrə qayıt" }).click();
  await expect(page.getByRole("dialog")).toContainText("Dəyişikliklər itəcək");
  await page.getByRole("button", { name: "Ləğv et" }).click();
  await expect(page).toHaveURL(/inv-1002/);
});

test("suggest a journal entry for a valid invoice and send it for approval", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices/inv-1008");
  await page.getByRole("button", { name: "Jurnal yazılışı təklif et" }).click();
  await expect(page.getByText("Balanslıdır")).toBeVisible();
  await page.getByRole("button", { name: "Təsdiqə göndər" }).click();
  await expect(page.getByText("Təsdiq gözləyir")).toBeVisible();
});

test("upload an invoice and watch it get read", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");
  await page
    .getByLabel("Fayl seçin")
    .setInputFiles({ name: "yeni.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText("Yükləndi")).toBeVisible();
  const row = page.getByRole("row", { name: /UP-\d+/ });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Yoxlanılıb|Yoxlama tələb edir/)).toBeVisible({ timeout: 15_000 });
});
