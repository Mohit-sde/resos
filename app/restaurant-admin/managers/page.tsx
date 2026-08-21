"use client";

import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Activity,
  AlertCircle,
  AlertTriangle,
  MoreVertical,
  UserMinus,
  Calendar,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import {
  getManagersByRestaurant,
  assignRestaurantRole,
  getQueries,
  getRestaurant,
  computeRoleForRestaurant,
  unassignRestaurantManager,
} from "@/lib/firebase/services";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import type { AppUser, CustomerQuery, Restaurant } from "@/lib/types";

interface InviteManagerModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  currentUserEmail: string;
  onInvited: () => void;
}

function InviteManagerModal({
  open,
  onClose,
  restaurantId,
  currentUserEmail,
  onInvited,
}: InviteManagerModalProps) {
  const [email, setEmail] = useState("");
  const [usingSelf, setUsingSelf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Same two-phase confirmation as the root-admin modal
  const [pendingConfirm, setPendingConfirm] = useState<{
    targetEmail: string;
    conflictRestaurantName: string;
  } | null>(null);

  function reset() {
    setEmail("");
    setUsingSelf(false);
    setError(null);
    setPendingConfirm(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAssignManager(confirmed = false) {
    setError(null);

    const managerEmail = (usingSelf ? currentUserEmail : email).trim();
    if (!managerEmail) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(managerEmail)) {
      setError("Invalid email format");
      return;
    }

    setSaving(true);
    try {
      const result = await assignRestaurantRole(
        managerEmail,
        restaurantId,
        "restaurant_manager",
        confirmed
      );

      // ✅ Cross-restaurant conflict — show confirmation, don't close yet
      if (result.needsConfirmation) {
        setPendingConfirm({
          targetEmail: managerEmail,
          conflictRestaurantName: result.conflictRestaurantName || "their current restaurant",
        });
        setSaving(false);
        return;
      }

      toast.success(usingSelf ? "You're now a manager" : result.message);
      onInvited();
      handleClose();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to assign manager";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  // ─── Confirmation screen ────────────────────────────────────────────────
  if (pendingConfirm) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Confirm restaurant change"
        description="This user is already tied to another restaurant"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingConfirm(null)}>
              Go back
            </Button>
            <Button variant="primary" loading={saving} onClick={() => handleAssignManager(true)}>
              Revoke & assign
            </Button>
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p>
              <strong>{pendingConfirm.targetEmail}</strong> is currently associated with{" "}
              <strong>{pendingConfirm.conflictRestaurantName}</strong>.
            </p>
            <p className="mt-2">
              Assigning them here as manager will <strong>revoke all their roles</strong> at{" "}
              {pendingConfirm.conflictRestaurantName}. A user can only be tied to one
              restaurant at a time.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  // ─── Main assign screen ─────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign Restaurant Manager"
      description="Assign an existing user as manager for this restaurant"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => handleAssignManager(false)}>
            {saving ? "Checking…" : "Assign Manager"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Option 1: Self Assignment */}
        <div
          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
          onClick={() => {
            setUsingSelf(true);
            setError(null);
          }}
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="manager"
              checked={usingSelf}
              onChange={() => {
                setUsingSelf(true);
                setError(null);
              }}
              className="w-4 h-4"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Assign myself as manager</p>
              <p className="text-xs text-gray-500">{currentUserEmail}</p>
            </div>
          </label>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or</span>
          </div>
        </div>

        {/* Option 2: Assign Other User */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="manager"
              checked={!usingSelf}
              onChange={() => {
                setUsingSelf(false);
                setError(null);
              }}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-900">Assign another user</span>
          </label>

          {!usingSelf && (
            <Input
              label="Manager Email"
              type="email"
              placeholder="manager@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          )}
        </div>

        {error && (
          <div className="flex gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            If the email isn't registered yet, an account is created automatically and they'll
            get a password-reset link on first login.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// "use client";

// import { useState, useEffect } from "react";
// import {
//   Users,
//   UserPlus,
//   Mail,
//   Activity,
//   AlertCircle,
//   AlertTriangle,
//   MoreVertical,
//   UserMinus,
//   Calendar,
// } from "lucide-react";
// import { DashboardShell } from "@/components/layout/DashboardShell";
// import { Button } from "@/components/ui/Button";
// import { Modal } from "@/components/ui/Modal";
// import { Input } from "@/components/ui/Input";
// import { Badge } from "@/components/ui/Badge";
// import { EmptyState } from "@/components/ui/EmptyState";
// import { CardSkeleton } from "@/components/ui/Loading";
// import {
//   getManagersByRestaurant,
//   assignRestaurantRole,
//   unassignRestaurantManager,
//   getQueries,
//   getRestaurant,
//   computeRoleForRestaurant,
// } from "@/lib/firebase/services";
// import { useAuth } from "@/context/AuthContext";
// import toast from "react-hot-toast";
// import type { AppUser, CustomerQuery, Restaurant } from "@/lib/types";

// ─── join-date formatting ────────────────────────────────────────────────
function formatJoinDate(value: unknown): string {
  if (!value) return "—";
  let d: Date;
  if (value instanceof Date) d = value;
  else if (typeof value === "string") d = new Date(value);
  else if (typeof value === "object" && value !== null && "seconds" in (value as any)) {
    d = new Date((value as any).seconds * 1000);
  } else {
    return "—";
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ... InviteManagerModal stays exactly as you had it ... */

// ─── per-card actions menu ─────────────────────────────────────────────
interface ManagerActionsMenuProps {
  isDualRole: boolean;
  onRemove: () => void;
}

function ManagerActionsMenu({ isDualRole, onRemove }: ManagerActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Manager actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-gray-100 shadow-lg z-20 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              {isDualRole ? "Step down as manager" : "Remove as manager"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── confirm-remove modal ──────────────────────────────────────────────
interface ConfirmRemoveTarget {
  uid: string;
  email: string;
  name: string;
  isDualRole: boolean;
}

function ConfirmRemoveModal({
  target,
  onClose,
  onConfirm,
  loading,
}: {
  target: ConfirmRemoveTarget | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!target) return null;
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target.isDualRole ? "Step down as manager" : "Remove manager"}
      description={target.isDualRole ? "You'll remain admin for this restaurant" : "They'll lose manager access to this restaurant"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {target.isDualRole ? "Step down" : "Remove"}
          </Button>
        </>
      }
    >
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p>
            <strong>{target.name || target.email}</strong> will lose their manager role at this
            restaurant. Any queries already assigned to them stay on record but won't route to
            them going forward.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminManagersPage() {
  const { appUser } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [managers, setManagers] = useState<AppUser[]>([]);
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ConfirmRemoveTarget | null>(null);
  const [removing, setRemoving] = useState(false);

  const restaurantId = appUser?.managed_restaurant ?? "";

  async function reload() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [restaurantDoc, managerList, q] = await Promise.all([
        getRestaurant(restaurantId),
        getManagersByRestaurant(restaurantId),
        getQueries(restaurantId),
      ]);
      setRestaurant(restaurantDoc);
      setManagers(managerList);
      setQueries(q);
    } catch (error) {
      console.error("Failed to load managers:", error);
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [restaurantId]);

  function managerStats(uid: string) {
    const assigned = queries.filter((q) => q.assigned_manager_uid === uid);
    return {
      total: assigned.length,
      open: assigned.filter((q) => q.status === "OPEN" || q.status === "IN_PROGRESS").length,
      resolved: assigned.filter((q) => q.status === "RESOLVED" || q.status === "CLOSED").length,
    };
  }

  async function handleConfirmRemove() {
    if (!confirmRemove) return;
    setRemoving(true);
    try {
      await unassignRestaurantManager(restaurantId, confirmRemove.uid, confirmRemove.email);
      toast.success(
        confirmRemove.isDualRole ? "Stepped down as manager" : "Manager removed"
      );
      setConfirmRemove(null);
      reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove manager";
      toast.error(msg);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <DashboardShell
      title="Managers"
      subtitle="Assign and monitor restaurant managers"
      actions={
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => setInviteOpen(true)}
        >
          Assign Manager
        </Button>
      }
    >
      {loading ? (
        <CardSkeleton count={3} />
      ) : managers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No managers assigned"
          description="Assign a manager to handle queries and products."
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setInviteOpen(true)}
            >
              Assign Manager
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {managers.map((m) => {
            const stats = managerStats(m.uid);
            const isSelf = appUser?.email === m.email;
            const effectiveRole = restaurant ? computeRoleForRestaurant(restaurant, m.uid) : "restaurant_manager";
            const isDualRole = effectiveRole === "admin_and_manager";
            const joinDate = restaurant?.manager_assigned_at?.[m.uid] ?? (m as any).created_at;

            return (
              <div key={m.uid} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold flex-shrink-0">
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {m.name || m.email.split("@")[0]}
                        </p>
                        {isSelf && (
                          <Badge variant="success" dot>
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {m.email}
                      </p>
                    </div>
                  </div>

                  <ManagerActionsMenu
                    isDualRole={isDualRole}
                    onRemove={() =>
                      setConfirmRemove({
                        uid: m.uid,
                        email: m.email,
                        name: m.name || m.email,
                        isDualRole,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  {isDualRole ? (
                    <Badge variant="warning" dot>
                      Admin & Manager
                    </Badge>
                  ) : (
                    <Badge variant="info" dot>
                      Manager
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Since {formatJoinDate(joinDate)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total", value: stats.total, color: "text-gray-900" },
                    { label: "Open", value: stats.open, color: "text-amber-600" },
                    { label: "Resolved", value: stats.resolved, color: "text-green-600" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="info" dot>
                    Active
                  </Badge>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    {stats.total} queries
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InviteManagerModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        restaurantId={restaurantId}
        currentUserEmail={appUser?.email ?? ""}
        onInvited={reload}
      />

      <ConfirmRemoveModal
        target={confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={handleConfirmRemove}
        loading={removing}
      />
    </DashboardShell>
  );
}