"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag, MessageSquare, TrendingUp, Users,
  DollarSign, Clock, CheckCircle2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/Loading";
import { OrderCard } from "@/components/order/OrderCard";
import { OrderDetailModal } from "@/components/order/OrderDetailModal";
import { useAuth } from "@/context/AuthContext";
import {
  getOrders, getQueries, getRevenueByDay, getRestaurant,
} from "@/lib/firebase/services";
import { formatCurrency } from "@/lib/utils";
import type { Order, CustomerQuery, Restaurant } from "@/lib/types";

export default function RestaurantAdminDashboard() {
  const { appUser } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    Promise.all([
      getRestaurant(restaurantId),
      getOrders(restaurantId),
      getQueries(restaurantId),
      getRevenueByDay(restaurantId, 7),
    ]).then(([r, o, q, rev]) => {
      setRestaurant(r); setOrders(o); setQueries(q); setRevenueData(rev);
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  const activeOrders = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
  const totalRevenue = orders.filter((o) => o.status === "DELIVERED")
    .reduce((s, o) => s + o.billing.grand_total, 0);
  const openQueries = queries.filter((q) => q.status === "OPEN").length;
  const todayOrders = orders.filter((o) => {
    const ts = o.created_at?.toMillis?.() ?? 0;
    return Date.now() - ts < 86400000;
  }).length;

  if (loading) return (
    <DashboardShell title="Dashboard">
      <CardSkeleton count={4} />
    </DashboardShell>
  );

  return (
    <DashboardShell
      title={restaurant?.business_name ?? "Restaurant dashboard"}
      subtitle="Live performance overview"
    >
      <div className="space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total revenue" value={formatCurrency(totalRevenue)}
            icon={<DollarSign className="w-5 h-5" />} accent="green" sub="all time" />
          <StatCard label="Active orders" value={activeOrders.length}
            icon={<Clock className="w-5 h-5" />} accent="orange" />
          <StatCard label="Today's orders" value={todayOrders}
            icon={<ShoppingBag className="w-5 h-5" />} accent="blue" />
          <StatCard label="Open queries" value={openQueries}
            icon={<MessageSquare className="w-5 h-5" />}
            accent={openQueries > 0 ? "red" : "green"} />
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue — last 7 days</h2>
          {revenueData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #f3f4f6", fontSize: 13 }} />
                <Area type="monotone" dataKey="revenue" stroke="#ea580c" strokeWidth={2}
                  fill="url(#rev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order status breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const).map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <div key={s} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.replace("_", " ").toLowerCase()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Active orders list */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Active orders ({activeOrders.length})
          </h2>
          {activeOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active orders right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.slice(0, 5).map((o) => (
                <OrderCard key={o.order_id} order={o} onClick={() => setSelectedOrder(o)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedOrder && appUser && (
        <OrderDetailModal order={selectedOrder} open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)} currentUser={appUser}
          onOrderUpdated={(updated) => {
            setOrders((p) => p.map((o) => o.order_id === updated.order_id ? updated : o));
            setSelectedOrder(updated);
          }} />
      )}
    </DashboardShell>
  );
}
