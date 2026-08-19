"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import {
  formatCurrency,
  formatDate,
  ORDER_STATUS_CONFIG,
  cn,
} from "@/lib/utils";
import { updateOrderStatus } from "@/lib/firebase/services";
import toast from "react-hot-toast";
import { CheckCircle2, Circle, Leaf, Flame } from "lucide-react";
import type { Order, OrderStatus, AppUser } from "@/lib/types";

interface OrderDetailModalProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onOrderUpdated?: (updated: Order) => void;
}

const STATUS_FLOW: OrderStatus[] = [
  "PLACED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function OrderDetailModal({
  order: initialOrder,
  open,
  onClose,
  currentUser,
  onOrderUpdated,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [nextStatus, setNextStatus] = useState<OrderStatus>(
    NEXT_STATUS[order.status][0] || order.status
  );
  const [updating, setUpdating] = useState(false);

  const canUpdateStatus =
    currentUser.role === "restaurant_manager" ||
    currentUser.role === "restaurant_admin";
  const nextOptions = NEXT_STATUS[order.status];

  async function handleStatusUpdate() {
    setUpdating(true);
    try {
      await updateOrderStatus(order.restaurant_id, order.order_id, nextStatus);
      const updated = { ...order, status: nextStatus };
      setOrder(updated);
      onOrderUpdated?.(updated);
      toast.success(`Order marked as ${ORDER_STATUS_CONFIG[nextStatus].label}`);
    } catch {
      toast.error("Failed to update order status");
    } finally {
      setUpdating(false);
    }
  }

  const currentStep = ORDER_STATUS_CONFIG[order.status].step;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Order #${order.order_number}`}
      description={formatDate(order.created_at)}
      size="md"
    >
      <div className="space-y-5">
        {/* Status tracker */}
        {order.status !== "CANCELLED" && (
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((status, idx) => {
              const step = ORDER_STATUS_CONFIG[status].step;
              const done = currentStep >= step;
              const active = currentStep === step;
              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    {done ? (
                      <CheckCircle2
                        className={cn(
                          "w-6 h-6",
                          active ? "text-brand-600" : "text-green-500"
                        )}
                      />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                    <span
                      className={cn(
                        "text-xs text-center leading-tight",
                        done ? "text-gray-700 font-medium" : "text-gray-400"
                      )}
                    >
                      {ORDER_STATUS_CONFIG[status].label}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-1 mb-4",
                        currentStep > step ? "bg-green-400" : "bg-gray-100"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {order.status === "CANCELLED" && (
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <Badge variant="danger">Order cancelled</Badge>
          </div>
        )}

        {/* Order type + payment */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Order type</p>
            <p className="text-sm font-medium text-gray-800">
              {order.order_type.replace("_", " ")}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Payment</p>
            <p className="text-sm font-medium text-gray-800">
              {order.payment_method || "—"}
            </p>
          </div>
          {order.dine_in_date && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Dine-in date</p>
              <p className="text-sm font-medium text-gray-800">
                {new Date(order.dine_in_date).toLocaleDateString("en-IN")}
              </p>
            </div>
          )}
          {order.dine_in_guests && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Guests</p>
              <p className="text-sm font-medium text-gray-800">
                {order.dine_in_guests}
              </p>
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Items
          </p>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
              >
                {item.is_veg ? (
                  <Leaf className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Flame className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="flex-1 text-sm text-gray-800">{item.name}</span>
                <span className="text-sm text-gray-500">×{item.quantity}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Billing */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Item total</span>
            <span>{formatCurrency(order.billing.item_total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Delivery charge</span>
            <span>{formatCurrency(order.billing.delivery_charge)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Taxes</span>
            <span>{formatCurrency(order.billing.taxes)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Grand total</span>
            <span>{formatCurrency(order.billing.grand_total)}</span>
          </div>
        </div>

        {/* Special instructions */}
        {order.special_instructions && (
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-600 mb-1">
              Special instructions
            </p>
            <p className="text-sm text-amber-800">{order.special_instructions}</p>
          </div>
        )}

        {/* Status update — manager/admin only */}
        {canUpdateStatus && nextOptions.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <Select
              label="Update order status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
              options={nextOptions.map((s) => ({
                value: s,
                label: ORDER_STATUS_CONFIG[s].label,
              }))}
            />
            <Button
              variant="primary"
              loading={updating}
              onClick={handleStatusUpdate}
              className="w-full"
            >
              Update status
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
