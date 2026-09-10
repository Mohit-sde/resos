"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  ShoppingBag,
  MessageSquare,
  Users,
  UtensilsCrossed,
  BarChart3,
  LogOut,
  ChevronRight,
  ClipboardList,
  History,
  User,
  ShoppingCart,
  MenuSquare,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutUser, getRestaurantBySlug } from "@/lib/firebase/services";
import { useNavigationLoading } from "../../lib/hooks/useNavigation";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import type { AppUser, Restaurant } from "@/lib/types";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useEffect, useState } from "react";
import { restaurantSessionManager } from "@/lib/utils/restaurantSessionManager";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// ─── Per-role nav item groups ──────────────────────────────────────────────

const ROOT_ADMIN_ITEMS: NavItem[] = [
  { href: "/root-admin", label: "Restaurants", icon: <Store className="w-4 h-4" /> },
  { href: "/root-admin/users", label: "Users", icon: <Users className="w-4 h-4" /> },
];

const RESTAURANT_ADMIN_ITEMS: NavItem[] = [
  { href: "/restaurant-admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/restaurant-admin/orders", label: "Active orders", icon: <ShoppingBag className="w-4 h-4" /> },
  { href: "/restaurant-admin/queries", label: "Queries", icon: <MessageSquare className="w-4 h-4" /> },
  { href: "/restaurant-admin/managers", label: "Managers", icon: <Users className="w-4 h-4" /> },
  { href: "/restaurant-admin/performance", label: "Performance", icon: <BarChart3 className="w-4 h-4" /> },
];

