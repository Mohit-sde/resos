"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  restaurantId: string | null;
  setRestaurantId: (id: string) => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQty: () => {},
  clearCart: () => {},
  totalItems: 0,
  subtotal: 0,
  restaurantId: null,
  setRestaurantId: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("erp_cart");
    const rid = localStorage.getItem("erp_cart_rid");
    if (saved) setItems(JSON.parse(saved));
    if (rid) setRestaurantId(rid);
  }, []);

  useEffect(() => {
    localStorage.setItem("erp_cart", JSON.stringify(items));
  }, [items]);

  function addItem(item: CartItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === item.product_id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += item.quantity;
        return updated;
      }
      return [...prev, item];
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) return removeItem(productId);
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i))
    );
  }

  function clearCart() {
    setItems([]);
    localStorage.removeItem("erp_cart");
  }

  function handleSetRestaurantId(id: string) {
    setRestaurantId(id);
    localStorage.setItem("erp_cart_rid", id);
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => {
    const discounted = i.price * (1 - i.discount_percent / 100);
    return s + discounted * i.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        subtotal,
        restaurantId,
        setRestaurantId: handleSetRestaurantId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
