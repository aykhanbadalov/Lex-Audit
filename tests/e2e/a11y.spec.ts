import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/dashboard",
  "/news",
  "/legislation",
  "/files",
  "/invoices",
  "/invoices/inv-1001",
  "/vat",
  "/ledger",
  "/excel",
  "/reconciliation",
  "/integrations",
  "/assistant",
  "/assistant/conv-1",
  "/approvals",
  "/audit-log",
  "/admin",
  "/admin?tab=models",
];

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill("admin@lexaudit.test");
  await page.getByLabel("Şifrə").fill("demo1234");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes
        .map((node) => node.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
}

for (const theme of ["light", "dark"] as const) {
  test(`no accessibility violations on any screen (${theme} theme)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await signInAsAdmin(page);
    const found: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15_000 });
      // Let lists, tables and the PDF finish loading so their markup is checked, not their skeletons.
      await page.waitForLoadState("networkidle");
      for (const issue of await violations(page)) found.push(`${path} - ${issue}`);
    }
    expect(found).toEqual([]);
  });
}
