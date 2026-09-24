"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRestaurantBySlug } from "@/lib/firebase/services";
import { getCustomerRestaurantOrders } from "@/lib/firebase/services/orders";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronLeft, Package, ShoppingBag } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import type { Order, Restaurant } from "@/lib/types";

export default function RestaurantOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const slug = params?.slug as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch restaurant
  useEffect(() => {
    if (!slug) return;

    const fetchRestaurant = async () => {
      try {
        const r = await getRestaurantBySlug(slug);
        if (!r) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRestaurant(r);
      } catch (error) {
        console.error("Error fetching restaurant:", error);
        setNotFound(true);
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [slug]);

  // Fetch orders
  useEffect(() => {
    if (!restaurant || !currentUser?.uid) return;

    const fetchOrders = async () => {
      try {
        const orderList = await getCustomerRestaurantOrders(
          restaurant.restaurant_id,
          currentUser.uid
        );
        setOrders(orderList);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [restaurant, currentUser?.uid]);

  if (loading) return <PageLoader />;

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="Restaurant not found"
          description="This restaurant doesn't exist."
          action={
            <Button variant="primary" onClick={() => router.push("/")}>
              Browse Restaurants
            </Button>
          }
        />
      </div>
    );
  }

  if (!restaurant) return <PageLoader />;

  const brandColor = restaurant.branding?.primary_color ?? "#ea580c";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="relative" style={{ backgroundColor: brandColor }}>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => router.back()}
            className="mb-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">{restaurant.business_name}</h1>
          <p className="text-white/80 text-sm mt-1">Your Order History</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-6 h-6" />}
            title="No orders yet"
            description={`You haven't placed any orders at ${restaurant.business_name} yet.`}
            action={
              <Button
                variant="primary"
                onClick={() => router.push(`/${slug}`)}
              >
                Browse Menu
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                brandColor={brandColor}
                onClick={() => router.push(`/${slug}/orders/${order.order_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  brandColor: string;
  onClick: () => void;
}

function OrderCard({ order, brandColor, onClick }: OrderCardProps) {
  const statusColors: Record<string, string> = {
    PLACED: "bg-yellow-50 text-yellow-700 border-yellow-200",
    PREPARING: "bg-blue-50 text-blue-700 border-blue-200",
    OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700 border-purple-200",
    DELIVERED: "bg-green-50 text-green-700 border-green-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };

  const createdAt = order.created_at?.toDate?.() || new Date();
  const createdDate = createdAt.toLocaleDateString();
  const createdTime = createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-gray-900">
              Order #{order.order_id.slice(0, 8)}
            </h3>
            <span className="text-xs text-gray-500">{createdDate} {createdTime}</span>
          </div>

          {/* Order Info */}
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

          {/* Items Preview */}
          <div className="text-xs text-gray-500">
            {order.items.slice(0, 3).map(item => item.name).join(", ")}
            {order.items.length > 3 && ` +${order.items.length - 3} more`}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: brandColor }}
          >
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
      </div>
    </button>
  );
}