"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRestaurants } from "@/lib/firebase/services";
import { getOrderById } from "@/lib/firebase/services/orders";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageLoader, CardSkeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ChevronLeft,
  Package,
  Clock,
  Phone,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Order, Restaurant } from "@/lib/types";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);

        // Need to find restaurant first (we don't know it from URL)
        const restaurants = await getRestaurants();

        let foundOrder: Order | null = null;
        let foundRestaurant: Restaurant | null = null;

        // Search through all restaurants
        for (const rest of restaurants) {
          const orderData = await getOrderById(rest.restaurant_id, orderId);
          if (orderData) {
            foundOrder = orderData;
            foundRestaurant = rest;
            break;
          }
        }

        if (!foundOrder) {
          setNotFound(true);
          return;
        }

        // Check if this order belongs to current user
        if (foundOrder.customer_id !== currentUser.uid) {
          setUnauthorized(true);
          return;
        }

        setOrder(foundOrder);
        setRestaurant(foundRestaurant);
      } catch (error) {
        console.error("Error fetching order:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [currentUser?.uid, orderId]);

  if (loading) return <PageLoader />;

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <EmptyState
          icon={<AlertCircle className="w-6 h-6 text-red-600" />}
          title="Access denied"
          description="You don't have permission to view this order."
          action={
            <Button variant="primary" onClick={() => router.push("/orders")}>
              Back to Orders
            </Button>
          }
        />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="Order not found"
          description="This order doesn't exist or has been deleted."
          action={
            <Button variant="primary" onClick={() => router.push("/orders")}>
              Back to Orders
            </Button>
          }
        />
      </div>
    );
  }

  const createdAt = order.created_at?.toDate?.() || new Date();
  const createdDate = createdAt.toLocaleDateString();
  const createdTime = createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusFlow = ["PLACED", "PREPARING", "DELIVERED", "CANCELLED"] as const;
  const currentStatusIndex = statusFlow.indexOf(order.status as any);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order #{orderId.slice(0, 8)}</h1>
            <p className="text-sm text-gray-600">
              {createdDate} at {createdTime}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status Timeline */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Order Status</h2>
          <div className="flex items-center gap-2">
            {statusFlow.map((status, idx) => (
              <div key={status} className="flex-1 flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    idx <= currentStatusIndex
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  ✓
                </div>
                {idx < statusFlow.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 ${
                      idx < currentStatusIndex
                        ? "bg-green-600"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-gray-600">
            {statusFlow.map(status => (
              <div key={status} className="flex-1 text-center">
                {status.replace(/_/g, " ")}
              </div>
            ))}
          </div>
        </div>

        {/* Restaurant & Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Restaurant Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Restaurant</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-900">{restaurant?.business_name}</p>
              </div>
              {restaurant?.address && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Address
                  </p>
                  <p className="font-medium text-gray-900">{restaurant.address}</p>
                </div>
              )}
              {restaurant?.phone && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Phone className="w-4 h-4" /> Phone
                  </p>
                  
                    href={`tel:${restaurant.phone}`}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    {restaurant.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Type</span>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {order.order_type}
                </Badge>
              </div>
              {order.order_type === "DINE_IN" && order.table_number && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Table</span>
                  <span className="font-medium text-gray-900">
                    Table {order.table_number}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Items</span>
                <span className="font-medium text-gray-900">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge
                  className={`${
                    order.status === "DELIVERED"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : order.status === "CANCELLED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {order.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Items</h3>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">
                    Qty: {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="font-medium text-gray-900">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Billing</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Item Total</span>
              <span className="text-gray-900">
                {formatCurrency(order.billing.item_total)}
              </span>
            </div>
            {order.billing.delivery_charge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery</span>
                <span className="text-gray-900">
                  {formatCurrency(order.billing.delivery_charge)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Taxes</span>
              <span className="text-gray-900">
                {formatCurrency(order.billing.taxes)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(order.billing.grand_total)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.instructions && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Special Instructions</h3>
            <p className="text-sm text-gray-600">{order.instructions}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => router.push("/orders")}
          >
            Back to Orders
          </Button>
          {restaurant && (
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => router.push(`/${restaurant.slug}`)}
            >
              Order Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}