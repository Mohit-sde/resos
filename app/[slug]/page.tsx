"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UtensilsCrossed, MapPin, Phone, Clock, ShoppingCart, Leaf, Flame, Search, Star } from "lucide-react";
import { getRestaurantBySlug, getMenuProducts } from "@/lib/firebase/services";
import { useCart } from "@/context/CartContext";
import { useRestaurant } from "@/context/RestaurantContext";
import { formatCurrency, discountedPrice, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageLoader, CardSkeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import toast from "react-hot-toast";
import type { Restaurant, MenuProduct } from "@/lib/types";

// ─── Public Product Card (no auth needed) ──────────────────────────────────────
function PublicProductCard({
  product,
  onAdd,
}: {
  product: MenuProduct;
  onAdd: (p: MenuProduct) => void;
}) {
  const finalPrice = discountedPrice(product.price, product.discount_percent);
  const hasDiscount = product.discount_percent > 0;

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow",
      !product.is_available && "opacity-60"
    )}>
      <div className="relative h-36 bg-gray-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🍽️</div>
        )}
        <div className="absolute top-2 left-2">
          <span className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center bg-white",
            product.is_veg ? "border-green-600" : "border-red-600"
          )}>
            <span className={cn("w-2 h-2 rounded-full", product.is_veg ? "bg-green-600" : "bg-red-600")} />
          </span>
        </div>
        {hasDiscount && (
          <div className="absolute top-2 right-2">
            <span className="bg-green-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-md">
              {product.discount_percent}% OFF
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{product.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>
          {product.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          {product.preparation_time} min
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div>
            <span className="text-base font-bold text-gray-900">{formatCurrency(finalPrice)}</span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs text-gray-400 line-through">{formatCurrency(product.price)}</span>
            )}
          </div>
          <Button size="sm" variant="primary" disabled={!product.is_available} onClick={() => onAdd(product)}>
            {product.is_available ? "Add" : "N/A"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Mini cart drawer ──────────────────────────────────────────────────────────
function MiniCart({ onCheckout }: { onCheckout: () => void }) {
  const { items, totalItems, subtotal, removeItem, updateQty } = useCart();
  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold">{totalItems} item{totalItems !== 1 ? "s" : ""} in cart</p>
          <p className="text-xs text-gray-300">{formatCurrency(subtotal)}</p>
        </div>
        <Button variant="primary" size="sm" onClick={onCheckout}>
          View cart →
        </Button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function RestaurantSlugPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { addItem, setRestaurantId } = useCart();
  const { setActiveRestaurant } = useRestaurant();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [vegFilter, setVegFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");

  useEffect(() => {
    if (!slug) return;
    getRestaurantBySlug(slug).then(async (r) => {
      if (!r) { setNotFound(true); setLoading(false); return; }
      setRestaurant(r);
      setActiveRestaurant(r);
      setRestaurantId(r.restaurant_id);
      const prods = await getMenuProducts(r.restaurant_id);
      setProducts(prods);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  function handleAddToCart(product: MenuProduct) {
    addItem({
      product_id: product.product_id,
      name: product.name,
      price: product.price,
      quantity: 1,
      is_veg: product.is_veg,
      image_url: product.image_url,
      discount_percent: product.discount_percent,
    });
    toast.success(`${product.name} added!`);
  }

  if (loading) return <PageLoader />;

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <EmptyState
        icon={<UtensilsCrossed className="w-6 h-6" />}
        title="Restaurant not found"
        description={`No restaurant found for "${slug}". Check the URL and try again.`}
        action={<Button variant="secondary" onClick={() => router.push("/")}>Go home</Button>}
      />
    </div>
  );

  // Derived data
  const categories = ["ALL", ...new Set(products.map((p) => p.category))];
  const filtered = products
    .filter((p) => p.is_available)
    .filter((p) => categoryFilter === "ALL" || p.category === categoryFilter)
    .filter((p) => vegFilter === "ALL" || (vegFilter === "VEG" ? p.is_veg : !p.is_veg))
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, MenuProduct[]>);

  const brandColor = restaurant?.branding?.primary_color ?? "#ea580c";

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Hero header */}
      <div className="relative" style={{ backgroundColor: brandColor }}>
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-10">
          <div className="flex items-center gap-4">
            {restaurant?.branding?.logo_url ? (
              <img src={restaurant.branding.logo_url} alt="logo"
                className="w-16 h-16 rounded-2xl object-cover bg-white/20 flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{restaurant?.business_name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <Badge className="bg-white/20 text-white border-0">
                  <Star className="w-3 h-3 fill-white" /> 4.2
                </Badge>
                {restaurant?.cuisine_type && (
                  <span className="text-white/80 text-sm">{restaurant.cuisine_type}</span>
                )}
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  restaurant?.is_open ? "bg-green-400 text-green-900" : "bg-red-300 text-red-900"
                )}>
                  {restaurant?.is_open ? "● Open" : "● Closed"}
                </span>
              </div>
              {restaurant?.address && (
                <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{restaurant.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input placeholder="Search dishes…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
          </div>
          <div className="flex gap-2 items-center overflow-x-auto pb-1">
            {/* Veg toggle */}
            {(["ALL", "VEG", "NON_VEG"] as const).map((f) => (
              <button key={f} onClick={() => setVegFilter(f)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                  vegFilter === f ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"
                )}
                style={vegFilter === f ? { backgroundColor: brandColor } : {}}>
                {f === "VEG" && <Leaf className="w-3 h-3" />}
                {f === "NON_VEG" && <Flame className="w-3 h-3" />}
                {f === "ALL" ? "All" : f === "VEG" ? "Veg" : "Non-veg"}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            {/* Category pills */}
            {categories.map((c) => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  categoryFilter === c ? "text-white" : "bg-gray-100 text-gray-600"
                )}
                style={categoryFilter === c ? { backgroundColor: brandColor } : {}}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {!restaurant?.is_open && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 text-center">
            This restaurant is currently closed. You can browse the menu but ordering is disabled.
          </div>
        )}

        {Object.keys(grouped).length === 0 ? (
          <EmptyState icon={<Search className="w-6 h-6" />}
            title="No dishes found"
            description="Try adjusting your filters." />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">{category}</h2>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((p) => (
                  <PublicProductCard key={p.product_id} product={p}
                    onAdd={restaurant?.is_open ? handleAddToCart : () => toast.error("Restaurant is closed")} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Floating cart bar */}
      <MiniCart onCheckout={() => router.push("/cart")} />
    </div>
  );
}
