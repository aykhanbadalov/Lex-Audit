import { expect, test } from "@playwright/test";

test("anonymous visitor is sent to login, then signs in and sees the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Bu gün" })).toBeVisible();
});

test("wrong password keeps the user on the login page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("wrong");
  await page.getByRole("button", { name: "Daxil ol" }).click();

  await expect(page.getByText("E-poçt və ya şifrə yanlışdır.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("language switcher changes the UI language", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("combobox").selectOption("en");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
