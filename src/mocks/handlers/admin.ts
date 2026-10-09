import { http, HttpResponse } from "msw";
import {
  findAdminUser,
  listAdminSources,
  listAdminUsers,
  listModels,
  requestModelChange,
  requestRateChange,
  requestRoleChange,
  setActive,
  setSourceEnabled,
} from "../fixtures/admin";
import { present } from "../fixtures/approvals";
import { recordAudit } from "../fixtures/audit";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const PERMISSION = "admin:manage";
const ROLES = ["viewer", "accountant", "chief_accountant", "auditor", "admin"];

export const adminHandlers = [
  http.get(apiPath("/admin/users"), ({ request }) => {
    const auth = authorize(request, PERMISSION);
    return "response" in auth ? auth.response : HttpResponse.json(listAdminUsers());
  }),

  http.patch(apiPath("/admin/users/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const id = String(params.id);
    const target = findAdminUser(id);
    if (!target) return apiError(404, "NOT_FOUND", "User not found");
    const body = (await request.json()) as { active?: boolean; role?: string };
    // Nobody may change their own access: that would defeat separation of duties.
    if (id === auth.user.id) {
      recordAudit(auth.user, {
        action: "user.update",
        resourceType: "user",
        resourceId: id,
        resourceLabel: target.name,
        outcome: "denied",
      });
      return apiError(403, "FORBIDDEN", "You cannot change your own access");
    }
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return apiError(422, "VALIDATION_FAILED", "Unknown role");
      const created = requestRoleChange(id, body.role as never, auth.user);
      recordAudit(auth.user, {
        action: "user.role_request",
        resourceType: "user",
        resourceId: id,
        resourceLabel: target.name,
        outcome: "success",
      });
      return HttpResponse.json(present(created, auth.user), { status: 202 });
    }
    if (typeof body.active !== "boolean") return apiError(422, "VALIDATION_FAILED", "Nothing to change");
    setActive(id, body.active);
    recordAudit(auth.user, {
      action: body.active ? "user.activate" : "user.deactivate",
      resourceType: "user",
      resourceId: id,
      resourceLabel: target.name,
      outcome: "success",
    });
    return HttpResponse.json(listAdminUsers().find((user) => user.id === id));
  }),

  http.get(apiPath("/admin/news-sources"), ({ request }) => {
    const auth = authorize(request, PERMISSION);
    return "response" in auth ? auth.response : HttpResponse.json(listAdminSources());
  }),

  http.patch(apiPath("/admin/news-sources/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const id = String(params.id);
    const source = listAdminSources().find((candidate) => candidate.id === id);
    if (!source) return apiError(404, "NOT_FOUND", "Source not found");
    const body = (await request.json()) as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") return apiError(422, "VALIDATION_FAILED", "enabled is required");
    setSourceEnabled(id, body.enabled);
    recordAudit(auth.user, {
      action: "news_source.update",
      resourceType: "news_source",
      resourceId: id,
      resourceLabel: source.name,
      outcome: "success",
    });
    return HttpResponse.json(listAdminSources().find((candidate) => candidate.id === id));
  }),

  http.post(apiPath("/admin/tax-rates/changes"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { code?: string; rate?: string; validFrom?: string; reason?: string };
    const rate = body.rate ?? "";
    if (
      !/^(0(\.\d+)?|1(\.0+)?)$/.test(rate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.validFrom ?? "") ||
      (body.reason?.trim().length ?? 0) < 3
    )
      return apiError(422, "VALIDATION_FAILED", "Invalid rate change");
    const created = requestRateChange(String(body.code), rate, body.validFrom!, body.reason!.trim(), auth.user);
    if (!created) return apiError(404, "NOT_FOUND", "Rate not found");
    recordAudit(auth.user, {
      action: "tax_rate.propose",
      resourceType: "tax_rate",
      resourceId: String(body.code),
      resourceLabel: created.title,
      outcome: "success",
    });
    return HttpResponse.json(present(created, auth.user), { status: 202 });
  }),

  http.get(apiPath("/admin/models"), ({ request }) => {
    const auth = authorize(request, PERMISSION);
    return "response" in auth ? auth.response : HttpResponse.json(listModels());
  }),

  http.post(apiPath("/admin/models/:id/change"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { action?: string; reason?: string };
    if ((body.action !== "release" && body.action !== "rollback") || (body.reason?.trim().length ?? 0) < 3)
      return apiError(422, "VALIDATION_FAILED", "Invalid model change");
    const result = requestModelChange(String(params.id), body.action, body.reason!.trim(), auth.user);
    if ("error" in result) {
      return result.error === "not-found"
        ? apiError(404, "NOT_FOUND", "Model not found")
        : result.error === "conflict"
          ? apiError(409, "CONFLICT", "A change is already waiting for approval")
          : apiError(422, "VALIDATION_FAILED", "This version cannot be changed that way");
    }
    recordAudit(auth.user, {
      action: "model.change_request",
      resourceType: "model",
      resourceId: String(params.id),
      resourceLabel: result.approval.title,
      outcome: "success",
    });
    return HttpResponse.json(present(result.approval, auth.user), { status: 202 });
  }),
];
