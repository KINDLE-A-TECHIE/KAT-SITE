/**
 * ONE cursor-pagination convention for the whole app.
 *
 * Opaque cursor = the id of the last row seen. Cursors are stable under insertion (unlike
 * numeric offsets, which shift when a row is added) and avoid the O(offset) scan that
 * `skip`/`take` causes at large offsets. We fetch `take: limit + 1` so a single query tells
 * us whether a next page exists, without a second COUNT.
 *
 * Every list endpoint over a table that grows without a natural ceiling must page with this,
 * so no query can ever return an unbounded number of rows.
 */

export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 200;

export type Paging = { limit: number; cursor: string | null };

/** Read `?limit=&cursor=` off a request. limit is clamped to [1, PAGE_MAX], default PAGE_DEFAULT. */
export function readPaging(request: Request): Paging {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), PAGE_MAX) : PAGE_DEFAULT;
  return { limit, cursor: url.searchParams.get("cursor") };
}

/**
 * Prisma args for one cursor page. Spread into a findMany:
 *   prisma.x.findMany({ where, orderBy, ...pageArgs(paging) })
 * NB: cursor-on-id assumes the query's orderBy is id-compatible (the app's default, ids are
 * time-ordered cuids ordered alongside createdAt). Keep orderBy stable across pages.
 */
export function pageArgs({ limit, cursor }: Paging) {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

/**
 * Split the `limit + 1` rows fetched with pageArgs into the page itself plus the next cursor.
 * Pass `getId` for models whose cursor field is not literally `id`.
 */
export function pageResult<T>(
  rows: T[],
  limit: number,
  getId: (row: T) => string = (row) => (row as { id: string }).id,
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? getId(items[items.length - 1]) : null;
  return { items, nextCursor, hasMore };
}

// ── Offset pagination ──────────────────────────────────────────────────────────
//
// Page numbers, correct for ANY orderBy (cursor-on-id is only correct when the query
// orders by id). Costs an O(offset) scan at large page numbers and a COUNT, both fine for
// admin lists where nobody pages to page 500. Prefer cursor pagination for high-volume feeds.

export type PageOffset = { limit: number; page: number; skip: number };

/** Read `?page=&limit=`. limit clamped to [1, PAGE_MAX] (default PAGE_DEFAULT), page >= 1. */
export function readPageOffset(request: Request): PageOffset {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), PAGE_MAX) : PAGE_DEFAULT;
  const rawPage = Number(url.searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { limit, page, skip: (page - 1) * limit };
}

/** Pagination metadata to spread alongside the items in a response. */
export function pageMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}
