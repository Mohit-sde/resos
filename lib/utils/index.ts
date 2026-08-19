import { clsx, type ClassValue } from "clsx";
import type { OrderStatus, QueryStatus } from "@/lib/types";

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Currency formatter (INR)
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Date formatter
export function formatDate(timestamp: { toDate?: () => Date } | Date | string) {
  let date: Date;
  if (timestamp instanceof Date) date = timestamp;
  else if (typeof timestamp === "string") date = new Date(timestamp);
  else if (timestamp?.toDate) date = timestamp.toDate();
  else date = new Date();

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Order status config
export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; step: number }
> = {
  PLACED: {
    label: "Placed",
    color: "text-blue-700",
    bg: "bg-blue-50",
    step: 1,
  },
  PREPARING: {
    label: "Preparing",
    color: "text-amber-700",
    bg: "bg-amber-50",
    step: 2,
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    color: "text-orange-700",
    bg: "bg-orange-50",
    step: 3,
  },
  DELIVERED: {
    label: "Delivered",
    color: "text-green-700",
    bg: "bg-green-50",
    step: 4,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-red-700",
    bg: "bg-red-50",
    step: 0,
  },
};

// Query status config
export const QUERY_STATUS_CONFIG: Record<
  QueryStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  OPEN: {
    label: "Open",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  IN_PROGRESS: {
    label: "In progress",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  RESOLVED: {
    label: "Resolved",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  CLOSED: {
    label: "Closed",
    color: "text-gray-600",
    bg: "bg-gray-100",
    border: "border-gray-200",
  },
};

// Generate auto order number
export function generateOrderNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

// Slugify string
export function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

// Calculate discounted price
export function discountedPrice(price: number, discountPercent: number) {
  return price * (1 - discountPercent / 100);
}
