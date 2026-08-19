"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, UtensilsCrossed, Search, LayoutGrid, List, ChevronDown } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductPage } from "@/components/product/ProductPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { 
  getMenuProducts, 
  searchMenuProducts,
  createMenuProduct,
  createMenuProductsBatch
} from "@/lib/firebase/services";
import { cn } from "@/lib/utils";   
import toast from "react-hot-toast";
import type { MenuProduct } from "@/lib/types";

const CATEGORIES = [
  "Starters", "Mains", "Breads", "Rice & Biryani",
  "Desserts", "Beverages", "Soups", "Salads", "Snacks",
];

const EMPTY_PRODUCT = {
  name: "", category: "Starters", price: 0, description: "",
  discount_percent: 0, preparation_time: 15,
  is_veg: true, is_available: true, image_url: "",
};

function AddProductModal({ open, onClose, restaurantId, onAdded }: {
  open: boolean; onClose: () => void;
  restaurantId: string; onAdded: (p: MenuProduct) => void;
}) {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name || form.price <= 0) {
      toast.error("Name and valid price required"); 
      return;
    }
    setSaving(true);
    try {
      const id = await createMenuProduct(restaurantId, { 
        ...form, 
        restaurant_id: restaurantId 
      });
      onAdded({ 
        ...form, 
        product_id: id, 
        restaurant_id: restaurantId 
      } as MenuProduct);
      toast.success("Product added");
      setForm(EMPTY_PRODUCT); 
      onClose();
    } catch (error: any) { 
      toast.error(error.message || "Failed to add product"); 
    }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Add new product"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>Add product</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Product name *" value={form.name}
          onChange={(e) => set("name", e.target.value)} />
        <Select label="Category" value={form.category}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          onChange={(e) => set("category", e.target.value)} />
        <Input label="Price (₹) *" type="number" min={0} value={form.price}
          onChange={(e) => set("price", Number(e.target.value))} />
        <Input label="Discount (%)" type="number" min={0} max={100} value={form.discount_percent}
          onChange={(e) => set("discount_percent", Number(e.target.value))} />
        <Input label="Prep time (min)" type="number" min={1} value={form.preparation_time}
          onChange={(e) => set("preparation_time", Number(e.target.value))} />
        <Input label="Image URL" value={form.image_url}
          onChange={(e) => set("image_url", e.target.value)} />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={form.is_veg}
              onChange={(e) => set("is_veg", e.target.checked)} className="rounded" />
            Vegetarian
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={form.is_available}
              onChange={(e) => set("is_available", e.target.checked)} className="rounded" />
            Available
          </label>
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Description" value={form.description} rows={3}
            onChange={(e) => set("description", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

export default function ManagerProductsPage() {
  const { appUser } = useAuth();
  
  // ─── DATA STATE ──────────────────────────────────────────────────────
  const [allProducts, setAllProducts] = useState<MenuProduct[]>([]); // All fetched products
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // ─── FILTER STATE ────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(""); // Local input (no fetch)
  const [activeSearch, setActiveSearch] = useState(""); // Actual search query (triggers fetch)
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  
  // ─── VIEW STATE ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<MenuProduct | null>(null);
 
  // ─── PAGINATION STATE ────────────────────────────────────────────────
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false); // Track if we're in search mode
 
  const restaurantId = appUser?.managed_restaurant ?? "";
 
  // ─── LOAD INITIAL PRODUCTS (ONCE) ────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) {
      console.warn("⚠️ No restaurant ID available for user");
      setLoading(false);
      setAllProducts([]);
      return;
    }
 
    console.log("📦 Loading products for restaurant:", restaurantId);
    loadInitialProducts();
  }, [restaurantId]);
 
  const loadInitialProducts = useCallback(async () => {
    if (!restaurantId) {
      console.error("❌ Restaurant ID is missing");
      toast.error("Restaurant not found. Please log in again.");
      setLoading(false);
      return;
    }
 
    setLoading(true);
    setIsSearchMode(false);
    setActiveSearch("");
    setSearchInput("");
    setCategoryFilter("ALL");
 
    try {
      console.log("🔄 Fetching initial products...");
      const result = await getMenuProducts(restaurantId);
 
      console.log(
        `✅ Loaded ${result.products.length} products. Has more: ${result.hasMore}`
      );
 
      setAllProducts(result.products);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
 
      if (result.products.length === 0) {
        toast.info("No products on menu yet. Add your first product!");
      }
    } catch (error: any) {
      console.error("❌ Failed to load products:", {
        error: error.message,
        code: error.code,
      });
 
      if (error.code === "permission-denied") {
        toast.error("Permission denied. You cannot access these products.");
      } else if (error.message?.includes("not found")) {
        toast.error("Restaurant not found. Please check your account.");
      } else {
        toast.error(`Failed to load products: ${error.message}`);
      }
 
      setAllProducts([]);
      setLastDoc(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);
 
  // ─── LOAD MORE PRODUCTS (PAGINATION) ──────────────────────────────────
  const loadMoreProducts = useCallback(async () => {
    if (!restaurantId || !lastDoc || loadingMore) {
      console.warn("⚠️ Cannot load more");
      return;
    }
 
    setLoadingMore(true);
    try {
      console.log("🔄 Loading more products...");
      const result = await getMenuProducts(restaurantId, lastDoc);
 
      console.log(
        `✅ Loaded ${result.products.length} more products. Has more: ${result.hasMore}`
      );
 
      setAllProducts((prev) => [...prev, ...result.products]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error: any) {
      console.error("❌ Failed to load more products:", error.message);
      toast.error("Failed to load more products");
    } finally {
      setLoadingMore(false);
    }
  }, [restaurantId, lastDoc, loadingMore]);
 
  // ─── EXECUTE SEARCH (ONLY ON SEARCH BUTTON CLICK) ─────────────────────
  const handleSearchSubmit = useCallback(async () => {
    if (!restaurantId) {
      console.error("❌ Restaurant ID is required for search");
      return;
    }
 
    const query = searchInput.trim();
 
    // If clearing search, reload all products
    if (!query && categoryFilter === "ALL") {
      console.log("🔄 Clearing search, reloading all products");
      loadInitialProducts();
      return;
    }
 
    setLoading(true);
    setIsSearchMode(true);
    setActiveSearch(query);
 
    try {
      console.log("🔍 Searching with filters:", {
        query,
        category: categoryFilter,
      });
 
      // Fetch products filtered by category from DB
      const filtered = await searchMenuProducts(restaurantId, {
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
      });
 
      console.log(`✅ Found ${filtered.length} products from DB`);
 
      // Client-side text search filtering
      if (query) {
        const searchLower = query.toLowerCase();
        const results = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.category.toLowerCase().includes(searchLower) ||
            p.description?.toLowerCase().includes(searchLower)
        );
        console.log(`📍 Client-side filtering: ${results.length} results`);
        setAllProducts(results);
      } else {
        setAllProducts(filtered);
      }
 
      setHasMore(false);
      setLastDoc(null);
 
      if (filtered.length === 0) {
        toast.info("No products match your search criteria");
      }
    } catch (error: any) {
      console.error("❌ Search failed:", error.message);
      toast.error("Search failed. Please try again.");
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, searchInput, categoryFilter, loadInitialProducts]);
 
  // ─── HANDLE CATEGORY CHANGE (CLIENT-SIDE FILTER WHEN POSSIBLE) ────────
  const handleCategoryChange = useCallback(
    (cat: string) => {
      console.log("🏷️ Category filter changed to:", cat);
      setCategoryFilter(cat);
 
      // If in search mode OR if search is active, trigger new search with new category
      if (isSearchMode || searchInput.trim()) {
        console.log("🔄 Retriggering search with new category");
        setActiveSearch(searchInput);
        handleSearchSubmit();
      }
      // If just browsing all products with no search, filter happens in useMemo below
    },
    [isSearchMode, searchInput, handleSearchSubmit]
  );
 
  // ─── GET CATEGORIES (FROM LOADED PRODUCTS) ───────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map((p) => p.category).filter(Boolean))];
    return ["ALL", ...cats.sort()];
  }, [allProducts]);
 
  // ─── APPLY FILTERS CLIENT-SIDE ───────────────────────────────────────
  const displayedProducts = useMemo(() => {
    let filtered = [...allProducts];
 
    // Apply category filter (only if not in search mode)
    if (categoryFilter !== "ALL" && !isSearchMode) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
      console.log(
        `📍 Applied category filter: ${filtered.length} products shown`
      );
    }
 
    return filtered;
  }, [allProducts, categoryFilter, isSearchMode]);
 
  // ─── CALCULATE STATS ─────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      available: displayedProducts.filter((p) => p.is_available).length,
      unavailable: displayedProducts.filter((p) => !p.is_available).length,
      veg: displayedProducts.filter((p) => p.is_veg).length,
    }),
    [displayedProducts]
  );
 
  // If viewing a product detail
  if (detailProduct) {
    return (
      <DashboardShell title="Product detail" subtitle={detailProduct.name}>
        <ProductPage
          product={detailProduct}
          restaurantId={restaurantId}
          mode="manager"
          onBack={() => setDetailProduct(null)}
          onProductUpdated={(updated) => {
            setAllProducts((p) =>
              p.map((x) =>
                x.product_id === updated.product_id ? updated : x
              )
            );
            setDetailProduct(updated);
          }}
          onProductDeleted={(id) => {
            setAllProducts((p) => p.filter((x) => x.product_id !== id));
            setDetailProduct(null);
          }}
        />
      </DashboardShell>
    );
  }
 
  return (
    <DashboardShell
      title="Products"
      subtitle={`${displayedProducts.length} products${isSearchMode ? " found" : " on menu"}`}
      actions={
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-400 hover:text-gray-600"
              )}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-400 hover:text-gray-600"
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setAddOpen(true)}
          >
            Add product
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search + category filters */}
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <input
              placeholder="Search products…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                }
              }}
              className="w-full h-9 pl-9 pr-10 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            />
            <button
              onClick={handleSearchSubmit}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
 
          {/* Category filters - only show if not in search mode */}
          {!isSearchMode && categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => handleCategoryChange(c)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    categoryFilter === c
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
 
          {/* Show active search query */}
          {isSearchMode && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Search results for: <strong>{activeSearch || "all"}</strong>
              </span>
              <button
                onClick={() => loadInitialProducts()}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
 
        {/* Summary badges */}
        {displayedProducts.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="success" dot>
              {stats.available} available
            </Badge>
            <Badge variant="neutral" dot>
              {stats.unavailable} unavailable
            </Badge>
            <Badge variant="info" dot>
              {stats.veg} veg
            </Badge>
          </div>
        )}
 
        {/* Product grid / list */}
        {loading ? (
          <CardSkeleton count={6} />
        ) : !restaurantId ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title="No restaurant found"
            description="Please make sure you're logged in with the correct account."
          />
        ) : displayedProducts.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-6 h-6" />}
            title={isSearchMode ? "No products match" : "No products yet"}
            description={
              isSearchMode
                ? "Try different search terms."
                : "Add your first product to the menu."
            }
            action={
              !isSearchMode && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setAddOpen(true)}
                >
                  Add product
                </Button>
              )
            }
          />
        ) : viewMode === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProducts.map((p) => (
                <ProductCard
                  key={p.product_id}
                  product={p}
                  mode="manager"
                  onClick={() => setDetailProduct(p)}
                  onEdit={() => setDetailProduct(p)}
                />
              ))}
            </div>
            {/* Pagination button - only show if not in search mode */}
            {hasMore && !isSearchMode && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  onClick={loadMoreProducts}
                  loading={loadingMore}
                  icon={<ChevronDown className="w-4 h-4" />}
                >
                  Load more products
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Name", "Category", "Price", "Veg", "Status"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map((p) => (
                    <tr
                      key={p.product_id}
                      onClick={() => setDetailProduct(p)}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3 text-gray-900">₹{p.price}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_veg ? "success" : "danger"}>
                          {p.is_veg ? "Veg" : "Non-veg"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={p.is_available ? "success" : "neutral"}
                          dot
                        >
                          {p.is_available ? "Available" : "Unavailable"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination button - only show if not in search mode */}
            {hasMore && !isSearchMode && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  onClick={loadMoreProducts}
                  loading={loadingMore}
                  icon={<ChevronDown className="w-4 h-4" />}
                >
                  Load more products
                </Button>
              </div>
            )}
          </>
        )}
      </div>
 
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        restaurantId={restaurantId}
        onAdded={(p) => {
          console.log("✅ Product added:", p.product_id);
          // Only add to list if not in search mode
          if (!isSearchMode) {
            setAllProducts((prev) => [p, ...prev]);
          } else {
            // If in search mode, optionally reload to show new product
            // Or just reload initial products to exit search mode
            loadInitialProducts();
          }
          toast.success("Product added successfully!");
        }}
      />
    </DashboardShell>
  );
}