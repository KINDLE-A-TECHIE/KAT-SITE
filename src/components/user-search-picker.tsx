"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

export type PickerUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

/**
 * Search + load-more picker over /api/users (which pages and accepts ?q=). Debounced search
 * refetches page 1; "Load more" appends the next page. Suited to a picker you scroll and
 * narrow, rather than Prev/Next paging a full list.
 */
export function UserSearchPicker({
  roles,
  selectedId,
  onSelect,
  placeholder = "Search by name or email…",
}: {
  roles: string;
  selectedId: string;
  onSelect: (user: PickerUser) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPage = async (p: number, replace: boolean, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ roles, page: String(p) });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/users?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { users: PickerUser[]; page?: number; hasMore?: boolean };
      setUsers((prev) => (replace ? data.users : [...prev, ...data.users]));
      setPage(data.page ?? p);
      setHasMore(data.hasMore ?? false);
    }
    setLoading(false);
  };

  // Debounced page-1 refetch whenever the query (or role scope) changes.
  useEffect(() => {
    const t = setTimeout(() => void fetchPage(1, true, query), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roles]);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
      <div className="relative border-b border-stone-100 dark:border-stone-800">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="border-0 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading && users.length === 0 ? (
          <div className="px-3 py-5 text-center text-stone-400">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-3 py-5 text-center text-xs text-stone-400">No matches.</div>
        ) : (
          <>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 ${
                  selectedId === u.id ? "bg-orange-50 dark:bg-orange-950/30" : ""
                }`}
              >
                <span className="min-w-0 truncate">
                  <span className="text-stone-900 dark:text-stone-100">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="ml-1.5 text-xs text-stone-400">{u.email}</span>
                </span>
                {selectedId === u.id ? <Check className="size-4 shrink-0 text-orange-600" /> : null}
              </button>
            ))}
            {hasMore ? (
              <button
                type="button"
                onClick={() => void fetchPage(page + 1, false, query)}
                disabled={loading}
                className="w-full px-3 py-2 text-center text-xs font-medium text-orange-600 hover:bg-stone-50 disabled:opacity-60 dark:hover:bg-stone-800"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
