"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { Restaurant } from "@/lib/types";

interface RestaurantContextValue {
  activeRestaurant: Restaurant | null;
  setActiveRestaurant: (r: Restaurant | null) => void;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  activeRestaurant: null,
  setActiveRestaurant: () => {},
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(null);
  return (
    <RestaurantContext.Provider value={{ activeRestaurant, setActiveRestaurant }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantContext);
