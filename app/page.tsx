"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/Loading";

export default function RootPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }

    if (appUser.role === "root_admin") {
      router.replace("/root-admin");
      return;
    }
    if (appUser.role === "user") {
      router.replace("/menu");
      return;
    }
    // ─── Restaurant-scoped roles ────────────────────────────────────────
    // restaurant_admin / restaurant_manager are no longer a single value —
    // they live in appUser.roles[], computed from the restaurant doc's
    // admin_uid / manager_uids for this user's managed_restaurant.
    const roles = appUser.roles ?? [];
    const isAdmin = roles.includes("restaurant_admin");
    const isManager = roles.includes("restaurant_manager");
 
    if (isAdmin && isManager) {
      // Dual role at the same restaurant → combined admin+manager sidebar
      router.replace("/restaurant-superadmin");
    } else if (isAdmin) {
      router.replace("/restaurant-admin");
    } else if (isManager) {
      router.replace("/restaurant-manager");
    } else {
      router.replace("/login");
    }
  }, [appUser, loading, router]);

  return <PageLoader />;
}
