"use client";

import { useState, useEffect, useMemo } from "react";
import { History } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderCard } from "@/components/order/OrderCard";
import { OrderDetailModal } from "@/components/order/OrderDetailModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrders } from "@/lib/firebase/services";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Order, OrderStatus } from "@/lib/types";

const TABS: { value: "ALL" | OrderStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PLACED", label: "Active" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function CustomerOrdersPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | OrderStatus>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId || !appUser?.uid) { setLoading(false); return; }
    getCustomerOrders(restaurantId, appUser.uid).then(setOrders).finally(() => setLoading(false));
  }, [restaurantId, appUser?.uid]);

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return orders;
    if (activeTab === "PLACED") return orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  return (
    <DashboardShell title="Order history" subtitle={`${orders.length} orders placed`}>
      <div className="space-y-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={cn("flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === tab.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <CardSkeleton count={3} /> : filtered.length === 0 ? (
          <EmptyState icon={<History className="w-6 h-6" />}
            title="No orders yet"
            description="Your order history will appear here once you place an order."
            action={<Button variant="primary" onClick={() => router.push("/menu")}>Browse menu</Button>} />
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