const RESTAURANT_MANAGER_ITEMS: NavItem[] = [
  { href: "/restaurant-manager", label: "Active queries", icon: <ClipboardList className="w-4 h-4" /> },
  { href: "/restaurant-manager/products", label: "Products", icon: <UtensilsCrossed className="w-4 h-4" /> },
  { href: "/restaurant-manager/orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
];

// ─── CUSTOMER ROUTES (shown on /restaurant/{slug} and profile pages) ───────
// Note: Cart badge is added dynamically in getNavItems()

const CUSTOMER_ITEMS: NavItem[] = [
  { href: "/menu", label: "Menu", icon: <MenuSquare className="w-4 h-4" /> },
  { href: "/cart", label: "Cart", icon: <ShoppingCart className="w-4 h-4" /> },
  { href: "/orders", label: "Order history", icon: <History className="w-4 h-4" /> },
  { href: "/queries", label: "My queries", icon: <MessageSquare className="w-4 h-4" /> },
  { href: "/profile", label: "Profile", icon: <User className="w-4 h-4" /> },
];

/**
 * Detect if current route is a restaurant-specific page
 * Returns the restaurant slug if on /{slug}, or null
 * Excludes admin/manager routes
 */
function getRestaurantSlugFromPathname(pathname: string): string | null {
  // Exclude admin/manager/auth routes
  const excludedPrefixes = [
    "/restaurant-admin",
    "/restaurant-manager",
    "/restaurant-superadmin",
    "/root-admin",
    "/login",
    "/menu",
    "/cart",
    "/orders",
    "/queries",
    "/profile",
    "/api",
  ];

  if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // Match /{slug} pattern (e.g., /simla-sweets)
  const match = pathname.match(/^\/([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * Get restaurant name based on context
 * For customers: fetch from slug
 * For admin/manager: fetch from appUser.managed_restaurant
 */
async function getRestaurantNameForSidebar(
  appUser: AppUser,
  pathname: string
): Promise<string | null> {
  const slug = getRestaurantSlugFromPathname(pathname);

  // Customer on restaurant page: fetch by slug
  if (slug && appUser.role === "customer") {
    try {
      const restaurant = await getRestaurantBySlug(slug);
      return restaurant?.business_name || null;
    } catch (error) {
      console.error("Error fetching restaurant by slug:", error);
      return null;
    }
  }

  // Admin/Manager: get from managed_restaurant in appUser
  if (appUser.role !== "customer" && appUser.managed_restaurant) {
    try {
      const restaurant = await getRestaurantById(appUser.managed_restaurant);
      return restaurant?.business_name || null;
    } catch (error) {
      console.error("Error fetching restaurant by ID:", error);
      return null;
    }
  }

  return null;
}

/**
 * Helper to fetch restaurant by ID
 */
async function getRestaurantById(
  restaurantId: string
): Promise<Restaurant | null> {
  try {
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase/config");
    const snap = await getDoc(doc(db, "restaurants", restaurantId));
    return snap.exists() ? (snap.data() as Restaurant) : null;
  } catch (error) {
    console.error("Error fetching restaurant by ID:", error);
    return null;
  }
}

/**
 * Get nav items based on user role and current route
 * When on /restaurant/{slug}, show ONLY customer items
 */
function getNavItems(
  appUser: AppUser,
  cartCount: number,
  isOnRestaurantPage: boolean
): NavItem[] {
  // If on restaurant page, ALWAYS show customer routes only
  if (isOnRestaurantPage) {
    return CUSTOMER_ITEMS.map((item) =>
      item.href === "/cart"
        ? { ...item, badge: cartCount > 0 ? cartCount : undefined }
        : item
    );
  }

  if (appUser.role === "root_admin") return ROOT_ADMIN_ITEMS;
  if (appUser.role === "customer") {
    return CUSTOMER_ITEMS.map((item) =>
      item.href === "/cart"
        ? { ...item, badge: cartCount > 0 ? cartCount : undefined }
        : item
    );
  }

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) {
    return [...RESTAURANT_ADMIN_ITEMS, ...RESTAURANT_MANAGER_ITEMS];
  }
  if (isAdmin) return RESTAURANT_ADMIN_ITEMS;
  if (isManager) return RESTAURANT_MANAGER_ITEMS;

  return [];
}

function getRoleLabel(appUser: AppUser, isOnRestaurantPage: boolean): string {
  if (isOnRestaurantPage) return "Ordering";
  if (appUser.role === "root_admin") return "Root Admin";
  if (appUser.role === "customer") return "Customer";

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) return "Super Admin";
  if (isAdmin) return "Restaurant Admin";
  if (isManager) return "Manager";
  return "";
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser } = useAuth();
  const { totalItems } = useCart();
  const { isPending, push } = useNavigationLoading();
  const [isExpanded, setIsExpanded] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);

  // Fetch restaurant name based on context
  useEffect(() => {
    if (!appUser) return;

    const fetchRestaurantName = async () => {
      setLoadingRestaurant(true);
      try {
        const name = await getRestaurantNameForSidebar(appUser, pathname);
        setRestaurantName(name);
      } finally {
        setLoadingRestaurant(false);
      }
    };

    fetchRestaurantName();
  }, [appUser, pathname]);

  if (!appUser) return null;

  const isOnRestaurantPage = getRestaurantSlugFromPathname(pathname) !== null;
  const navItems = getNavItems(appUser, totalItems, isOnRestaurantPage);
  const roleLabel = getRoleLabel(appUser, isOnRestaurantPage);
  
  // Display restaurant name if available, else fallback to "RestaurantOS"
  const displayName = restaurantName || "RestaurantOS";

  async function handleLogout() {
    try {
      // Firebase Auth logout is GLOBAL - clears auth for all restaurants
      // So we must clear ALL restaurant sessions to avoid stale sessions
      restaurantSessionManager.clearAllSessions();
      
      await logoutUser();
      router.push("/login");
      toast.success("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  }

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-screen bg-gray-950 text-gray-300 transition-all duration-300 ease-out overflow-hidden",
          isExpanded ? "lg:w-[20vw] w-[80vw]" : "w-16"
        )}
      >
        {/* Header - Logo Section */}
        <div className="h-14 flex items-center px-3 border-b border-gray-800 flex-shrink-0 overflow-hidden">
          {isExpanded ? (
            <div className="flex items-center justify-between w-full gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {loadingRestaurant ? "Loading..." : displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {roleLabel}
                  </p>
                </div>
              </div>
              <div className="relative group flex-shrink-0">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 mr-8 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50">
                  Collapse
                </div>
              </div>
            </div>
          ) : (
            <div className="relative group w-full flex justify-center">
              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute -right-24 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50">
                Expand
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const matchingItems = navItems.filter(
              (ni) => pathname === ni.href || pathname.startsWith(ni.href + "/")
            );
            const mostSpecific = matchingItems.sort(
              (a, b) => b.href.length - a.href.length
            )[0];
            const active = mostSpecific?.href === item.href;

            return (
              <div key={item.href} className="relative group w-full">
                <button
                  onClick={() => {
                    push(item.href);
                    onNavigate?.();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm relative w-full text-left min-w-0",
                    active
                      ? "bg-brand-600 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="flex-shrink-0 flex items-center justify-center">
                    {item.icon}
                  </span>

                  {isExpanded && (
                    <>
                      <span className="flex-1 truncate min-w-0">
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                      {active && (
                        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                      )}
                    </>
                  )}

                  {item.badge !== undefined && !isExpanded && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </button>

                {!isExpanded && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile + Logout */}
        <div className="p-2 border-t border-gray-800 flex-shrink-0 overflow-hidden">
          <div className="relative group w-full">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors text-sm min-w-0",
                isExpanded ? "justify-start" : "justify-center"
              )}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span className="truncate">Log out</span>}
            </button>

            {!isExpanded && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50">
                Log out
              </div>
            )}
          </div>
          {isExpanded && (
            <div className="px-3 py-2 mb-2 min-w-0">
              <p className="text-xs text-gray-500 truncate">
                {appUser.email}
              </p>
            </div>
          )}

          {!isExpanded && (
            <div className="mt-2 flex justify-center relative group">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-semibold text-white cursor-default flex-shrink-0">
                {appUser.email?.charAt(0).toUpperCase()}
              </div>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50">
                {appUser.email}
              </div>
            </div>
          )}
        </div>
      </aside>

      <LoadingOverlay isLoading={isPending} message="Loading..." />
    </>
  );
}