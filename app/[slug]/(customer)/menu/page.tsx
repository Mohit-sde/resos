"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Leaf, Flame, UtensilsCrossed } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductPage } from "@/components/product/ProductPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getMenuProducts, getRestaurant } from "@/lib/firebase/services";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { MenuProduct, Restaurant } from "@/lib/types";

export default function MenuPage() {
  const { appUser } = useAuth();
  const { totalItems } = useCart();
  const router = useRouter();
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [vegFilter, setVegFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");
  const [detailProduct, setDetailProduct] = useState<MenuProduct | null>(null);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    Promise.all([getMenuProducts(restaurantId), getRestaurant(restaurantId)])
      .then(([p, r]) => { setProducts(p); setRestaurant(r); })
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))];
    return ["ALL", ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    let p = products.filter((x) => x.is_available);
    if (categoryFilter !== "ALL") p = p.filter((x) => x.category === categoryFilter);
    if (vegFilter === "VEG") p = p.filter((x) => x.is_veg);
    if (vegFilter === "NON_VEG") p = p.filter((x) => !x.is_veg);
    if (search.trim()) {
      const s = search.toLowerCase();
      p = p.filter((x) => x.name.toLowerCase().includes(s) || x.description?.toLowerCase().includes(s));
    }
    return p;
  }, [products, categoryFilter, vegFilter, search]);

  const groupedByCategory = useMemo(() => {
    if (categoryFilter !== "ALL") return { [categoryFilter]: filtered };
    const groups: Record<string, MenuProduct[]> = {};
    filtered.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [filtered, categoryFilter]);

  if (detailProduct) {
    return (
      <DashboardShell title={detailProduct.name} subtitle={restaurant?.business_name}
        actions={
          <Button variant="secondary" size="sm" icon={<ShoppingCart className="w-4 h-4" />}
            onClick={() => router.push("/cart")}>
            Cart {totalItems > 0 && `(${totalItems})`}
          </Button>
        }>
        <ProductPage product={detailProduct} restaurantId={restaurantId} mode="customer"
          onBack={() => setDetailProduct(null)} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={restaurant?.business_name ?? "Menu"}
      subtitle={restaurant ? (restaurant.is_open ? "Open for orders" : "Currently closed") : "Browse our menu"}
      actions={
        <Button variant="primary" size="sm" icon={<ShoppingCart className="w-4 h-4" />}
          onClick={() => router.push("/cart")}>
          Cart {totalItems > 0 && `(${totalItems})`}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Restaurant status */}
        {restaurant && (
          <div className={cn("rounded-xl px-4 py-3 flex items-center gap-2",
            restaurant.is_open ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100")}>
            <div className={cn("w-2 h-2 rounded-full", restaurant.is_open ? "bg-green-500" : "bg-red-400")} />
            <span className={cn("text-sm font-medium", restaurant.is_open ? "text-green-700" : "text-red-600")}>
              {restaurant.is_open ? "Restaurant is open — accepting orders" : "Restaurant is currently closed"}
            </span>
          </div>
        )}

        {/* Search + filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input placeholder="Search dishes…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {/* Veg filter */}
          <div className="flex gap-2">
            {(["ALL", "VEG", "NON_VEG"] as const).map((f) => (
              <button key={f} onClick={() => setVegFilter(f)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  vegFilter === f ? "bg-brand-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}>
                {f === "VEG" && <Leaf className="w-3.5 h-3.5" />}
                {f === "NON_VEG" && <Flame className="w-3.5 h-3.5" />}
                {f === "ALL" ? "All" : f === "VEG" ? "Veg only" : "Non-veg"}
              </button>
            ))}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={cn("flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  categoryFilter === c ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid grouped by category */}
        {loading ? <CardSkeleton count={6} /> :
          filtered.length === 0 ? (
            <EmptyState icon={<UtensilsCrossed className="w-6 h-6" />}
              title="No dishes found"
              description="Try adjusting your filters or search." />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByCategory).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{category}</h2>
                    <Badge variant="neutral">{items.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((p) => (
                      <ProductCard key={p.product_id} product={p} mode="customer"
                        onClick={() => setDetailProduct(p)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </DashboardShell>
  );
}
