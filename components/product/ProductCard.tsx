"use client";

import Image from "next/image";
import { Clock, Leaf, Flame, Tag, Eye, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, discountedPrice, cn } from "@/lib/utils";
import type { MenuProduct } from "@/lib/types";

interface ProductCardProps {
  product: MenuProduct;
  mode: "customer" | "manager";
  onClick?: () => void;
  onEdit?: () => void;
}

export function ProductCard({ product, mode, onClick, onEdit }: ProductCardProps) {
  const finalPrice = discountedPrice(product.price, product.discount_percent);
  const hasDiscount = product.discount_percent > 0;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col transition-shadow hover:shadow-md",
        !product.is_available && mode === "customer" && "opacity-60"
      )}
    >
      {/* Image */}
      <div
        className="relative h-40 bg-gray-100 cursor-pointer"
        onClick={onClick}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🍽️
          </div>
        )}
        {/* Veg dot */}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center",
              product.is_veg
                ? "border-green-600 bg-white"
                : "border-red-600 bg-white"
            )}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                product.is_veg ? "bg-green-600" : "bg-red-600"
              )}
            />
          </span>
        </div>
        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-2 right-2">
            <Badge variant="success" className="gap-1">
              <Tag className="w-3 h-3" />
              {product.discount_percent}%
            </Badge>
          </div>
        )}
        {/* Unavailable overlay */}
        {!product.is_available && (
          <div className="absolute inset-0 bg-black/30 flex items-end p-2">
            <Badge variant="danger">Unavailable</Badge>
          </div>
        )}
        {/* Manager availability badge */}
        {mode === "manager" && product.is_available && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="success" dot>
              Live
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-sm font-semibold text-gray-900 leading-tight cursor-pointer hover:text-brand-600 transition-colors"
              onClick={onClick}
            >
              {product.name}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{product.category}</p>
          {product.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{product.preparation_time} min</span>
          <span className="ml-auto">
            {product.is_veg ? (
              <span className="flex items-center gap-0.5 text-green-600">
                <Leaf className="w-3.5 h-3.5" /> Veg
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-red-600">
                <Flame className="w-3.5 h-3.5" /> Non-veg
              </span>
            )}
          </span>
        </div>

        {/* Price + action */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div>
            <span className="text-base font-bold text-gray-900">
              {formatCurrency(finalPrice)}
            </span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs text-gray-400 line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
          {mode === "customer" ? (
            <Button
              size="sm"
              variant="primary"
              disabled={!product.is_available}
              onClick={onClick}
            >
              View
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon={<Eye className="w-3.5 h-3.5" />}
                onClick={onClick}
              >
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={onEdit}
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
