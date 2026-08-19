import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { RestaurantProvider } from "@/context/RestaurantContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "RestaurantOS — ERP Platform",
  description: "Multi-tenant restaurant management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RestaurantProvider>
            <CartProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontFamily: "Inter, system-ui, sans-serif",
                  },
                }}
              />
            </CartProvider>
          </RestaurantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
