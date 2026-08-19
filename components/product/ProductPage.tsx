"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Clock,
  Leaf,
  Flame,
  Star,
  ShoppingCart,
  Plus,
  Minus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { formatCurrency, discountedPrice, cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { updateMenuProduct, deleteMenuProduct } from "@/lib/firebase/services";
import toast from "react-hot-toast";
import type { MenuProduct } from "@/lib/types";

// ─── Mode types ───────────────────────────────────────────────────────────────
type ProductPageMode = "customer" | "manager";

interface ProductPageProps {
  product: MenuProduct;
  restaurantId: string;
  mode: ProductPageMode;
  onBack?: () => void;
  onProductUpdated?: (updated: MenuProduct) => void;
  onProductDeleted?: (productId: string) => void;
}

// ─── Customer quantity selector ───────────────────────────────────────────────
function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-6 text-center font-medium text-gray-900">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Edit product form ─────────────────────────────────────────────────────────
function EditProductModal({
  product,
  restaurantId,
  open,
  onClose,
  onSaved,
}: {
  product: MenuProduct;
  restaurantId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (p: MenuProduct) => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    price: String(product.price),
    description: product.description,
    discount_percent: String(product.discount_percent),
    preparation_time: String(product.preparation_time),
    is_veg: product.is_veg,
    is_available: product.is_available,
  });
  const [saving, setSaving] = useState(false);

  const CATEGORIES = [
    { value: "Starters", label: "Starters" },
    { value: "Mains", label: "Mains" },
    { value: "Breads", label: "Breads" },
    { value: "Rice & Biryani", label: "Rice & Biryani" },
    { value: "Desserts", label: "Desserts" },
    { value: "Beverages", label: "Beverages" },
    { value: "Soups", label: "Soups" },
    { value: "Salads", label: "Salads" },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      const updated: Partial<MenuProduct> = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        description: form.description,
        discount_percent: Number(form.discount_percent),
        preparation_time: Number(form.preparation_time),
        is_veg: form.is_veg,
        is_available: form.is_available,
      };
      await updateMenuProduct(restaurantId, product.product_id, updated);
      onSaved({ ...product, ...updated });
      toast.success("Product updated");
      onClose();
    } catch {
      toast.error("Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit product"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Product name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <Select
          label="Category"
          value={form.category}
          options={CATEGORIES}
          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
        />
        <Input
          label="Price (₹)"
          type="number"
          min={0}
          value={form.price}
          onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
        />
        <Input
          label="Discount (%)"
          type="number"
          min={0}
          max={100}
          value={form.discount_percent}
          onChange={(e) =>
            setForm((p) => ({ ...p, discount_percent: e.target.value }))
          }
        />
        <Input
          label="Prep time (minutes)"
          type="number"
          min={1}
          value={form.preparation_time}
          onChange={(e) =>
            setForm((p) => ({ ...p, preparation_time: e.target.value }))
          }
        />
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-gray-700">Options</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_veg}
              onChange={(e) => setForm((p) => ({ ...p, is_veg: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Vegetarian</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) =>
                setForm((p) => ({ ...p, is_available: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm text-gray-700">Available for order</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <Textarea
            label="Description"
            value={form.description}
            rows={3}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main ProductPage component ────────────────────────────────────────────────
export function ProductPage({
  product: initialProduct,
  restaurantId,
  mode,
  onBack,
  onProductUpdated,
  onProductDeleted,
}: ProductPageProps) {
  const [product, setProduct] = useState<MenuProduct>(initialProduct);
  const [qty, setQty] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { addItem, setRestaurantId } = useCart();

  const finalPrice = discountedPrice(product.price, product.discount_percent);
  const hasDiscount = product.discount_percent > 0;

  function handleAddToCart() {
    setRestaurantId(restaurantId);
    addItem({
      product_id: product.product_id,
      name: product.name,
      price: product.price,
      quantity: qty,
      is_veg: product.is_veg,
      image_url: product.image_url,
      discount_percent: product.discount_percent,
    });
    toast.success(`${product.name} added to cart`);
  }

  async function handleToggleAvailability() {
    setToggling(true);
    try {
      const updated = { ...product, is_available: !product.is_available };
      await updateMenuProduct(restaurantId, product.product_id, {
        is_available: updated.is_available,
      });
      setProduct(updated);
      onProductUpdated?.(updated);
      toast.success(
        updated.is_available ? "Product marked available" : "Product marked unavailable"
      );
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteMenuProduct(restaurantId, product.product_id);
      onProductDeleted?.(product.product_id);
      toast.success("Product deleted");
      onBack?.();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back nav */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to menu
        </button>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Product image */}
        <div className="relative w-full h-56 bg-gray-100">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-5xl">🍽️</div>
            </div>
          )}
          {/* Veg/Non-veg indicator */}
          <div className="absolute top-3 left-3">
            <span
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold",
                product.is_veg
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              )}
            >
              {product.is_veg ? (
                <Leaf className="w-3 h-3" />
              ) : (
                <Flame className="w-3 h-3" />
              )}
              {product.is_veg ? "Veg" : "Non-veg"}
            </span>
          </div>
          {/* Unavailable overlay */}
          {!product.is_available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 text-sm font-semibold px-4 py-2 rounded-lg">
                Currently unavailable
              </span>
            </div>
          )}
          {/* Manager actions */}
          {mode === "manager" && (
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:bg-white shadow-sm transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-600 hover:bg-white shadow-sm transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="p-6 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {product.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="neutral">{product.category}</Badge>
                {!product.is_available && mode === "customer" && (
                  <Badge variant="danger">Unavailable</Badge>
                )}
              </div>
            </div>
            {/* Price block */}
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(finalPrice)}
              </p>
              {hasDiscount && (
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-sm text-gray-400 line-through">
                    {formatCurrency(product.price)}
                  </span>
                  <Badge variant="success" className="text-xs">
                    <Tag className="w-3 h-3" />
                    {product.discount_percent}% off
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {product.preparation_time} min
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              4.2 (mock)
            </span>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>
          )}

          <div className="border-t border-gray-100 pt-4">
            {/* Customer actions */}
            {mode === "customer" && (
              <div className="flex items-center justify-between gap-4">
                <QuantitySelector value={qty} onChange={setQty} />
                <Button
                  variant="primary"
                  icon={<ShoppingCart className="w-4 h-4" />}
                  disabled={!product.is_available}
                  onClick={handleAddToCart}
                  className="flex-1"
                >
                  {product.is_available
                    ? `Add to cart — ${formatCurrency(finalPrice * qty)}`
                    : "Not available"}
                </Button>
              </div>
            )}

            {/* Manager actions */}
            {mode === "manager" && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleAvailability}
                    disabled={toggling}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors",
                      product.is_available ? "text-green-600" : "text-gray-400"
                    )}
                  >
                    {product.is_available ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                    {product.is_available ? "Available" : "Unavailable"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 className="w-4 h-4" />}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    loading={deleting}
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal — manager only */}
      {mode === "manager" && (
        <EditProductModal
          product={product}
          restaurantId={restaurantId}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setProduct(updated);
            onProductUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
}
