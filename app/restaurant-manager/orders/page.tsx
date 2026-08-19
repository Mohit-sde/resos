"use client";

import { useState, useEffect, useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderCard } from "@/components/order/OrderCard";
import { OrderDetailModal } from "@/components/order/OrderDetailModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { useAuth } from "@/context/AuthContext";
import { getOrders } from "@/lib/firebase/services";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_TABS: { value: "ALL" | OrderStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PLACED", label: "Placed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ManagerOrdersPage() {
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | OrderStatus>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    getOrders(restaurantId).then(setOrders).finally(() => setLoading(false));
  }, [restaurantId]);

  const filtered = useMemo(() =>
    activeTab === "ALL" ? orders : orders.filter((o) => o.status === activeTab),
    [orders, activeTab]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  return (
    <DashboardShell title="Orders" subtitle="View and update order statuses">
      <div className="space-y-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === tab.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {tab.label}
              {counts[tab.value] !== undefined && (
                <span className={cn("px-1.5 py-0.5 rounded-full text-xs",
                  activeTab === tab.value ? "bg-brand-500 text-white" : "bg-white text-gray-500")}>
                  {counts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? <CardSkeleton count={4} /> : filtered.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="w-6 h-6" />}
            title="No orders" description="No orders match this filter." />
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => (
              <OrderCard key={o.order_id} order={o} onClick={() => setSelected(o)} />
            ))}
          </div>
        )}
      </div>

      {selected && appUser && (
        <OrderDetailModal order={selected} open={!!selected}
          onClose={() => setSelected(null)} currentUser={appUser}
          onOrderUpdated={(u) => {
            setOrders((p) => p.map((o) => o.order_id === u.order_id ? u : o));
            setSelected(u);
          }} />
      )}
    </DashboardShell>
  );
}
