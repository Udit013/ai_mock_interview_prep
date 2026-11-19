/**
 * Profile fields for an account created through a sign-in provider (Google).
 *
 * Plain module, not "use server": it's pure logic, unit-tested, and must not
 * become a public endpoint. Input is a *verified* ID token's claims.
 */

export const MAX_NAME_CHARS = 100;

interface ProviderClaims {
  email?: string;
  email_verified?: boolean;
  name?: unknown;
  firebase?: { sign_in_provider?: string };
}

/** The sign-in methods this flow accepts. Email/password has its own flow. */
const PROVIDERS = new Set(["google.com"]);

export function profileFromClaims(
  claims: ProviderClaims
): { name: string; email: string } | null {
  if (!PROVIDERS.has(claims.firebase?.sign_in_provider ?? "")) return null;
  const email = claims.email?.trim();
  // Google always verifies the address it returns; refuse anything else.
  if (!email || claims.email_verified !== true) return null;

  const fromToken = typeof claims.name === "string" ? claims.name.trim() : "";
  // No display name on the Google account: fall back to the address's local part.
  const name = (fromToken || email.split("@")[0]).slice(0, MAX_NAME_CHARS);
  return { name, email };
}
