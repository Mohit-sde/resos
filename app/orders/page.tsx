"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCustomerRestaurantOrders } from "@/lib/firebase/services/orders";
import { getRestaurants } from "@/lib/firebase/services";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Loading";
import { Package, Clock, MapPin, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Order, Restaurant } from "@/lib/types";

export default function OrdersPage() {
  const { currentUser, appUser } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<(Order & { restaurantName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Map<string, Restaurant>>(new Map());

  // Fetch restaurants for naming
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const rests = await getRestaurants();
        const map = new Map(rests.map(r => [r.restaurant_id, r]));
        setRestaurants(map);
      } catch (error) {
        console.error("Error loading restaurants:", error);
      }
    };
    loadRestaurants();
  }, []);

  // Fetch orders from all restaurants customer has ordered from
  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const allRests = await getRestaurants();
        const allOrders: (Order & { restaurantName?: string })[] = [];

        // Query each restaurant's orders for this customer
        for (const restaurant of allRests) {
          const rOrders = await getCustomerRestaurantOrders(
            restaurant.restaurant_id,
            currentUser.uid
          );
          allOrders.push(
            ...rOrders.map(o => ({
              ...o,
              restaurantName: restaurant.business_name,
            }))
          );
        }

        // Sort by created_at descending
        allOrders.sort(
          (a, b) =>
            (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0)
        );

        setOrders(allOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser?.uid]);

  if (loading) return <PageLoader />;

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="No orders yet"
          description="Start by browsing restaurants and placing your first order."
          action={
            <Button variant="primary" onClick={() => router.push("/")}>
              Browse Restaurants
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order.order_id}
            order={order}
            onClick={() => router.push(`/orders/${order.order_id}`)}
          />
        ))}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order & { restaurantName?: string };
  onClick: () => void;
}

function OrderCard({ order, onClick }: OrderCardProps) {
  const statusColors: Record<string, string> = {
    PLACED: "bg-yellow-50 text-yellow-700 border-yellow-200",
    PREPARING: "bg-blue-50 text-blue-700 border-blue-200",
    OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700 border-purple-200",
    DELIVERED: "bg-green-50 text-green-700 border-green-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };

  const createdAt = order.created_at?.toDate?.() || new Date();
  const formattedDate = createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Restaurant Name & Date */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">{order.restaurantName}</h3>
            <span className="text-xs text-gray-500">{formattedDate}</span>
          </div>

          {/* Order Details */}
          <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="text-gray-600">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(order.billing.grand_total)}
            </span>
            <span className="text-gray-400">•</span>
            <Badge
              className={`text-xs border ${statusColors[order.status]}`}
            >
              {order.status}
            </Badge>
          </div>

          {/* Order Items Preview */}
          <div className="text-xs text-gray-500">
            {order.items.slice(0, 2).map(item => item.name).join(", ")}
            {order.items.length > 2 && ` +${order.items.length - 2} more`}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}