import { setMockRefreshUser } from "./refreshCookie";
import { resetFilesDb } from "./fixtures/files";
import { resetNewsDb } from "./fixtures/news";
import { resetUploadKeys } from "./handlers/files";

/** Returns every piece of mock state to its starting point. Call between tests. */
export function resetMocks(): void {
  resetNewsDb();
  resetFilesDb();
  resetUploadKeys();
  setMockRefreshUser(null);
}
