import { expect, test } from "@playwright/test";

const email = process.env.REAL_ADMIN_EMAIL ?? "admin@lexaudit.local";
const password = process.env.REAL_ADMIN_PASSWORD ?? "Dev-Password-12345";

test("signs in against the real backend, survives a reload, and signs out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill(password);
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(email).first()).toBeVisible();

  // A reload loses the access token; the cookie + CSRF flow must bring the session back.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(email).first()).toBeVisible();

  await page.getByRole("button", { name: /Çıxış/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
});

test("rejects a wrong password in words", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page.getByRole("alert")).toHaveText(/yanlışdır|düzgün deyil|səhv/i);
});
