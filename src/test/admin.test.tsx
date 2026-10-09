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
const approve = (id: string) =>
  api.POST("/approvals/{id}/decide", { params: { path: { id } }, body: { decision: "approved", comment: "yoxlandı" } });

async function lastApprovalId() {
  const list = (await api.GET("/approvals", { params: { query: { status: "pending" } } })).data!.items;
  return list.find((item) => item.requestedBy.name === "Nigar Quliyeva" && !item.id.startsWith("appr-seed"))!.id;
}

describe("users", () => {
  it("cannot change its own access, and offers every other user a role and a switch", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    const own = await rowOf("Nigar Quliyeva");
    expect(within(own).getByRole("combobox")).toBeDisabled();
    expect(within(own).queryByRole("button", { name: "Deaktiv et" })).not.toBeInTheDocument();
    const other = await rowOf("Aygün Məmmədova");
    expect(within(other).getByRole("combobox")).toBeEnabled();
  });

  it("sends a role change for approval: the role stays until someone else approves", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    const row = await rowOf("Aygün Məmmədova");
    await userEvent.selectOptions(within(row).getByRole("combobox"), "chief_accountant");

    expect(await within(await rowOf("Aygün Məmmədova")).findByText("Gözləyir: Baş mühasib")).toBeInTheDocument();
    expect(within(await rowOf("Aygün Məmmədova")).getByRole("combobox")).toHaveValue("accountant");

    signInAs(CHIEF);
    await approve(await lastApprovalId());
    signInAs(ADMIN);
    const users = (await api.GET("/admin/users")).data!;
    expect(users.find((user) => user.name === "Aygün Məmmədova")).toMatchObject({
      role: "chief_accountant",
      pendingRole: null,
    });
  });

  it("asks before deactivating, and the person stays active if the dialog is cancelled", async () => {
    signInAs(ADMIN);
    renderApp("/admin");
    const row = await rowOf("Rəşad Əliyev");
    await userEvent.click(within(row).getByRole("button", { name: "Deaktiv et" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ləğv et" }));
    expect(within(await rowOf("Rəşad Əliyev")).getByText("Aktiv")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Deaktiv et" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Deaktiv et" }));
    await waitFor(async () => expect(within(await rowOf("Rəşad Əliyev")).getByText("Deaktiv")).toBeInTheDocument());
  });

  it("is refused by the server when someone changes their own access, and that attempt is logged", async () => {
    signInAs(ADMIN);
    await expect(
      api.PATCH("/admin/users/{id}", { params: { path: { id: "user-admin" } }, body: { role: "viewer" } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api.PATCH("/admin/users/{id}", { params: { path: { id: "user-admin" } }, body: { active: false } }),
    ).rejects.toMatchObject({ status: 403 });
    const events = (await api.GET("/audit-events", { params: { query: { q: "user.update" } } })).data!.items;
    expect(events[0]).toMatchObject({ outcome: "denied", actor: { id: "user-admin" } });
  });
});

describe("sources", () => {
  it("shows which sources are failing and turns one off", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=sources");
    const failing = (await screen.findByText("DSMF")).closest("li")!;
    expect(failing).toHaveTextContent("Ardıcıl 3 xəta");
    expect(failing).toHaveTextContent("HTTP 503");

    await userEvent.click(within(failing).getByRole("checkbox"));
    await waitFor(() =>
      expect(within(screen.getByText("DSMF").closest("li")!).getByText("Söndürülüb")).toBeInTheDocument(),
    );
  });
});

