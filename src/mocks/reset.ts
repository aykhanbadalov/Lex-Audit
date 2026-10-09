import { setMockRefreshUser } from "./refreshCookie";
import { resetNewsDb } from "./fixtures/news";

/** Returns every piece of mock state to its starting point. Call between tests. */
export function resetMocks(): void {
  resetNewsDb();
  setMockRefreshUser(null);
}
