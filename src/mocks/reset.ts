import { setMockRefreshUser } from "./refreshCookie";
import { resetFilesDb } from "./fixtures/files";
import { resetInvoicesDb } from "./fixtures/invoices";
import { resetNewsDb } from "./fixtures/news";
import { resetUploadKeys } from "./handlers/files";
import { resetInvoiceUploadKeys } from "./handlers/invoices";

/** Returns every piece of mock state to its starting point. Call between tests. */
export function resetMocks(): void {
  resetNewsDb();
  resetFilesDb();
  resetUploadKeys();
  resetInvoicesDb();
  resetInvoiceUploadKeys();
  setMockRefreshUser(null);
}
