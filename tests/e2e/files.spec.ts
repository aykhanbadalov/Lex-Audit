import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "muhasib@lexaudit.test") {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("upload a file and watch it become ready", async ({ page }) => {
  await signIn(page);
  await page.goto("/files");
  await expect(page.getByRole("row")).not.toHaveCount(1);

  await page.getByLabel("Fayl seçin").setInputFiles({
    name: "e2e-qaimə.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 demo"),
  });

  await expect(page.getByText("Yükləndi")).toBeVisible();
  const row = page.getByRole("row", { name: /e2e-qaimə\.pdf/ });
  await expect(row).toBeVisible();
  // Processing takes a few seconds in the dev mock; the page updates itself.
  await expect(row.getByText("Hazırdır")).toBeVisible({ timeout: 15_000 });
});

test("an unsupported file is refused in the browser, before upload", async ({ page }) => {
  await signIn(page);
  await page.goto("/files");
  await page
    .getByLabel("Fayl seçin")
    .setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await expect(page.getByText("Bu fayl növü dəstəklənmir")).toBeVisible();
});

test("download saves the file under its own name", async ({ page }) => {
  await signIn(page);
  await page.goto("/files/file-contract-alfa");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Yüklə" }).click();
  expect((await downloading).suggestedFilename()).toBe("Müqavilə - Alfa MMC.pdf");
});

test("a reader sees files but no upload area", async ({ page }) => {
  await signIn(page, "auditor@lexaudit.test");
  await page.goto("/files");
  await expect(page.getByRole("row")).not.toHaveCount(1);
  await expect(page.getByLabel("Fayl seçin")).toHaveCount(0);
});
