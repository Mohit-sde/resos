import { Timestamp } from "firebase/firestore";

// ─── User Roles ───────────────────────────────────────────────────────────────
export type UserRole =
  | "root_admin"
  | "restaurant_admin"
  | "restaurant_manager"
  | "customer";

// ─── User ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  associated_restaurants: string[];
  created_at: Timestamp;
}

// ─── Restaurant ───────────────────────────────────────────────────────────────
export interface Branding {
  primary_color: string;
  logo_url: string;
}

export interface Restaurant {
  restaurant_id: string;
  business_name: string;
  fssai_number: string;
  gst_number: string;
  url_slug: string;
  is_open: boolean;
  upi_id: string;
  branding: Branding;
  address?: string;
  phone?: string;
  cuisine_type?: string;
  admin_uid?: string; // assigned restaurant admin
  manager_uids?: string[]; // assigned restaurant managers
  created_at?: Timestamp;
}

// ─── Menu Product ─────────────────────────────────────────────────────────────
export interface MenuProduct {
  product_id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  is_veg: boolean;
  description: string;
  discount_percent: number;
  image_url?: string;
  preparation_time: number; // in minutes
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

  // ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus =
  | "PLACED"
  | "PREPARING"
  | "DELIVERED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "TAKEAWAY"; // No DELIVERY

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
}

export interface OrderBilling {
  item_total: number;
  delivery_charge: number; // Will be 0 for DINE_IN/TAKEAWAY
  taxes: number;
  grand_total: number;
}

export interface Order {
  order_id: string;
  customer_id: string;
  items: OrderItem[]; // ← Corrected from CartItem
  billing: OrderBilling; // ← Use OrderBilling (not separate fields)
  order_type: OrderType; // "DINE_IN" | "TAKEAWAY"
  status: OrderStatus;
  phone: string;
  table_number?: string; // For DINE_IN orders only
  instructions?: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

// ─── Query / Support Ticket ───────────────────────────────────────────────────
export type QueryStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export interface QueryRemark {
  remark: string;
  by_uid: string;
  by_name: string;
  timestamp: Timestamp;
}

export interface CustomerQuery {
  query_id: string;
  restaurant_id: string;
  customer_id: string;
  customer_email?: string;
  order_id?: string;
  subject: string;
  description: string;
  status: QueryStatus;
  assigned_manager_uid?: string;
  assigned_manager_name?: string;
  remarks: QueryRemark[];
  created_at: Timestamp;
  updated_at?: Timestamp;
}

// ─── Cart (client-side) ───────────────────────────────────────────────────────
export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
  image_url?: string;
  discount_percent: number;
}

// ─── Analytics / Dashboard ───────────────────────────────────────────────────
export interface RevenueMetric {
  date: string;
  revenue: number;
  orders: number;
}

export interface AgentPerformance {
  manager_uid: string;
  manager_name: string;
  queries_resolved: number;
  avg_resolution_hours: number;
  open_queries: number;
}

export interface AssignAdminResponse {
  success: boolean;
  message: string;
  uid?: string;
  isNewUser?: boolean;
}
