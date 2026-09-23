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
import { useEffect, useState, useMemo } from "react";
import { restaurantSessionManager } from "@/lib/utils/restaurantSessionManager";

interface NavItem {
  id: string; // ← Stable unique key
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// ─── Navigation items (base paths without restaurant slug) ──────────────────

const ROOT_ADMIN_ITEMS: NavItem[] = [
  { id: "root-restaurants", href: "/root-admin", label: "Restaurants", icon: <Store className="w-4 h-4" /> },
  { id: "root-users", href: "/root-admin/users", label: "Users", icon: <Users className="w-4 h-4" /> },
];

const RESTAURANT_ADMIN_ITEMS: NavItem[] = [
  { id: "admin-dashboard", href: "/restaurant-admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "admin-orders", href: "/restaurant-admin/orders", label: "Active orders", icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "admin-queries", href: "/restaurant-admin/queries", label: "Queries", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "admin-managers", href: "/restaurant-admin/managers", label: "Managers", icon: <Users className="w-4 h-4" /> },
  { id: "admin-performance", href: "/restaurant-admin/performance", label: "Performance", icon: <BarChart3 className="w-4 h-4" /> },
];

const RESTAURANT_MANAGER_ITEMS: NavItem[] = [
  { id: "manager-queries", href: "/restaurant-manager", label: "Active queries", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "manager-products", href: "/restaurant-manager/products", label: "Products", icon: <UtensilsCrossed className="w-4 h-4" /> },
  { id: "manager-orders", href: "/restaurant-manager/orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
];

// Customer items - these will be prefixed with restaurant slug when navigating
const CUSTOMER_ITEMS: NavItem[] = [
  { id: "customer-menu", href: "/menu", label: "Menu", icon: <MenuSquare className="w-4 h-4" /> },
  { id: "customer-cart", href: "/cart", label: "Cart", icon: <ShoppingCart className="w-4 h-4" /> },
  { id: "customer-orders", href: "/orders", label: "Order history", icon: <History className="w-4 h-4" /> },
  { id: "customer-queries", href: "/queries", label: "My queries", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "customer-profile", href: "/profile", label: "Profile", icon: <User className="w-4 h-4" /> },
];

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Extract restaurant slug from pathname
 * /{slug} → "slug"
 * /{slug}/menu → "slug"
 * /restaurant-admin → null
 */
function extractRestaurantSlug(pathname: string): string | null {
  // Exclude non-restaurant routes
  const excludedPrefixes = [
    "/restaurant-admin",
    "/restaurant-manager",
    "/restaurant-superadmin",
    "/root-admin",
    "/login",
    "/api",
  ];

  if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // Match /{slug} or /{slug}/... pattern
  const match = pathname.match(/^\/([^/]+)(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * Construct navigation URL based on context
 * - For customers on restaurant: /{slug}{basePath}
 * - For others: {basePath}
 */
function getNavigationUrl(basePath: string, restaurantSlug: string | null, isCustomer: boolean): string {
  if (restaurantSlug && isCustomer) {
    return `/${restaurantSlug}${basePath}`;
  }
  return basePath;
}

/**
 * Determine if a route is active based on pathname and context
 * Checks for EXACT match only - no partial matches
 */
function isRouteActive(
  pathname: string,
  itemHref: string,
  restaurantSlug: string | null,
  isCustomer: boolean
): boolean {
  if (isCustomer && restaurantSlug) {
    const expectedPath = `/${restaurantSlug}${itemHref}`;
    return pathname === expectedPath;
  }

  return pathname === itemHref;
}

/**
 * Get navigation items based on user role
 */
function getNavItems(appUser: AppUser, cartCount: number): NavItem[] {
  if (appUser.role === "root_admin") {
    return ROOT_ADMIN_ITEMS;
  }

  if (appUser.role === "customer") {
    return CUSTOMER_ITEMS.map((item) =>
      item.id === "customer-cart"
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

/**
 * Get display label for user role
 */
function getRoleLabel(appUser: AppUser): string {
  if (appUser.role === "root_admin") return "Root Admin";
  if (appUser.role === "customer") return "Ordering";

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) return "Super Admin";
  if (isAdmin) return "Restaurant Admin";
  if (isManager) return "Manager";
  return "";
}

/**
 * Fetch restaurant name based on context
 */
async function fetchRestaurantName(
  appUser: AppUser,
  slug: string | null
): Promise<string | null> {
  try {
    // Customer: fetch by slug
    if (slug && appUser.role === "customer") {
      const restaurant = await getRestaurantBySlug(slug);
      return restaurant?.business_name || null;
    }

    // Admin/Manager: fetch by managed_restaurant
    if (appUser.role !== "customer" && appUser.managed_restaurant) {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/config");
      const snap = await getDoc(doc(db, "restaurants", appUser.managed_restaurant));
      return snap.exists() ? (snap.data() as Restaurant)?.business_name || null : null;
    }

    return null;
  } catch (error) {
    console.error("Error fetching restaurant name:", error);
    return null;
  }
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

  // Extract slug and determine if on restaurant page
  const restaurantSlug = useMemo(() => extractRestaurantSlug(pathname), [pathname]);
  const isOnRestaurantPage = restaurantSlug !== null;

  // Fetch restaurant name when slug or appUser changes
  useEffect(() => {
    if (!appUser) return;

    const load = async () => {
      setLoadingRestaurant(true);
      try {
        const name = await fetchRestaurantName(appUser, restaurantSlug);
        setRestaurantName(name);
      } finally {
        setLoadingRestaurant(false);
      }
    };

    load();
  }, [appUser, restaurantSlug]);

  if (!appUser) return null;

  const navItems = getNavItems(appUser, totalItems);
  const roleLabel = getRoleLabel(appUser);
  const displayName = restaurantName || "RestaurantOS";
  const isCustomer = appUser.role === "customer";

  // Find the active item (ensure only ONE is active)
  const activeItemId = useMemo(() => {
    return navItems.find((item) =>
      isRouteActive(pathname, item.href, restaurantSlug, isCustomer)
    )?.id || null;
  }, [pathname, restaurantSlug, isCustomer, navItems]);

  const handleNavClick = (item: NavItem) => {
    const url = getNavigationUrl(item.href, restaurantSlug, isCustomer);
    push(url);
    onNavigate?.();
  };

  const handleLogout = async () => {
    try {
      restaurantSessionManager.clearAllSessions();
      await logoutUser();
      router.push("/login");
      toast.success("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-screen bg-gray-950 text-gray-300 transition-all duration-300 ease-out overflow-hidden",
          isExpanded ? "lg:w-[20vw] w-[80vw]" : "w-16"
        )}
      >
        {/* Header */}
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
                  <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 hover:bg-gray-800 rounded transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = activeItemId === item.id;

            return (
              <div key={item.id} className="relative group w-full">
                <button
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm relative w-full text-left min-w-0",
                    isActive
                      ? "bg-brand-600 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="flex-shrink-0">{item.icon}</span>

                  {isExpanded && (
                    <>
                      <span className="flex-1 truncate min-w-0">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />}
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

        {/* Logout */}
        <div className="p-2 border-t border-gray-800 flex-shrink-0 overflow-hidden">
          <div className="relative group w-full">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors text-sm min-w-0",
                isExpanded ? "justify-start" : "justify-center"
              )}
              title="Log out"
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
              <p className="text-xs text-gray-500 truncate">{appUser.email}</p>
            </div>
          )}

          {!isExpanded && (
            <div className="mt-2 flex justify-center relative group">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
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