"use client";

import RestaurantAdminPage from "@/app/restaurant-admin/page";

/**
 * Landing page for dual-role users (appUser.roles includes BOTH
 * restaurant_admin and restaurant_manager for their restaurant).
 *
 * This renders the exact same dashboard as /restaurant-admin — no admin or
 * manager component is recreated here. The Sidebar already lists both
 * admin nav items (/restaurant-admin/*) and manager nav items
 * (/restaurant-manager/*) for dual-role users, so every existing page
 * stays reachable from here through normal navigation.
 *
 * This file exists as its own route (rather than just redirecting to
 * /restaurant-admin) so the URL and sidebar "Dashboard" highlight reflect
 * that this user is a superadmin, not a plain admin.
 */
export default function RestaurantSuperAdminPage() {
  return <RestaurantAdminPage />;
}