"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/Loading";
import { useAuth } from "@/context/AuthContext";
import {
  getOrders, getQueries, getUsersByRestaurant, getRevenueByDay,
} from "@/lib/firebase/services";
import { formatCurrency } from "@/lib/utils";
import type { Order, CustomerQuery, AppUser } from "@/lib/types";

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#f97316", "#22c55e", "#ef4444"];

export default function PerformancePage() {
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [managers, setManagers] = useState<AppUser[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    Promise.all([
      getOrders(restaurantId), getQueries(restaurantId),
      getUsersByRestaurant(restaurantId), getRevenueByDay(restaurantId, 14),
    ]).then(([o, q, u, rev]) => {
      setOrders(o); setQueries(q);
      setManagers(u.filter((x) => x.role === "restaurant_manager"));
      setRevenueData(rev);
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  // Order status pie data
  const statusData = (["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const)
    .map((s) => ({ name: s.replace(/_/g, " "), value: orders.filter((o) => o.status === s).length }))
    .filter((d) => d.value > 0);

  // Category revenue
  const categoryMap: Record<string, number> = {};
  orders.filter((o) => o.status === "DELIVERED").forEach((o) => {
    o.items.forEach((i) => { categoryMap[i.name] = (categoryMap[i.name] || 0) + i.price * i.quantity; });
  });
  const topItems = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, revenue]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, revenue }));

  // Manager performance
  const managerPerf = managers.map((m) => {
    const mq = queries.filter((q) => q.assigned_manager_uid === m.uid);
    return {
      name: m.email.split("@")[0],
      resolved: mq.filter((q) => ["RESOLVED", "CLOSED"].includes(q.status)).length,
      open: mq.filter((q) => ["OPEN", "IN_PROGRESS"].includes(q.status)).length,
    };
  });

  const totalRevenue = orders.filter((o) => o.status === "DELIVERED")
    .reduce((s, o) => s + o.billing.grand_total, 0);
  const avgOrderValue = orders.length
    ? orders.reduce((s, o) => s + o.billing.grand_total, 0) / orders.length
    : 0;
  const resolvedQueries = queries.filter((q) => ["RESOLVED", "CLOSED"].includes(q.status)).length;
  const resolutionRate = queries.length
    ? Math.round((resolvedQueries / queries.length) * 100) : 0;

  if (loading) return <DashboardShell title="Performance"><CardSkeleton count={4} /></DashboardShell>;

  return (
    <DashboardShell title="Performance" subtitle="Business intelligence & analytics">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total revenue" value={formatCurrency(totalRevenue)} accent="green" />
          <StatCard label="Total orders" value={orders.length} accent="blue" />
          <StatCard label="Avg order value" value={formatCurrency(avgOrderValue)} accent="orange" />
          <StatCard label="Query resolution" value={`${resolutionRate}%`} accent={resolutionRate >= 80 ? "green" : "red"} />
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue & orders — last 14 days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(v: number, n: string) => [n === "revenue" ? formatCurrency(v) : v, n]}
                contentStyle={{ borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="revenue" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Order status pie */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Order status breakdown</h2>
            {statusData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No orders yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top items */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Top revenue items</h2>
            {topItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={topItems} margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                    contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Manager performance table */}
        {managerPerf.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Manager performance</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Manager", "Assigned", "Resolved", "Open", "Resolution rate"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managerPerf.map((m) => {
                  const total = m.resolved + m.open;
                  const rate = total ? Math.round((m.resolved / total) * 100) : 0;
                  return (
                    <tr key={m.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 px-3 font-medium text-gray-900">{m.name}</td>
                      <td className="py-3 px-3 text-gray-600">{total}</td>
                      <td className="py-3 px-3 text-green-600 font-medium">{m.resolved}</td>
                      <td className="py-3 px-3 text-amber-600 font-medium">{m.open}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs text-gray-600">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
