"use client";

import { formatCurrency, formatDate, ORDER_STATUS_CONFIG, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Package, ChevronRight, Clock, Leaf, Flame } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  compact?: boolean;
}

const statusBadgeVariant: Record<
  OrderStatus,
  "info" | "warning" | "success" | "danger" | "neutral"
> = {
  PLACED: "info",
  PREPARING: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function OrderCard({ order, onClick, compact = false }: OrderCardProps) {
  const cfg = ORDER_STATUS_CONFIG[order.status];

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border border-gray-100 transition-shadow",
        onClick && "cursor-pointer hover:shadow-md",
        compact ? "p-4" : "p-5"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">
              Order #{order.order_number}
            </span>
            <Badge variant={statusBadgeVariant[order.status]}>
              {cfg.label}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(order.billing.grand_total)}
          </p>
          <p className="text-xs text-gray-400">
            {order.order_type.replace("_", " ").toLowerCase()}
          </p>
        </div>
      </div>

      {/* Items summary */}
      {!compact && (
        <div className="mt-3 space-y-1">
          {order.items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              {item.is_veg ? (
                <Leaf className="w-3 h-3 text-green-500 flex-shrink-0" />
              ) : (
                <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />
              )}
              <span className="flex-1 truncate">{item.name}</span>
              <span className="text-gray-400">×{item.quantity}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-xs text-gray-400 pl-5">
              +{order.items.length - 3} more item{order.items.length - 3 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
            {order.payment_method || "—"}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}
