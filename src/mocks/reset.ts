import { setMockRefreshUser } from "./refreshCookie";
import { resetFilesDb } from "./fixtures/files";
import { resetAdmin } from "./handlers/admin";
import { resetApprovals } from "./fixtures/approvals";
import { resetAudit } from "./fixtures/audit";
import { resetAssistant } from "./fixtures/assistant";
import { resetInvoicesDb } from "./fixtures/invoices";
import { resetVat } from "./fixtures/vat";
import { resetVatVersions } from "./handlers/vat";
import { resetWorkUploadKeys } from "./handlers/work";
import { resetImpact, resetNotifications } from "./handlers/impact";
import { resetNewsDb } from "./fixtures/news";
import { resetUploadKeys } from "./handlers/files";
import { resetInvoiceUploadKeys } from "./handlers/invoices";

/** Returns every piece of mock state to its starting point. Call between tests. */
export function resetMocks(): void {
  resetNewsDb();
  resetImpact();
  resetNotifications();
  resetFilesDb();
  resetUploadKeys();
  resetInvoicesDb();
  resetVat();
  resetVatVersions();
  resetAssistant();
  resetApprovals();
  resetAdmin();
  resetAudit();
  resetWorkUploadKeys();
  resetInvoiceUploadKeys();
  setMockRefreshUser(null);
}
