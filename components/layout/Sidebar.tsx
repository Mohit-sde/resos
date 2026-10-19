"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { logoutUser, getRestaurantBySlug } from "@/lib/firebase/services";
import { useNavigationLoading } from "../../lib/hooks/useNavigation";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import type { AppUser, Restaurant } from "@/lib/types";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { restaurantSessionManager } from "@/lib/utils/restaurantSessionManager";

interface NavItem {
  id: string; // Stable unique key
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// ─── Navigation items (module-level constants, created once) ────────────────

const ICON = "w-4 h-4";

const ROOT_ADMIN_ITEMS: NavItem[] = [
  { id: "root-restaurants", href: "/root-admin", label: "Restaurants", icon: <Store className={ICON} /> },
  { id: "root-users", href: "/root-admin/users", label: "Users", icon: <Users className={ICON} /> },
];

const RESTAURANT_ADMIN_ITEMS: NavItem[] = [
  { id: "admin-dashboard", href: "/restaurant-admin", label: "Dashboard", icon: <LayoutDashboard className={ICON} /> },
  { id: "admin-orders", href: "/restaurant-admin/orders", label: "Active orders", icon: <ShoppingBag className={ICON} /> },
  { id: "admin-queries", href: "/restaurant-admin/queries", label: "Queries", icon: <MessageSquare className={ICON} /> },
  { id: "admin-managers", href: "/restaurant-admin/managers", label: "Managers", icon: <Users className={ICON} /> },
  { id: "admin-performance", href: "/restaurant-admin/performance", label: "Performance", icon: <BarChart3 className={ICON} /> },
];

const RESTAURANT_MANAGER_ITEMS: NavItem[] = [
  { id: "manager-queries", href: "/restaurant-manager", label: "Active queries", icon: <ClipboardList className={ICON} /> },
  { id: "manager-products", href: "/restaurant-manager/products", label: "Products", icon: <UtensilsCrossed className={ICON} /> },
  { id: "manager-orders", href: "/restaurant-manager/orders", label: "Orders", icon: <ShoppingBag className={ICON} /> },
];

const ADMIN_AND_MANAGER_ITEMS: NavItem[] = [...RESTAURANT_ADMIN_ITEMS, ...RESTAURANT_MANAGER_ITEMS];

// Customer items - prefixed with restaurant slug when navigating
const CUSTOMER_ITEMS: NavItem[] = [
  { id: "customer-menu", href: "/menu", label: "Menu", icon: <MenuSquare className={ICON} /> },
  { id: "customer-cart", href: "/cart", label: "Cart", icon: <ShoppingCart className={ICON} /> },
  { id: "customer-orders", href: "/orders", label: "Order history", icon: <History className={ICON} /> },
  { id: "customer-queries", href: "/queries", label: "My queries", icon: <MessageSquare className={ICON} /> },
  { id: "customer-profile", href: "/profile", label: "Profile", icon: <User className={ICON} /> },
];

const EXCLUDED_PREFIXES = [
  "/restaurant-admin",
  "/restaurant-manager",
  "/restaurant-superadmin",
  "/root-admin",
  "/login",
  "/api",
] as const;

const SLUG_REGEX = /^\/([^/]+)(?:\/|$)/;

const TOOLTIP_CLASS =
  "absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-50";

// ─── Helper functions ───────────────────────────────────────────────────────

/** /{slug} or /{slug}/... → "slug"; non-restaurant routes → null */
function extractRestaurantSlug(pathname: string): string | null {
  if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  return SLUG_REGEX.exec(pathname)?.[1] ?? null;
}

/** Customers on a restaurant get /{slug}{basePath}; everyone else gets basePath */
function getNavigationUrl(basePath: string, slug: string | null, isCustomer: boolean): string {
  return slug && isCustomer ? `/${slug}${basePath}` : basePath;
}

/** EXACT match only - no partial matches */
function isRouteActive(
  pathname: string,
  itemHref: string,
  slug: string | null,
  isCustomer: boolean
): boolean {
  return pathname === getNavigationUrl(itemHref, slug, isCustomer);
}

function getRoleFlags(appUser: AppUser) {
  const roles = appUser.roles ?? [];
  return {
    isAdmin: roles.includes("restaurant_admin"),
    isManager: roles.includes("restaurant_manager"),
  };
}

function getNavItems(appUser: AppUser, cartCount: number): NavItem[] {
  if (appUser.role === "root_admin") return ROOT_ADMIN_ITEMS;

  if (appUser.role === "customer") {
    const badge = cartCount > 0 ? cartCount : undefined;
    return CUSTOMER_ITEMS.map((item) =>
      item.id === "customer-cart" ? { ...item, badge } : item
    );
  }

  const { isAdmin, isManager } = getRoleFlags(appUser);
  if (isAdmin && isManager) return ADMIN_AND_MANAGER_ITEMS;
  if (isAdmin) return RESTAURANT_ADMIN_ITEMS;
  if (isManager) return RESTAURANT_MANAGER_ITEMS;
  return [];
}

function getRoleLabel(appUser: AppUser): string {
  if (appUser.role === "root_admin") return "Root Admin";
  if (appUser.role === "customer") return "Ordering";

  const { isAdmin, isManager } = getRoleFlags(appUser);
  if (isAdmin && isManager) return "Super Admin";
  if (isAdmin) return "Restaurant Admin";
  if (isManager) return "Manager";
  return "";
}

/** Fetch restaurant name based on role + context */
async function fetchRestaurantName(
  role: AppUser["role"],
  managedRestaurant: string | null | undefined,
  slug: string | null
): Promise<string | null> {
  try {
    // Customer: fetch by slug
    if (slug && role === "customer") {
      const restaurant = await getRestaurantBySlug(slug);
      return restaurant?.business_name || null;
    }

    // Admin/Manager: fetch by managed_restaurant
    if (role !== "customer" && managedRestaurant) {
      const [{ getDoc, doc }, { db }] = await Promise.all([
        import("firebase/firestore"),
        import("@/lib/firebase/config"),
      ]);
      const snap = await getDoc(doc(db, "restaurants", managedRestaurant));
      return snap.exists() ? (snap.data() as Restaurant)?.business_name || null : null;
    }

    return null;
  } catch (error) {
    console.error("Error fetching restaurant name:", error);
    return null;
  }
}

// ─── Small presentational pieces ────────────────────────────────────────────

function Badge({ count, className }: { count: number; className: string }) {
  return (
    <span className={cn("rounded-full bg-red-500 text-white text-xs flex items-center justify-center", className)}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: (item: NavItem) => void;
}

const NavButton = memo(function NavButton({ item, isActive, isExpanded, onSelect }: NavButtonProps) {
  return (
    <div className="relative group w-full">
      <button
        onClick={() => onSelect(item)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm relative w-full text-left min-w-0",
          isActive
            ? "bg-brand-600 text-white"
            : "text-gray-400 hover:bg-gray-800 hover:text-white"
        )}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>

        {isExpanded && (
          <>
            <span className="flex-1 truncate min-w-0">{item.label}</span>
            {item.badge !== undefined && (
              <Badge count={item.badge} className="w-5 h-5 flex-shrink-0" />
            )}
            {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />}
          </>
        )}

        {!isExpanded && item.badge !== undefined && (
          <Badge count={item.badge} className="absolute top-1 right-1 w-4 h-4" />
        )}
      </button>

      {!isExpanded && <div className={TOOLTIP_CLASS}>{item.label}</div>}
    </div>
  );
});

// ─── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  // ALL hooks must run on every render, before any early return.
  const pathname = usePathname();
  const router = useRouter();
  const { appUser } = useAuth();
  const { totalItems } = useCart();
  const { isPending, push } = useNavigationLoading();
  const [isExpanded, setIsExpanded] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);

  // Primitive values keep effect/memo dependencies stable
  const role = appUser?.role;
  const managedRestaurant = appUser?.managed_restaurant;
  const isCustomer = role === "customer";

  const restaurantSlug = useMemo(() => extractRestaurantSlug(pathname), [pathname]);

  // Fetch restaurant name (with cancellation to avoid stale/unmounted updates)
  useEffect(() => {
    if (!role) return;

    let cancelled = false;
    setLoadingRestaurant(true);

    fetchRestaurantName(role, managedRestaurant, restaurantSlug).then((name) => {
      if (cancelled) return;
      setRestaurantName(name);
      setLoadingRestaurant(false);
    });

    return () => {
      cancelled = true;
    };
  }, [role, managedRestaurant, restaurantSlug]);

  const navItems = useMemo(
    () => (appUser ? getNavItems(appUser, totalItems) : []),
    [appUser, totalItems]
  );

  // Ensure only ONE item is active
  const activeItemId = useMemo(
    () =>
      navItems.find((item) => isRouteActive(pathname, item.href, restaurantSlug, isCustomer))?.id ??
      null,
    [navItems, pathname, restaurantSlug, isCustomer]
  );

  const handleNavClick = useCallback(
    (item: NavItem) => {
      push(getNavigationUrl(item.href, restaurantSlug, isCustomer));
      onNavigate?.();
    },
    [push, restaurantSlug, isCustomer, onNavigate]
  );

  const handleLogout = useCallback(async () => {
    try {
      restaurantSessionManager.clearAllSessions();
      await logoutUser();
      router.push("/login");
      toast.success("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  }, [router]);

  // Early return is safe now: every hook above has already been called.
  if (!appUser) return null;

  const roleLabel = getRoleLabel(appUser);
  const displayName = restaurantName || "RestaurantOS";

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
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
              isExpanded={isExpanded}
              onSelect={handleNavClick}
            />
          ))}
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

            {!isExpanded && <div className={TOOLTIP_CLASS}>Log out</div>}
          </div>

          {isExpanded ? (
            <div className="px-3 py-2 mb-2 min-w-0">
              <p className="text-xs text-gray-500 truncate">{appUser.email}</p>
            </div>
          ) : (
            <div className="mt-2 flex justify-center relative group">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                {appUser.email?.charAt(0).toUpperCase()}
              </div>
              <div className={TOOLTIP_CLASS}>{appUser.email}</div>
            </div>
          )}
        </div>
      </aside>

      <LoadingOverlay isLoading={isPending} message="Loading..." />
    </>
  );
}