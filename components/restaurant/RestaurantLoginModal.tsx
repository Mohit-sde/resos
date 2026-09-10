"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Timestamp } from "firebase/firestore";
import { setUserDoc } from "@/lib/firebase/services";
import { restaurantSessionManager } from "@/lib/utils/restaurantSessionManager";
import { Button } from "@/components/ui/Button";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import type { Restaurant } from "@/lib/types";

interface RestaurantLoginModalProps {
  restaurant: Restaurant;
  isOpen: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

export function RestaurantLoginModal({
  restaurant,
  isOpen,
  onSuccess,
  onClose,
}: RestaurantLoginModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    if (mode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }

    // Get current user
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Create/update user doc in Firestore
      await setUserDoc(currentUser.uid, {
        email: currentUser.email || email,
        role: "customer", // Default role for new users
        associated_restaurants: [], // Will be updated when they order
        created_at: Timestamp.now(),
      });

      // Create restaurant-specific session
      restaurantSessionManager.setSession(
        restaurant.restaurant_id,
        currentUser.uid
      );

      toast.success(
        mode === "login" ? "Logged in!" : "Account created & logged in!"
      );
      setEmail("");
      setPassword("");
      onSuccess();
    }
  } catch (err: any) {
    const msg = err.message || "Authentication failed";
    setError(msg);
    toast.error(msg);
  } finally {
    setLoading(false);
  }
};

  const isSignup = mode === "signup";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {restaurant.business_name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isSignup
              ? "Create an account to order"
              : "Sign in to place an order"}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:bg-gray-50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:bg-gray-50"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? "Processing..."
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        {/* Mode Toggle */}
        <div className="text-center text-sm text-gray-600">
          {isSignup ? "Already have an account? " : "No account yet? "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError(null);
            }}
            disabled={loading}
            className="font-semibold text-brand-600 hover:text-brand-700 disabled:text-gray-400"
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}