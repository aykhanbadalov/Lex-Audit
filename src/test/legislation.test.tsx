import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, signInAs, setupMockApi } from "./utils";

setupMockApi();

describe("legislation list", () => {
  it("lists documents with type and status", async () => {
    signInAs();
    renderApp("/legislation");

    expect(await screen.findByRole("link", { name: "Vergi Məcəlləsi" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(3);
    expect(screen.getByText("Ləğv edilib")).toBeInTheDocument();
  });

  it("filters by type from the URL", async () => {
    signInAs();
    renderApp("/legislation?type=standard");

    expect(await screen.findByRole("link", { name: "MMUS: Əsas vəsaitlər" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Vergi Məcəlləsi" })).not.toBeInTheDocument();
  });

  it("says 'no results' for a search that matches nothing", async () => {
    signInAs();
    renderApp("/legislation?q=zzzzzz");
    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
  });

  it("is hidden from a user without the permission", async () => {
    signInAs("viewer@lexaudit.test");
    renderApp("/legislation");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
  });
});

describe("legislation detail", () => {
  it("shows the newest version's articles by default", async () => {
    signInAs();
    renderApp("/legislation/leg-tax-code");

    expect(await screen.findByRole("heading", { level: 1, name: "Vergi Məcəlləsi" })).toBeInTheDocument();
    expect(await screen.findByText(/vaxtında təqdim edir/)).toBeInTheDocument();
    // Article 5 only exists in older versions.
    expect(screen.queryByText("Köhnə müddəa", { exact: false })).not.toBeInTheDocument();
  });

  it("switches to an older version", async () => {
    signInAs();
    renderApp("/legislation/leg-tax-code");
    await screen.findByText(/vaxtında təqdim edir/);

    await userEvent.selectOptions(screen.getByLabelText("Versiya"), screen.getByRole("option", { name: /^v2/ }));

    expect(await screen.findByText(/Köhnə müddəa/)).toBeInTheDocument();
  });

  it("compares versions and marks changes with <ins>/<del>, hiding unchanged articles", async () => {
    signInAs();
    const { container } = renderApp("/legislation/leg-tax-code?view=diff");

    await screen.findByRole("heading", { name: /Maddə 2\. Qaimə-fakturalar/ });
    expect(container.querySelector("ins")).toHaveTextContent(/elektron/);
    expect(screen.getAllByText("Dəyişib").length).toBeGreaterThan(0);
    // Article 1 is identical in v2 and v3.
    expect(screen.queryByRole("heading", { name: /Maddə 1\./ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Dəyişməyən maddələri göstər" }));
    expect(await screen.findByRole("heading", { name: /Maddə 1\./ })).toBeInTheDocument();
  });

  it("shows removed articles as removed", async () => {
    signInAs();
    const { router } = renderApp("/legislation/leg-tax-code?view=diff");
    await screen.findByRole("heading", { name: /Maddə 2\./ });

    // v2 -> v3 removes article 5.
    expect(await screen.findByRole("heading", { name: /Maddə 5\./ })).toBeInTheDocument();
    const article = screen.getByRole("heading", { name: /Maddə 5\./ }).closest("li")!;
    expect(within(article).getByText("Çıxarılıb")).toBeInTheDocument();
    expect(article.querySelector("del")).not.toBeNull();
    expect(router.state.location.pathname).toBe("/legislation/leg-tax-code");
  });

  it("explains when the same version is chosen on both sides", async () => {
    signInAs();
    renderApp("/legislation/leg-tax-code?view=diff&from=leg-tax-code-v3&to=leg-tax-code-v3");
    expect(await screen.findByText("Müqayisə üçün fərqli versiyalar seçin.")).toBeInTheDocument();
  });

  it("disables comparison for a document with a single version", async () => {
    signInAs();
    renderApp("/legislation/leg-mmus-fixed-assets");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Versiyaları müqayisə et" })).toBeDisabled());
  });

  it("shows 'not found' for an unknown document", async () => {
    signInAs();
    renderApp("/legislation/does-not-exist");
    expect(await screen.findByText("Sənəd tapılmadı")).toBeInTheDocument();
  });
});

describe("returning to the list", () => {
  it("restores the type filter the user had when they opened the document", async () => {
    signInAs();
    const { router } = renderApp("/legislation?type=standard");
    await userEvent.click(await screen.findByRole("link", { name: "MMUS: Əsas vəsaitlər" }));
    await screen.findByRole("heading", { level: 1, name: "MMUS: Əsas vəsaitlər" });

    await userEvent.click(screen.getByRole("link", { name: "Qanunvericiliyə qayıt" }));

    expect(await screen.findByRole("link", { name: "MMUS: Əsas vəsaitlər" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Vergi Məcəlləsi" })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ type: "standard" });
  });
});
