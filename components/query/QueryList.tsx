"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { QueryCard } from "./QueryCard";
import { QueryDetailPanel } from "./QueryDetailPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { CustomerQuery, AppUser, QueryStatus } from "@/lib/types";

interface QueryListProps {
  queries: CustomerQuery[];
  currentUser: AppUser;
  onQueryUpdated?: (updated: CustomerQuery) => void;
  showAssignment?: boolean; // whether admin can assign managers
  managers?: { uid: string; name: string }[]; // for admin assignment
}

const STATUS_TABS: { value: "ALL" | QueryStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export function QueryList({
  queries: initialQueries,
  currentUser,
  onQueryUpdated,
}: QueryListProps) {
  const [queries, setQueries] = useState<CustomerQuery[]>(initialQueries);
  const [activeStatus, setActiveStatus] = useState<"ALL" | QueryStatus>("ALL");
  const [search, setSearch] = useState("");
  const [selectedQuery, setSelectedQuery] = useState<CustomerQuery | null>(null);

  const filtered = useMemo(() => {
    let q = queries;
    if (activeStatus !== "ALL") q = q.filter((r) => r.status === activeStatus);
    if (search.trim()) {
      const s = search.toLowerCase();
      q = q.filter(
        (r) =>
          r.subject.toLowerCase().includes(s) ||
          r.description.toLowerCase().includes(s) ||
          r.customer_email?.toLowerCase().includes(s)
      );
    }
    return q;
  }, [queries, activeStatus, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: queries.length };
    queries.forEach((q) => {
      c[q.status] = (c[q.status] || 0) + 1;
    });
    return c;
  }, [queries]);

  function handleQueryUpdated(updated: CustomerQuery) {
    setQueries((prev) =>
      prev.map((q) => (q.query_id === updated.query_id ? updated : q))
    );
    setSelectedQuery(updated);
    onQueryUpdated?.(updated);
  }

  return (
    <div className="space-y-4">
      {/* Search + status tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search queries by subject, description or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeStatus === tab.value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.label}
              {counts[tab.value] !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs",
                    activeStatus === tab.value
                      ? "bg-brand-500 text-white"
                      : "bg-white text-gray-500"
                  )}
                >
                  {counts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Filter className="w-6 h-6" />}
          title="No queries found"
          description={
            search
              ? "Try a different search term."
              : `No ${activeStatus !== "ALL" ? activeStatus.toLowerCase().replace("_", " ") : ""} queries.`
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QueryCard
              key={q.query_id}
              query={q}
              onClick={() => setSelectedQuery(q)}
            />
          ))}
        </div>
      )}

      {/* Slide-in detail panel */}
      {selectedQuery && (
        <QueryDetailPanel
          query={selectedQuery}
          currentUser={currentUser}
          onClose={() => setSelectedQuery(null)}
          onUpdated={handleQueryUpdated}
        />
      )}
    </div>
  );
}
