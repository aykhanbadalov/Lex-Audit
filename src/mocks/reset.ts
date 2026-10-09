import { setMockRefreshUser } from "./refreshCookie";
import { resetFilesDb } from "./fixtures/files";
import { resetAdmin } from "./fixtures/admin";
import { resetApprovals } from "./fixtures/approvals";
import { resetAudit } from "./fixtures/audit";
import { resetAssistant } from "./fixtures/assistant";
import { resetExcel } from "./fixtures/excel";
import { resetImports } from "./fixtures/imports";
import { resetInvoicesDb } from "./fixtures/invoices";
import { resetReconciliation } from "./fixtures/reconciliation";
import { resetVat } from "./fixtures/vat";
import { resetVatVersions } from "./handlers/vat";
import { resetWorkUploadKeys } from "./handlers/work";
import { resetImpact } from "./handlers/impact";
import { resetNewsDb } from "./fixtures/news";
import { resetUploadKeys } from "./handlers/files";
import { resetInvoiceUploadKeys } from "./handlers/invoices";

/** Returns every piece of mock state to its starting point. Call between tests. */
export function resetMocks(): void {
  resetNewsDb();
  resetImpact();
  resetFilesDb();
  resetUploadKeys();
  resetInvoicesDb();
  resetVat();
  resetVatVersions();
  resetAssistant();
  resetApprovals();
  resetAdmin();
  resetAudit();
  resetExcel();
  resetReconciliation();
  resetImports();
  resetWorkUploadKeys();
  resetInvoiceUploadKeys();
  setMockRefreshUser(null);
}
