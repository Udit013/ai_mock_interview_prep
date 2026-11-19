/**
 * Bounded JSON body reading for API routes.
 *
 * Zod 3 keeps validating every element of an array even after the array has
 * failed its `.max()` check, collecting one issue object per bad element
 * (GHSA-mrhx-c7xc-m3w5; fixed only in Zod 4). A signed-in caller could send a
 * multi-megabyte array of junk to make the function allocate millions of
 * issues. Capping the raw size and rejecting oversized arrays *before* Zod
 * sees the payload removes that path without a major upgrade.
 */

export const MAX_ARRAY_ITEMS = 500;
const MAX_DEPTH = 20;

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

/** True when any array in the value is longer than `limit`, or nesting is absurd. */
export function hasOversizedArray(value: unknown, limit = MAX_ARRAY_ITEMS, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) {
    if (value.length > limit) return true;
    return value.some((v) => hasOversizedArray(v, limit, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => hasOversizedArray(v, limit, depth + 1));
  }
  return false;
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }
  // Length in UTF-16 units is a close-enough proxy and avoids re-encoding.
  if (text.length > maxBytes) return { ok: false, status: 413 };

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, status: 400 };
  }
  if (hasOversizedArray(value)) return { ok: false, status: 413 };
  return { ok: true, value };
}
