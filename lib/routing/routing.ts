import { isValidReturnTo, STAFF_ROUTES } from "@/lib/auth/stable-urls";
import type { AppUser } from "@/lib/types";

/**
 * Determine where to send a user after they log in
 * 
 * Logic:
 * 1. If returnTo is provided and valid, use it (deep-linking)
 * 2. Otherwise, use role-based destination
 * 
 * @param appUser - User object with role and roles array
 * @param returnTo - Optional deep-link URL (e.g., /restaurant-admin/products)
 * @returns Valid URL from STABLE_AUTH_URLS
 */
export function getPostLoginDestination(appUser: AppUser, returnTo?: string | null): string {
  // 1. Check if returnTo is provided and valid
  if (isValidReturnTo(returnTo)) {
    return returnTo;
  }

  // 2. Fall back to role-based destination
  if (appUser.role === "root_admin") {
    return STAFF_ROUTES.ROOT_ADMIN;
  }

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) {
    return STAFF_ROUTES.SUPERADMIN_DASHBOARD;
  }
  if (isAdmin) {
    return STAFF_ROUTES.ADMIN_DASHBOARD;
  }
  if (isManager) {
    return STAFF_ROUTES.MANAGER_DASHBOARD;
  }

  // Should not reach here for staff users
  // (customers don't use this function - they login via /{slug} modal)
  return STAFF_ROUTES.LOGIN;
}