import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const VALID_VIEWS = [
  "list",
  "kanban",
  "calendar",
  "focus",
  "stats",
] as const;
export type TaskViewMode = (typeof VALID_VIEWS)[number];

export const VALID_SMART = [
  "all",
  "today",
  "upcoming",
  "overdue",
  "mine",
  "partner",
  "shared",
  "nodate",
  "done",
] as const;

export const VALID_SCOPES = ["all", "personal", "shared", "mine"] as const;
export const VALID_SORTS = [
  "manual",
  "deadline",
  "priority",
  "newest",
  "oldest",
] as const;
export const VALID_GROUPS = [
  "deadline",
  "list",
  "priority",
  "assignee",
] as const;

export function useTaskFilters() {
  const [params, setParams] = useSearchParams();

  const cid = params.get("coupleId") ?? "";

  // Sanitize query params with fallback defaults
  const rawView = params.get("view") ?? "list";
  const view: TaskViewMode = VALID_VIEWS.includes(rawView as TaskViewMode)
    ? (rawView as TaskViewMode)
    : "list";

  const rawSmart = params.get("smart") ?? "all";
  const smart = VALID_SMART.includes(rawSmart as (typeof VALID_SMART)[number])
    ? rawSmart
    : "all";

  const rawScope = params.get("scope") ?? "all";
  const scope = VALID_SCOPES.includes(rawScope as (typeof VALID_SCOPES)[number])
    ? rawScope
    : "all";

  const rawSort = params.get("sort") ?? "deadline";
  const sort = VALID_SORTS.includes(rawSort as (typeof VALID_SORTS)[number])
    ? rawSort
    : "deadline";

  const rawGroup = params.get("group") ?? "deadline";
  const groupBy = VALID_GROUPS.includes(
    rawGroup as (typeof VALID_GROUPS)[number],
  )
    ? rawGroup
    : "deadline";

  const rawKind = params.get("kind") ?? "";
  const kind = ["task", "shopping"].includes(rawKind) ? rawKind : "";

  const rawStatus = params.get("status") ?? "";
  const status = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"].includes(
    rawStatus,
  )
    ? rawStatus
    : "";

  const rawPriority = params.get("priority") ?? "";
  const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(rawPriority)
    ? rawPriority
    : "";

  const search = params.get("search") ?? "";
  const due = params.get("due") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const label = params.get("label") ?? "";
  const listId = params.get("list") ?? "";
  const archivedLists = params.get("archivedLists") === "1";

  function update(name: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  }

  const setScope = (v: string) => update("scope", v);
  const setStatus = (v: string) => update("status", v);
  const setPriority = (v: string) => update("priority", v);
  const setSearch = (v: string) => update("search", v);
  const setDue = (v: string) => update("due", v);
  const setFrom = (v: string) => update("from", v);
  const setTo = (v: string) => update("to", v);
  const setSort = (v: string) => update("sort", v);
  const setKind = (v: string) => update("kind", v);
  const setLabel = (v: string) => update("label", v);
  const setView = (v: string) => update("view", v);
  const setGroupBy = (v: string) => update("group", v);
  const setSmart = (v: string) => update("smart", v);
  const setListId = (v: string) => update("list", v);

  const activeFilterCount = [
    Boolean(scope && scope !== "all"),
    Boolean(status),
    Boolean(priority),
    Boolean(due),
    Boolean(from),
    Boolean(to),
    Boolean(label),
    Boolean(sort && sort !== "deadline"),
    Boolean(search),
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of [
          "scope",
          "status",
          "priority",
          "due",
          "from",
          "to",
          "label",
          "search",
          "sort",
        ]) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [
    scope,
    status,
    priority,
    search,
    due,
    from,
    to,
    sort,
    kind,
    label,
    cid,
    smart,
    listId,
  ]);

  const context = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    if (cid) result.coupleId = cid;
    return result;
  }, [cid]);

  const queryFilters = useMemo(
    () => ({
      scope,
      ...(smart !== "all" ? { smart } : {}),
      ...(listId ? { list: listId } : {}),
      status,
      priority,
      search: debouncedSearch,
      due,
      from,
      to,
      sort,
      kind,
      label,
      ...context,
    }),
    [
      scope,
      smart,
      listId,
      status,
      priority,
      debouncedSearch,
      due,
      from,
      to,
      sort,
      kind,
      label,
      context,
    ],
  );

  const selectSmart = (value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("smart", value);
        for (const k of ["list", "scope", "status", "due", "kind"])
          next.delete(k);
        return next;
      },
      { replace: true },
    );
  };

  const selectList = (id: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("list", id);
        for (const k of ["smart", "scope", "status", "due", "kind"])
          next.delete(k);
        return next;
      },
      { replace: true },
    );
  };

  const toggleShopping = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (kind === "shopping") next.delete("kind");
        else next.set("kind", "shopping");
        next.set("scope", "shared");
        next.delete("smart");
        next.delete("list");
        return next;
      },
      { replace: true },
    );
  };

  const selectTemplateList = (id: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("list", id);
        next.set("view", "list");
        next.delete("smart");
        return next;
      },
      { replace: true },
    );
  };

  return {
    params,
    setParams,
    cid,
    view,
    smart,
    scope,
    status,
    priority,
    search,
    debouncedSearch,
    due,
    from,
    to,
    sort,
    kind,
    label,
    listId,
    groupBy,
    archivedLists,
    activeFilterCount,
    clearAllFilters,
    update,
    setScope,
    setStatus,
    setPriority,
    setSearch,
    setDue,
    setFrom,
    setTo,
    setSort,
    setKind,
    setLabel,
    setView,
    setGroupBy,
    setSmart,
    setListId,
    selectSmart,
    selectList,
    toggleShopping,
    selectTemplateList,
    page,
    setPage,
    context,
    queryFilters,
  };
}
