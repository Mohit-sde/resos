import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number; // percentage change
  sub?: string;
  accent?: "orange" | "green" | "blue" | "red" | "purple";
  className?: string;
}

const accents = {
  orange: "from-brand-50 to-orange-50 border-brand-100",
  green: "from-green-50 to-emerald-50 border-green-100",
  blue: "from-blue-50 to-indigo-50 border-blue-100",
  red: "from-red-50 to-rose-50 border-red-100",
  purple: "from-purple-50 to-violet-50 border-purple-100",
};

const iconAccents = {
  orange: "bg-brand-100 text-brand-600",
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  red: "bg-red-100 text-red-600",
  purple: "bg-purple-100 text-purple-600",
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  sub,
  accent = "orange",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br border rounded-xl p-5 flex flex-col gap-3",
        accents[accent],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {icon && (
          <span
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              iconAccents[accent]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {(trend !== undefined || sub) && (
          <div className="mt-1 flex items-center gap-1.5">
            {trend !== undefined && (
              <>
                {trend > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                ) : trend < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-gray-400" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend > 0
                      ? "text-green-600"
                      : trend < 0
                      ? "text-red-500"
                      : "text-gray-400"
                  )}
                >
                  {Math.abs(trend)}%
                </span>
              </>
            )}
            {sub && <span className="text-xs text-gray-500">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
