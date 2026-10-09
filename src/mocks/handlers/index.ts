import { adminHandlers } from "./admin";
import { approvalsHandlers } from "./approvals";
import { assistantHandlers } from "./assistant";
import { authHandlers } from "./auth";
import { filesHandlers } from "./files";
import { invoicesHandlers } from "./invoices";
import { legislationHandlers } from "./legislation";
import { newsHandlers } from "./news";
import { vatHandlers } from "./vat";
import { workHandlers } from "./work";

// Order matters: "/news/sources" must be matched before "/news/:id".
export const handlers = [
  ...authHandlers,
  ...newsHandlers,
  ...legislationHandlers,
  ...filesHandlers,
  ...invoicesHandlers,
  ...vatHandlers,
  ...workHandlers,
  ...assistantHandlers,
  ...approvalsHandlers,
  ...adminHandlers,
];
