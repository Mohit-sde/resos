"use client";

import { formatDate, QUERY_STATUS_CONFIG, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { MessageSquare, User, Clock, Hash } from "lucide-react";
import type { CustomerQuery, QueryStatus } from "@/lib/types";

interface QueryCardProps {
  query: CustomerQuery;
  onClick?: () => void;
  compact?: boolean;
}

const statusVariantMap: Record<
  QueryStatus,
  "info" | "warning" | "success" | "neutral"
> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export function QueryCard({ query, onClick, compact = false }: QueryCardProps) {
  const cfg = QUERY_STATUS_CONFIG[query.status];

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border transition-shadow",
        cfg.border,
        onClick && "cursor-pointer hover:shadow-md",
        compact ? "p-4" : "p-5"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-mono">
              #{query.query_id.slice(-6).toUpperCase()}
            </span>
            <Badge variant={statusVariantMap[query.status]} dot>
              {cfg.label}
            </Badge>
            {query.order_id && (
              <Badge variant="neutral" className="text-xs">
                <Hash className="w-3 h-3" />
                Order linked
              </Badge>
            )}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-gray-900 truncate">
            {query.subject}
          </h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-gray-400">{formatDate(query.created_at)}</p>
        </div>
      </div>

      {/* Description */}
      {!compact && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {query.description}
        </p>
      )}

      {/* Footer meta */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
        {query.customer_email && (
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {query.customer_email}
          </span>
        )}
        {query.assigned_manager_name && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {query.assigned_manager_name}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          {query.remarks.length} remark{query.remarks.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
