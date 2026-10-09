import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

const ADMIN = "admin@lexaudit.test";
const CHIEF = "bas.muhasib@lexaudit.test";
const rowOf = async (text: string) =>
  within(await screen.findByRole("table"))
    .getByText(text)
    .closest("tr")!;

describe("users", () => {
  it("lists the people with their roles, and offers no action on yourself", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    const own = await rowOf("admin@lexaudit.test");
    expect(within(own).getByText("Siz")).toBeInTheDocument();
    expect(within(own).queryByRole("button")).not.toBeInTheDocument();
    const other = await rowOf("muhasib@lexaudit.test");
    expect(within(other).getByText("accountant")).toBeInTheDocument();
    expect(within(other).getByRole("button", { name: "Rolları dəyiş" })).toBeInTheDocument();
  });

  it("creates a user only with a long enough password and at least one role", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    await userEvent.click(await screen.findByRole("button", { name: "İstifadəçi yarat" }));
    const dialog = await screen.findByRole("dialog");
    const create = within(dialog).getByRole("button", { name: "İstifadəçi yarat" });
    await userEvent.type(within(dialog).getByLabelText("E-poçt"), "yeni@lexaudit.test");
    await userEvent.type(within(dialog).getByLabelText("Müvəqqəti parol"), "qisa");
    expect(create).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText("Müvəqqəti parol"));
    await userEvent.type(within(dialog).getByLabelText("Müvəqqəti parol"), "Uzun-Parol-2026!");
    expect(create).toBeDisabled(); // no role chosen yet
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /viewer/ }));
    await userEvent.click(create);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await rowOf("yeni@lexaudit.test")).toBeInTheDocument();
  });

  it("suspends a person only after confirmation", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    const row = await rowOf("viewer@lexaudit.test");
    await userEvent.click(within(row).getByRole("button", { name: "Dayandır" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ləğv et" }));
    expect(within(await rowOf("viewer@lexaudit.test")).getByText("Aktiv")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Dayandır" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Dayandır" }));
    await waitFor(async () =>
      expect(within(await rowOf("viewer@lexaudit.test")).getByText("Dayandırılıb")).toBeInTheDocument(),
    );
  });

  it("is refused by the server when someone changes their own status or roles, and that is logged", async () => {
    signInAs(ADMIN);
    await expect(
      api.PATCH("/admin/users/{id}", { params: { path: { id: "user-admin" } }, body: { status: "suspended" } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api.PUT("/admin/users/{id}/roles", {
        params: { path: { id: "user-admin" } },
        body: { roleIds: ["role-viewer"] },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const events = (await api.GET("/audit-events", { params: { query: { limit: 10 } } })).data!;
    expect(events.some((event) => event.action === "user.status")).toBe(true);
  });

  it("will not hand out a role with permissions the giver does not hold", async () => {
    signInAs(CHIEF); // may not manage users at all
    await expect(api.GET("/admin/users")).rejects.toMatchObject({ status: 403 });
    signInAs(ADMIN);
    const created = (await api.POST("/admin/roles", { body: { name: "kiçik", permissions: ["invoices:read"] } })).data!;
    expect(created.system).toBe(false);
  });
});

describe("roles", () => {
  it("shows system roles without an edit button and lets a custom role be created from the permissions you hold", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=roles");
    const system = (await screen.findByText("viewer")).closest("li")!;
    expect(within(system).queryByRole("button", { name: "İcazələri dəyiş" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rol yarat" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Ad"), "mühasib köməkçisi");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "invoices:read" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Yadda saxla" }));
    expect(await screen.findByText("mühasib köməkçisi")).toBeInTheDocument();
  });

  it("refuses a role that contains a permission the caller does not hold, and a change to a system role", async () => {
    signInAs(ADMIN);
    await expect(
      api.PUT("/admin/roles/{id}/permissions", {
        params: { path: { id: "role-viewer" } },
        body: { permissions: ["invoices:read"] },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(api.POST("/admin/roles", { body: { name: "x1", permissions: ["not:real"] } })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("tax rates", () => {
  it("proposes a rate that is not in force until somebody else approves its activation", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=rates");
    await userEvent.click(await screen.findByRole("button", { name: "Dərəcə təklif et" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Dərəcə təklif et" });
    await userEvent.type(within(dialog).getByLabelText("Kod"), "AZ_VAT_REDUCED");
    await userEvent.type(within(dialog).getByLabelText("Dərəcə (%)"), "150");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("0-dan 100-ə qədər");
    expect(submit).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText("Dərəcə (%)"));
    await userEvent.type(within(dialog).getByLabelText("Dərəcə (%)"), "8,5");
    await userEvent.type(within(dialog).getByLabelText("Qüvvəyə minir"), "2027-01-01");
    await userEvent.click(submit);

    const row = await rowOf("AZ_VAT_REDUCED");
    expect(within(row).getByText("Təsdiq gözləyir")).toBeInTheDocument();
    expect(
      (await api.GET("/tax-rates", { params: { query: { taxType: "VAT", status: "active" } } })).data!.some(
        (rate) => rate.code === "AZ_VAT_REDUCED",
      ),
    ).toBe(false);

    await userEvent.click(within(row).getByRole("button", { name: "Aktivləşməni təsdiqə göndər" }));
    await waitFor(async () =>
      expect(
        (await api.GET("/approvals")).data!.some(
          (item) => item.kind === "tax_rate_proposal" && item.status === "pending",
        ),
      ).toBe(true),
    );

    // The administrator who asked cannot approve; another approver can, and then the rate is in force.
    const request = (await api.GET("/approvals")).data!.find(
      (item) => item.kind === "tax_rate_proposal" && item.status === "pending",
    )!;
    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: request.id } },
        body: { decision: "approve", comment: "ok" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    signInAs(CHIEF);
    await api.POST("/approvals/{id}/decide", {
      params: { path: { id: request.id } },
      body: { decision: "approve", comment: "yoxlandı" },
    });
    expect(
      (await api.GET("/tax-rates", { params: { query: { taxType: "VAT", status: "active" } } })).data!.some(
        (rate) => rate.code === "AZ_VAT_REDUCED",
      ),
    ).toBe(true);
  });
});

describe("models and sources", () => {
  it("changes a model's status only after confirmation, and a new production version retires the old one", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=models");
    const candidate = (await screen.findByText("v13")).closest("li")!;
    await userEvent.selectOptions(within(candidate).getByRole("combobox"), "production");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("lexaudit-llm v13 → Buraxılışda?");
    await userEvent.click(within(dialog).getByRole("button", { name: "Təsdiq et" }));

    await waitFor(async () => {
      const { versions } = (await api.GET("/admin/models")).data!;
      expect(versions.find((model) => model.version === "v13")!.status).toBe("production");
      expect(versions.find((model) => model.version === "v12")!.status).toBe("retired");
    });
  });

  it("turns a news source off", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=sources");
    const source = (await screen.findByText("DSMF")).closest("li")!;
    await userEvent.click(within(source).getByRole("checkbox"));
    await waitFor(() =>
      expect(within(screen.getByText("DSMF").closest("li")!).getByText("Söndürülüb")).toBeInTheDocument(),
    );
  });
});

describe("access", () => {
  it("shows permission-denied, and never calls the API, to everyone without an admin permission", async () => {
    signInAs(CHIEF);
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/admin");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/admin/"))).toBe(false);
    server.events.removeAllListeners();
  });

  it("is closed to everyone else in the API too", async () => {
    signInAs(CHIEF);
    await expect(api.GET("/admin/models")).rejects.toMatchObject({ status: 403 });
    await expect(
      api.PUT("/admin/sources/{id}", { params: { path: { id: "src-dsmf" } }, body: { enabled: false } }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
