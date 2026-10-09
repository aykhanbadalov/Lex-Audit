import { expect, test, type Page } from "@playwright/test";

const email = process.env.REAL_ADMIN_EMAIL ?? "admin@demo.lexaudit.local";
const password = process.env.REAL_ADMIN_PASSWORD ?? "Demo-Passw0rd-2026";

const PAGES = [
  "/dashboard",
  "/news",
  "/legislation",
  "/files",
  "/invoices",
  "/vat",
  "/vat?tab=rates",
  "/ledger",
  "/ledger/accounts",
  "/excel",
  "/reconciliation",
  "/integrations",
  "/assistant",
  "/approvals",
  "/audit-log",
  "/admin",
  "/admin?tab=roles",
  "/admin?tab=sources",
  "/admin?tab=rates",
  "/admin?tab=models",
];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə").fill(password);
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("every screen loads from the real backend without a failed request or an error state", async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    // The first request of a signed-out visit asks for a CSRF token and is refused: that is how the app learns it is signed out.
    if (url.pathname.startsWith("/api/") && response.status() >= 400 && !url.pathname.endsWith("/auth/csrf"))
      failures.push(`${response.status()} ${url.pathname}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror ${error.message}`));

  await signIn(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    // A screen that shows its own error state has a retry button.
    await expect(page.getByRole("button", { name: /Yenidən cəhd/ }), `${path} shows an error state`).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});

test("opens real data: an invoice with its lines, the VAT summary, and the assistant streams its steps and answer", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page);

  await page.goto("/invoices");
  const first = page.getByRole("row").nth(1).getByRole("link").first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Cəmi")).toHaveValue(/^\d+\.\d{2}$/);
  await expect(page.getByRole("heading", { name: "Problemlər" })).toBeVisible();
  await page.getByRole("button", { name: "Yenidən yoxla" }).click();
  await expect(page.getByRole("heading", { name: "Problemlər" })).toBeVisible();

  await page.goto("/vat");
  await expect(page.getByText("Hesablanmış ƏDV")).toBeVisible({ timeout: 15_000 });

  await page.goto("/assistant");
  await page.getByLabel("Mesajınız").fill("ƏDV nədir?");
  await page.getByLabel("Mesajınız").press("Enter");
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}/);
  // The real backend streams its steps. With the test model behind it, it uses the search tool and says it found no source.
  await expect(page.getByText("Qanunvericilikdə axtarış")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("log").getByText(/mənbə tapılmadı/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Cavab faydalı oldu" })).toBeVisible();
});
