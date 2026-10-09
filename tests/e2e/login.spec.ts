// page.evaluate() callbacks run in the browser, so this file needs DOM types (the e2e tsconfig is Node-only).
/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

test("anonymous visitor is sent to login, then signs in and sees the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Bu gün", level: 1 })).toBeVisible();
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

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("an accountant who opens the admin page by URL sees a permission-denied state", async ({ page }) => {
  await signIn(page, "muhasib@lexaudit.test");
  await page.goto("/admin"); // full reload: the session is restored from the refresh cookie
  await expect(page.getByText("Bu bölməyə giriş icazəniz yoxdur")).toBeVisible();
});

test("a page reload keeps the user signed in", async ({ page }) => {
  await signIn(page, "muhasib@lexaudit.test");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bu gün", level: 1 })).toBeVisible();
});

test("after signing out, a reload does not bring the session back", async ({ page }) => {
  await signIn(page, "muhasib@lexaudit.test");
  await page.getByRole("button", { name: "Çıxış" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("theme toggle switches to dark mode", async ({ page }) => {
  await signIn(page, "muhasib@lexaudit.test");
  await page.getByRole("button", { name: "Qaranlıq" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Açıq" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("sidebar only lists sections the user can read", async ({ page }) => {
  await signIn(page, "muhasib@lexaudit.test");
  const nav = page.getByRole("navigation", { name: "Əsas naviqasiya" });
  await expect(nav.getByRole("link", { name: "Qaimələr" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Tənzimləmələr" })).toHaveCount(0);
});

test("the layout does not overflow horizontally on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signIn(page, "admin@lexaudit.test");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Çıxış" })).toBeInViewport();
});
