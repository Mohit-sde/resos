/**
 * Stable URLs for RestaurantERP
 * 
 * This is the single source of truth for all auth URLs.
 * If you need to reference a URL anywhere, import from here.
 */

// ========================
// CUSTOMER ROUTES (STABLE)
// ========================
export const CUSTOMER_ROUTES = {
  // NO GLOBAL REGISTRATION — users must register via restaurant
  
  GLOBAL_ORDERS: "/orders",
  GLOBAL_ORDERS_DETAIL: (id: string) => `/orders/${id}`,
  
  RESTAURANT_MENU: (slug: string) => `/${slug}`,
  RESTAURANT_REGISTER: (slug: string) => `/${slug}/register`,
  RESTAURANT_CART: (slug: string) => `/${slug}/cart`,
  RESTAURANT_CHECKOUT: (slug: string) => `/${slug}/checkout`,
  RESTAURANT_ORDERS: (slug: string) => `/${slug}/orders`,
  RESTAURANT_ORDERS_DETAIL: (slug: string, id: string) => `/${slug}/orders/${id}`,
  
  // Reserved for future implementation
  RESTAURANT_MENU_LIST: (slug: string) => `/${slug}/menu`,
  RESTAURANT_MENU_DETAIL: (slug: string, id: string) => `/${slug}/menu/${id}`,
} as const;

// ========================
// STAFF ROUTES (STABLE)
// ========================
export const STAFF_ROUTES = {
  LOGIN: "/login",
  
  ROOT_ADMIN: "/root-admin",
  
  ADMIN_DASHBOARD: "/restaurant-admin",
  ADMIN_PROFILE: "/restaurant-admin/profile",
  ADMIN_MENU: "/restaurant-admin/menu",
  ADMIN_PRODUCTS: "/restaurant-admin/products",
  ADMIN_ORDERS: "/restaurant-admin/orders",
  ADMIN_ANALYTICS: "/restaurant-admin/analytics",
  ADMIN_SETTINGS: "/restaurant-admin/settings",
  
  MANAGER_DASHBOARD: "/restaurant-manager",
  MANAGER_PROFILE: "/restaurant-manager/profile",
  MANAGER_MENU: "/restaurant-manager/menu",
  MANAGER_PRODUCTS: "/restaurant-manager/products",
  MANAGER_ORDERS: "/restaurant-manager/orders",
  MANAGER_ANALYTICS: "/restaurant-manager/analytics",
  MANAGER_SETTINGS: "/restaurant-manager/settings",
  
  SUPERADMIN_DASHBOARD: "/restaurant-superadmin",
} as const;

// ========================
// QUERY PARAMETER WHITELIST
// ========================
export const ALLOWED_QUERY_PARAMS = {
  login: new Set(["returnTo", "email"]),
  restaurant: new Set(["referral", "source"]),
  orders: new Set(["status", "restaurantId", "date"]),
  admin: new Set(["tab", "filter"]),
} as const;

// ========================
// VALIDATION HELPERS
// ========================

/**
 * Validate if a returnTo URL is safe to redirect to
 * returnTo must be:
 * - Start with "/"
 * - Be one of the staff dashboard routes (/restaurant-admin/*, /restaurant-manager/*, /restaurant-superadmin, /root-admin)
 * - NOT be /login (prevent redirect loops)
 */
export function isValidReturnTo(returnTo: string | null | undefined): boolean {
  if (!returnTo || typeof returnTo !== "string") return false;
  
  // Must start with /
  if (!returnTo.startsWith("/")) return false;
  
  // Prevent redirect loops
  if (returnTo === "/login") return false;
  
  // Allow staff dashboard routes only
  const validPrefixes = [
    "/restaurant-admin",
    "/restaurant-manager",
    "/restaurant-superadmin",
    "/root-admin",
  ];
  
  return validPrefixes.some(prefix => returnTo.startsWith(prefix));
}

/**
 * Get all valid staff dashboard routes (for testing/validation)
 */
export function getAllValidStaffRoutes(): string[] {
  return [
    STAFF_ROUTES.LOGIN,
    STAFF_ROUTES.ROOT_ADMIN,
    STAFF_ROUTES.ADMIN_DASHBOARD,
    STAFF_ROUTES.MANAGER_DASHBOARD,
    STAFF_ROUTES.SUPERADMIN_DASHBOARD,
  ];
}

// ========================
// EXPORT ALL
// ========================
export const ALL_STABLE_URLS = {
  ...CUSTOMER_ROUTES,
  ...STAFF_ROUTES,
} as const;