describe("tax rates", () => {
  async function openChange() {
    signInAs(ADMIN);
    renderApp("/admin?tab=rates");
    const row = await rowOf("ƏDV 18%");
    await userEvent.click(within(row).getByRole("button", { name: "Dəyişiklik təklif et" }));
    return screen.findByRole("dialog");
  }

  it("will not send an invalid rate, a missing date or a missing reason", async () => {
    const dialog = await openChange();
    const send = within(dialog).getByRole("button", { name: "Təsdiqə göndər" });
    expect(send).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Yeni dərəcə (%)"), "150");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("0-dan 100-ə qədər");
    await userEvent.clear(within(dialog).getByLabelText("Yeni dərəcə (%)"));
    await userEvent.type(within(dialog).getByLabelText("Yeni dərəcə (%)"), "20");
    await userEvent.type(within(dialog).getByLabelText("Qüvvəyə minib"), "2027-01-01");
    expect(send).toBeDisabled(); // no reason yet
    await userEvent.type(within(dialog).getByLabelText(/Səbəb/), "Qanun dəyişdi");
    expect(send).toBeEnabled();
  });

  it("changes nothing until a different person approves, then shows the new rate", async () => {
    const dialog = await openChange();
    await userEvent.type(within(dialog).getByLabelText("Yeni dərəcə (%)"), "20");
    await userEvent.type(within(dialog).getByLabelText("Qüvvəyə minib"), "2027-01-01");
    await userEvent.type(within(dialog).getByLabelText(/Səbəb/), "Qanun dəyişdi");
    await userEvent.click(within(dialog).getByRole("button", { name: "Təsdiqə göndər" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const before = (await api.GET("/tax-rates", { params: { query: { type: "VAT" } } })).data!;
    expect(before.find((rate) => rate.code === "AZ_VAT_STANDARD")!.rate).toBe("0.18");

    // The admin who asked cannot approve it; the chief accountant can.
    const id = await lastApprovalId();
    await expect(approve(id)).rejects.toMatchObject({ status: 403 });
    signInAs(CHIEF);
    await approve(id);
    const after = (await api.GET("/tax-rates", { params: { query: { type: "VAT" } } })).data!;
    expect(after.find((rate) => rate.code === "AZ_VAT_STANDARD")!.rate).toBe("0.2");
  });

  it("is validated by the server too", async () => {
    signInAs(ADMIN);
    const propose = (body: { code: string; rate: string; validFrom: string; reason: string }) =>
      api.POST("/admin/tax-rates/changes", { body });
    const ok = { code: "AZ_VAT_STANDARD", rate: "0.2", validFrom: "2027-01-01", reason: "Qanun" };
    await expect(propose({ ...ok, rate: "1.5" })).rejects.toMatchObject({ status: 422 });
    await expect(propose({ ...ok, reason: " " })).rejects.toMatchObject({ status: 422 });
    await expect(propose({ ...ok, code: "NOPE" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("models", () => {
  it("keeps the active model until the release is approved by someone else", async () => {
    signInAs(ADMIN);
    renderApp("/admin?tab=models");
    const v7 = (await screen.findAllByText("v7"))[0]!.closest("li")!;
    expect(v7).toHaveTextContent("Canary");
    expect(v7).toHaveTextContent("Dəqiqlik: 93,4% (əvvəl 91,2%)");
    await userEvent.click(within(v7).getByRole("button", { name: "Buraxılışa göndər" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Təsdiqə göndər" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Səbəb/), "Eval yaxşılaşıb");
    await userEvent.click(within(dialog).getByRole("button", { name: "Təsdiqə göndər" }));

    expect(await screen.findByText("Buraxılış təsdiq gözləyir")).toBeInTheDocument();
    let models = (await api.GET("/admin/models")).data!;
    expect(models.find((model) => model.id === "mdl-ext-6")!.status).toBe("active");

    signInAs(CHIEF);
    await approve(await lastApprovalId());
    signInAs(ADMIN);
    models = (await api.GET("/admin/models")).data!;
    expect(models.find((model) => model.id === "mdl-ext-7")).toMatchObject({ status: "active", pendingChange: null });
    expect(models.find((model) => model.id === "mdl-ext-6")!.status).toBe("retired");
  });

  it("allows only one change at a time and only sensible ones", async () => {
    signInAs(ADMIN);
    const change = (id: string, action: "release" | "rollback") =>
      api.POST("/admin/models/{id}/change", { params: { path: { id } }, body: { action, reason: "sebeb" } });
    await change("mdl-ext-7", "release");
    await expect(change("mdl-ext-7", "release")).rejects.toMatchObject({ status: 409 });
    await expect(change("mdl-cls-3", "release")).rejects.toMatchObject({ status: 422 }); // already active
    await expect(change("mdl-ext-7", "rollback")).rejects.toMatchObject({ status: 409 });
    await expect(change("nope", "release")).rejects.toMatchObject({ status: 404 });
  });

  it("a denied release leaves the model as it was and frees it for a new request", async () => {
    signInAs(ADMIN);
    await api.POST("/admin/models/{id}/change", {
      params: { path: { id: "mdl-ast-13" } },
      body: { action: "release", reason: "sebeb" },
    });
    const id = await lastApprovalId();
    signInAs(CHIEF);
    await api.POST("/approvals/{id}/decide", {
      params: { path: { id } },
      body: { decision: "denied", comment: "zəifdir" },
    });
    signInAs(ADMIN);
    signInAs(ADMIN);
    const model = (await api.GET("/admin/models")).data!.find((item) => item.id === "mdl-ast-13")!;
    expect(model).toMatchObject({ status: "candidate", pendingChange: null });
  });
});

describe("access", () => {
  it("shows permission-denied, and never calls the API, to everyone but an administrator", async () => {
    signInAs(CHIEF);
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/admin");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/admin/"))).toBe(false);
  });

  it("is closed to everyone else in the API too", async () => {
    signInAs(CHIEF);
    await expect(api.GET("/admin/users")).rejects.toMatchObject({ status: 403 });
    await expect(api.GET("/admin/models")).rejects.toMatchObject({ status: 403 });
    await expect(
      api.PATCH("/admin/news-sources/{id}", { params: { path: { id: "src-dsmf" } }, body: { enabled: false } }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
