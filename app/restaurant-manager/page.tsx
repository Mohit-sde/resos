"use client";

import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryList } from "@/components/query/QueryList";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { getManagerQueries } from "@/lib/firebase/services";
import type { CustomerQuery } from "@/lib/types";

export default function ManagerQueriesPage() {
  const { appUser } = useAuth();
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId || !appUser?.uid) { setLoading(false); return; }
    getManagerQueries(restaurantId, appUser.uid)
      .then(setQueries).finally(() => setLoading(false));
  }, [restaurantId, appUser?.uid]);

  const open = queries.filter((q) => q.status === "OPEN").length;
  const inProgress = queries.filter((q) => q.status === "IN_PROGRESS").length;
  const resolved = queries.filter((q) => ["RESOLVED", "CLOSED"].includes(q.status)).length;

  return (
    <DashboardShell title="My queries" subtitle="Queries assigned to you">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Open" value={open} accent={open > 0 ? "red" : "green"} />
          <StatCard label="In progress" value={inProgress} accent="orange" />
          <StatCard label="Resolved" value={resolved} accent="green" />
        </div>

        {loading ? <CardSkeleton count={3} /> : queries.length === 0 ? (
          <EmptyState icon={<MessageSquare className="w-6 h-6" />}
            title="No queries assigned"
            description="Queries assigned to you will appear here." />
        ) : appUser ? (
          <QueryList queries={queries} currentUser={appUser}
            onQueryUpdated={(u) => setQueries((p) => p.map((q) => q.query_id === u.query_id ? u : q))} />
        ) : null}
      </div>
    </DashboardShell>
  );
}
