"use client";

import { useState } from "react";
import {
  X,
  Clock,
  User,
  Hash,
  MessageSquare,
  ChevronDown,
  Send,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea, Select } from "@/components/ui/Input";
import { formatDate, QUERY_STATUS_CONFIG, cn } from "@/lib/utils";
import { updateQueryStatus } from "@/lib/firebase/services";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import type { CustomerQuery, QueryStatus, AppUser } from "@/lib/types";

interface QueryDetailPanelProps {
  query: CustomerQuery;
  currentUser: AppUser;
  onClose?: () => void;
  onUpdated?: (updated: CustomerQuery) => void;
  embedded?: boolean; // if true, no panel chrome, just content
}

const STATUS_OPTIONS: { value: QueryStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const statusVariantMap: Record<
  QueryStatus,
  "info" | "warning" | "success" | "neutral"
> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

// ─── Remark bubble ─────────────────────────────────────────────────────────────
function RemarkBubble({
  remark,
  isOwn,
}: {
  remark: CustomerQuery["remarks"][0];
  isOwn: boolean;
}) {
  return (
    <div className={cn("flex gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-gray-600 mt-0.5">
        {remark.by_name.charAt(0).toUpperCase()}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5",
          isOwn
            ? "bg-brand-600 text-white rounded-tr-sm"
            : "bg-gray-100 text-gray-800 rounded-tl-sm"
        )}
      >
        <p className="text-sm leading-relaxed">{remark.remark}</p>
        <p
          className={cn(
            "text-xs mt-1",
            isOwn ? "text-brand-200" : "text-gray-400"
          )}
        >
          {remark.by_name} · {formatDate(remark.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function QueryDetailPanel({
  query: initialQuery,
  currentUser,
  onClose,
  onUpdated,
  embedded = false,
}: QueryDetailPanelProps) {
  const [query, setQuery] = useState<CustomerQuery>(initialQuery);
  const [newRemark, setNewRemark] = useState("");
  const [newStatus, setNewStatus] = useState<QueryStatus>(query.status);
  const [submitting, setSubmitting] = useState(false);

  const canUpdateStatus =
    currentUser.role === "restaurant_manager" ||
    currentUser.role === "restaurant_admin";
  const isCustomer = currentUser.role === "customer";

  async function handleSubmitRemark() {
    if (!newRemark.trim()) return;
    setSubmitting(true);
    try {
      const remark = {
        remark: newRemark.trim(),
        by_uid: currentUser.uid,
        by_name:
          currentUser.displayName || currentUser.email.split("@")[0],
        timestamp: Timestamp.now(),
      };
      const statusToSet = canUpdateStatus ? newStatus : query.status;
      await updateQueryStatus(
        query.restaurant_id,
        query.query_id,
        statusToSet,
        remark
      );
      const updated: CustomerQuery = {
        ...query,
        status: statusToSet,
        remarks: [...query.remarks, remark],
      };
      setQuery(updated);
      onUpdated?.(updated);
      setNewRemark("");
      toast.success("Remark added");
    } catch {
      toast.error("Failed to submit remark");
    } finally {
      setSubmitting(false);
    }
  }

  const cfg = QUERY_STATUS_CONFIG[query.status];

  const content = (
    <div className="flex flex-col h-full">
      {/* Query header */}
      <div className={cn("space-y-3", !embedded && "pb-4 border-b border-gray-100")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">
              #{query.query_id.slice(-6).toUpperCase()}
            </span>
            <Badge variant={statusVariantMap[query.status]} dot>
              {cfg.label}
            </Badge>
          </div>
          {onClose && !embedded && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <h2 className="text-base font-semibold text-gray-900">{query.subject}</h2>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {query.customer_email || query.customer_id}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDate(query.created_at)}
          </span>
          {query.order_id && (
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              Order: {query.order_id.slice(-6).toUpperCase()}
            </span>
          )}
          {query.assigned_manager_name && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Assigned: {query.assigned_manager_name}
            </span>
          )}
        </div>

        {/* Original description */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
            Description
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{query.description}</p>
        </div>
      </div>

      {/* Remarks timeline */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {query.remarks.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No remarks yet.</p>
          </div>
        ) : (
          query.remarks.map((r, i) => (
            <RemarkBubble
              key={i}
              remark={r}
              isOwn={r.by_uid === currentUser.uid}
            />
          ))
        )}
      </div>

      {/* Reply box - only if not closed */}
      {query.status !== "CLOSED" && (
        <div className="pt-4 border-t border-gray-100 space-y-3">
          {/* Status selector — manager/admin only */}
          {canUpdateStatus && (
            <Select
              label="Update status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as QueryStatus)}
              options={STATUS_OPTIONS}
            />
          )}
          <Textarea
            placeholder={
              isCustomer
                ? "Add details or a follow-up…"
                : "Add a remark or resolution note…"
            }
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            rows={3}
          />
          <Button
            variant="primary"
            loading={submitting}
            disabled={!newRemark.trim()}
            icon={<Send className="w-4 h-4" />}
            onClick={handleSubmitRemark}
            className="w-full"
          >
            {canUpdateStatus ? "Submit remark & update status" : "Send reply"}
          </Button>
        </div>
      )}

      {query.status === "CLOSED" && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm text-center text-gray-400">
            This query has been closed.
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) return <div className="h-full">{content}</div>;

  // Slide-in panel
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white h-full overflow-hidden flex flex-col animate-slide-in shadow-xl">
        <div className="flex-1 overflow-hidden flex flex-col p-6">{content}</div>
      </div>
    </div>
  );
}
