"use client";

import { useState, useEffect } from "react";
import { MessageSquare, UserPlus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryList } from "@/components/query/QueryList";
import { CardSkeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { getQueries, getUsersByRestaurant } from "@/lib/firebase/services";
import type { CustomerQuery, AppUser } from "@/lib/types";

export default function AdminQueriesPage() {
  const { appUser } = useAuth();
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [managers, setManagers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    Promise.all([
      getQueries(restaurantId),
      getUsersByRestaurant(restaurantId),
    ]).then(([q, u]) => {
      setQueries(q);
      setManagers(u.filter((u) => u.role === "restaurant_manager"));
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  return (
    <DashboardShell title="Customer queries" subtitle={`${queries.length} total queries`}>
      {loading ? <CardSkeleton count={3} /> : queries.length === 0 ? (
        <EmptyState icon={<MessageSquare className="w-6 h-6" />}
          title="No queries yet" description="Customer queries will appear here." />
      ) : appUser ? (
        <QueryList queries={queries} currentUser={appUser}
          onQueryUpdated={(u) => setQueries((p) => p.map((q) => q.query_id === u.query_id ? u : q))}
          showAssignment managers={managers.map((m) => ({
            uid: m.uid, name: m.email.split("@")[0],
          }))} />
      ) : null}
    </DashboardShell>
  );
}
