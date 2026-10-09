// In the real system the refresh token is an HttpOnly cookie the browser stores. A mocked response cannot set one,
// so the mock layer remembers "who is signed in" here instead. This is test infrastructure only.
/* eslint-disable no-restricted-globals */
const KEY = "lexaudit.mock.refresh";

export function setMockRefreshUser(email: string | null): void {
  try {
    if (email) sessionStorage.setItem(KEY, email);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: refresh simply will not survive a reload in the mock.
  }
}

export function getMockRefreshUser(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
