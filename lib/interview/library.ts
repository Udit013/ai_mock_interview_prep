/**
 * Organising a user's own interviews: collections (one per interview, like a
 * folder), archiving, and the dashboard filters over them.
 *
 * Pure and dependency-free so the rules are unit-testable.
 */

export const MAX_COLLECTION_CHARS = 40;

/** Trim, collapse spaces, keep only name-like characters. null = no collection. */
export function normalizeCollectionName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N} &.,'()+#/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COLLECTION_CHARS)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

interface Organisable {
  archived?: boolean;
  collection?: string;
  deleted?: boolean;
}

export interface CollectionSummary {
  name: string;
  count: number;
}

/**
 * The user's collections with how many active (non-archived) interviews each
 * holds, alphabetically. Names are compared case-insensitively so "Stripe" and
 * "stripe" are one collection; the first spelling seen is kept.
 */
export function summarizeCollections(items: Organisable[]): CollectionSummary[] {
  const byKey = new Map<string, CollectionSummary>();
  for (const item of items) {
    if (item.deleted || item.archived || !item.collection) continue;
    const key = item.collection.toLowerCase();
    const entry = byKey.get(key) ?? { name: item.collection, count: 0 };
    entry.count += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type LibraryView =
  | { kind: "all" }
  | { kind: "archived" }
  | { kind: "collection"; name: string };

/** Read the dashboard filter from URL search params. */
export function parseLibraryView(params: {
  view?: string | string[];
  collection?: string | string[];
}): LibraryView {
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  if (first(params.view) === "archived") return { kind: "archived" };
  const name = normalizeCollectionName(first(params.collection));
  return name ? { kind: "collection", name } : { kind: "all" };
}

/** Apply a view. Deleted interviews never show; archived only in "archived". */
export function filterLibrary<T extends Organisable>(items: T[], view: LibraryView): T[] {
  return items.filter((item) => {
    if (item.deleted) return false;
    if (view.kind === "archived") return Boolean(item.archived);
    if (item.archived) return false;
    if (view.kind === "collection") {
      return item.collection?.toLowerCase() === view.name.toLowerCase();
    }
    return true;
  });
}

/** How many archived interviews exist, for the "Archived" chip. */
export function countArchived(items: Organisable[]): number {
  return items.filter((i) => !i.deleted && i.archived).length;
}
