import { describe, expect, it } from "vitest";
import { MAX_NAME_CHARS, profileFromClaims } from "@/lib/auth/profile";

const google = (extra: Record<string, unknown> = {}) => ({
  email: "ada@example.com",
  email_verified: true,
  name: "Ada Lovelace",
  firebase: { sign_in_provider: "google.com" },
  ...extra,
});

describe("profileFromClaims", () => {
  it("builds a profile from a verified Google token", () => {
    expect(profileFromClaims(google())).toEqual({ name: "Ada Lovelace", email: "ada@example.com" });
  });

  it("falls back to the email's local part when Google has no name", () => {
    expect(profileFromClaims(google({ name: undefined }))?.name).toBe("ada");
    expect(profileFromClaims(google({ name: "   " }))?.name).toBe("ada");
  });

  it("caps very long names", () => {
    expect(profileFromClaims(google({ name: "x".repeat(500) }))?.name).toHaveLength(MAX_NAME_CHARS);
  });

  it("rejects tokens from other sign-in methods", () => {
    expect(profileFromClaims(google({ firebase: { sign_in_provider: "password" } }))).toBeNull();
    expect(profileFromClaims(google({ firebase: { sign_in_provider: "anonymous" } }))).toBeNull();
    expect(profileFromClaims(google({ firebase: undefined }))).toBeNull();
  });

  it("rejects missing or unverified email addresses", () => {
    expect(profileFromClaims(google({ email: undefined }))).toBeNull();
    expect(profileFromClaims(google({ email_verified: false }))).toBeNull();
  });
});
