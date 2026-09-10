"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Trash2, Plus, Minus, CreditCard,
  Smartphone, Banknote, Calendar, Users, Info, Leaf, Flame,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { createOrder } from "@/lib/firebase/services";
import { formatCurrency, discountedPrice, generateOrderNumber } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { OrderType } from "@/lib/types";

const DELIVERY_CHARGE = 40;
const TAX_RATE = 0.05;

type PaymentMethod = "UPI" | "CASH" | "CARD";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "UPI", label: "UPI / QR", icon: <Smartphone className="w-4 h-4" /> },
  { value: "CARD", label: "Card", icon: <CreditCard className="w-4 h-4" /> },
  { value: "CASH", label: "Cash on delivery", icon: <Banknote className="w-4 h-4" /> },
];

export default function CartPage() {
  const { items, removeItem, updateQty, clearCart, subtotal, restaurantId } = useCart();
  const { appUser } = useAuth();
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [dineInDate, setDineInDate] = useState("");
  const [dineInGuests, setDineInGuests] = useState(2);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  const effectiveDelivery = orderType === "DELIVERY" ? DELIVERY_CHARGE : 0;
  const taxes = Math.round((subtotal + effectiveDelivery) * TAX_RATE);
  const grandTotal = subtotal + effectiveDelivery + taxes;

  async function handlePlaceOrder() {
    if (!appUser || !restaurantId) { toast.error("Please log in first"); return; }
    if (items.length === 0) { toast.error("Cart is empty"); return; }
    if (orderType === "DINE_IN" && !dineInDate) { toast.error("Please select a dine-in date"); return; }

    setPlacing(true);
    try {
      const orderId = await createOrder(restaurantId, {
        customer_id: appUser.uid,
        customer_email: appUser.email,
        order_number: generateOrderNumber(),
        restaurant_id: restaurantId,
        order_type: orderType,
        status: "PLACED",
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          price: discountedPrice(i.price, i.discount_percent),
          quantity: i.quantity,
          is_veg: i.is_veg,
        })),
        billing: {
          item_total: subtotal,
          delivery_charge: effectiveDelivery,
          taxes,
          grand_total: grandTotal,
        },
        payment_method: paymentMethod,
        ...(orderType === "DINE_IN" && { dine_in_date: dineInDate, dine_in_guests: dineInGuests }),
        ...(specialInstructions && { special_instructions: specialInstructions }),
      });
      clearCart();
      setSuccessOrder(orderId);
    } catch { toast.error("Failed to place order. Try again."); }
    finally { setPlacing(false); }
  }

  if (successOrder) {
    return (
      <DashboardShell title="Order placed!">
        <div className="max-w-sm mx-auto text-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Order confirmed</h2>
          <p className="text-gray-500 text-sm">Your order has been placed and the kitchen has been notified.</p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="primary" onClick={() => router.push("/orders")}>
              Track your order
            </Button>
            <Button variant="secondary" onClick={() => router.push("/menu")}>
              Continue browsing
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Cart" subtitle={`${items.length} item${items.length !== 1 ? "s" : ""}`}>
      {items.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="w-6 h-6" />}
          title="Your cart is empty"
          description="Add items from the menu to get started."
          action={<Button variant="primary" onClick={() => router.push("/menu")}>Browse menu</Button>} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Items</h2>
            {items.map((item) => {
              const itemPrice = discountedPrice(item.price, item.discount_percent);
              return (
                <div key={item.product_id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full rounded-xl object-cover" />
                    ) : "🍽️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {item.is_veg
                            ? <Leaf className="w-3.5 h-3.5 text-green-500" />
                            : <Flame className="w-3.5 h-3.5 text-red-500" />}
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        </div>
                        <p className="text-sm text-gray-900 mt-0.5 font-semibold">
                          {formatCurrency(itemPrice * item.quantity)}
                        </p>
                        {item.discount_percent > 0 && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        )}
                      </div>
                      <button onClick={() => removeItem(item.product_id)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Special instructions */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <Textarea label="Special instructions (optional)" value={specialInstructions}
                rows={2} placeholder="Allergies, spice level, etc."
                onChange={(e) => setSpecialInstructions(e.target.value)} />
            </div>
          </div>

          {/* Order summary + checkout */}
          <div className="space-y-4">
            {/* Order type */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Order type</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["DELIVERY", "TAKEAWAY", "DINE_IN"] as OrderType[]).map((t) => (
                  <button key={t} onClick={() => setOrderType(t)}
                    className={cn("py-2 px-2 rounded-xl border text-xs font-medium transition-all",
                      orderType === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                    {t === "DINE_IN" ? "Dine In" : t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {orderType === "DINE_IN" && (
                <div className="space-y-3 pt-1">
                  <Input label="Dine-in date & time" type="datetime-local" value={dineInDate}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setDineInDate(e.target.value)} />
                  <Input label="Number of guests" type="number" min={1} max={20} value={dineInGuests}
                    onChange={(e) => setDineInGuests(Number(e.target.value))} />
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Payment method</h3>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setPaymentMethod(opt.value)}
                    className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all",
                      paymentMethod === opt.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-700 hover:border-gray-300")}>
                    {opt.icon}
                    {opt.label}
                    {paymentMethod === opt.value && (
                      <span className="ml-auto w-4 h-4 rounded-full border-2 border-brand-500 bg-brand-500 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bill summary */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Bill summary</h3>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Item total</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {orderType === "DELIVERY" && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery charge</span><span>{formatCurrency(effectiveDelivery)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>Taxes (5%)</span><span>{formatCurrency(taxes)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Grand total</span><span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <Button variant="primary" loading={placing} onClick={handlePlaceOrder} className="w-full h-11">
              {orderType === "DINE_IN" ? "Book dine-in" : "Place order"} — {formatCurrency(grandTotal)}
            </Button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
