// Clerk keeps `__client_uat` (and a `__client_uat_<suffix>` variant) as a
// readable cookie holding the last sign-in time; "0" means signed out. The
// marketing header reads it instead of loading Clerk's browser SDK. It is a
// hint, not auth: a stale value only shows "Dashboard", and the dashboard
// still runs Clerk's real check.
const CLIENT_UAT_COOKIE = /^__client_uat(?:_[\w-]+)?$/;

export function hasClerkSessionCookie(cookieHeader: string): boolean {
  for (const part of cookieHeader.split(";")) {
    const [name = "", value = ""] = part.trim().split("=");
    if (CLIENT_UAT_COOKIE.test(name) && Number.parseInt(value, 10) > 0) return true;
  }
  return false;
}
