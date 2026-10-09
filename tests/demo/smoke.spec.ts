import { expect, test } from "@playwright/test";

test("the built demo signs in, shows data, survives a reload and opens a deep link", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-poçt").fill("muhasib@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/demo/i).first()).toBeVisible(); // the banner that says this is sample data

  await page.getByRole("link", { name: "Qaimələr" }).click();
  await expect(page.getByRole("row").nth(1)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("row").nth(1)).toBeVisible();

  await page.goto("/legislation");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
