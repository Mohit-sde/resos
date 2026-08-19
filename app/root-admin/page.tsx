"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Plus, Store, Edit2, Trash2, User, ExternalLink,
  ToggleLeft, ToggleRight, Search, ChevronRight
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import {
  getAllRestaurants, createRestaurant, updateRestaurant,
  deleteRestaurant, assignRestaurantRole, getUsersByRole,
} from "@/lib/firebase/services";
import { slugify } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Restaurant, AppUser } from "@/lib/types";

// ─── Restaurant Form ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  business_name: "", fssai_number: "", gst_number: "",
  url_slug: "", upi_id: "", address: "", phone: "",
  cuisine_type: "", branding: { primary_color: "#ea580c", logo_url: "" },
  is_open: true,
};

interface AssignAdminModalProps {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant | null;
  onAssigned: () => void;
}

function RestaurantFormModal({
  open, onClose, initial, onSaved,
}: {
  open: boolean; onClose: () => void;
  initial?: Restaurant | null; onSaved: (r: Restaurant) => void;
}) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

  useEffect(() => { setForm(initial ?? EMPTY_FORM); }, [initial]);

  function set(field: string, value: unknown) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave() {
    if (!form.business_name || !form.url_slug) {
      toast.error("Business name and URL slug are required"); return;
    }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await updateRestaurant(initial.restaurant_id, form as Partial<Restaurant>);
        onSaved({ ...initial, ...form } as Restaurant);
        toast.success("Restaurant updated");
      } else {
        const id = await createRestaurant(form as Omit<Restaurant, "restaurant_id">);
        onSaved({ ...form, restaurant_id: id } as Restaurant);
        toast.success("Restaurant created");
      }
      onClose();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={isEdit ? "Edit restaurant" : "Add restaurant"}
      description="Fill in the restaurant details below"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {isEdit ? "Save changes" : "Create restaurant"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Business name *" value={form.business_name}
          onChange={(e) => { set("business_name", e.target.value); if (!isEdit) set("url_slug", slugify(e.target.value)); }} />
        <Input label="URL slug *" value={form.url_slug}
          hint="Unique identifier: cafeoasis, biryanihouse"
          onChange={(e) => set("url_slug", slugify(e.target.value))} />
        <Input label="FSSAI number" value={form.fssai_number}
          onChange={(e) => set("fssai_number", e.target.value)} />
        <Input label="GST number" value={form.gst_number}
          onChange={(e) => set("gst_number", e.target.value)} />
        <Input label="UPI ID" value={form.upi_id}
          onChange={(e) => set("upi_id", e.target.value)} />
        <Input label="Phone" value={form.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)} />
        <Input label="Cuisine type" value={form.cuisine_type ?? ""}
          onChange={(e) => set("cuisine_type", e.target.value)} />
        <Input label="Brand color" type="color"
          value={form.branding?.primary_color ?? "#ea580c"}
          onChange={(e) => set("branding", { ...form.branding, primary_color: e.target.value })} />
        <div className="sm:col-span-2">
          <Input label="Address" value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Input label="Logo URL" value={form.branding?.logo_url ?? ""}
            onChange={(e) => set("branding", { ...form.branding, logo_url: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_open}
              onChange={(e) => set("is_open", e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Restaurant is open (live ordering)</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign Admin Modal ─────────────────────────────────────────────────────
function AssignAdminModal({
  open,
  onClose,
  restaurant,
  onAssigned,
}: AssignAdminModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"restaurant_admin" | "restaurant_manager">(
    "restaurant_admin"
  );
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
 
  // ✅ Confirmation step state
  const [pendingConfirm, setPendingConfirm] = useState<{
    conflictRestaurantName: string;
    targetRestaurantName: string;
  } | null>(null);
 
  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 
  async function handleAssign(confirmed = false) {
    if (!restaurant || !email.trim()) {
      toast.error("Please enter an email address");
      return;
    }
 
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
 
    setSaving(true);
    setEmailError("");
 
    try {
      const result = await assignRestaurantRole(
        email.toLowerCase().trim(),
        restaurant.restaurant_id,
        role,
        confirmed
      );
 
      // ✅ Cross-restaurant conflict — show confirmation, don't close yet
      if (result.needsConfirmation) {
        setPendingConfirm({
          conflictRestaurantName: result.conflictRestaurantName || "their current restaurant",
          targetRestaurantName: result.targetRestaurantName || restaurant.business_name,
        });
        setSaving(false);
        return;
      }
 
      if (result.isNewUser) {
        toast.success("New account created! They'll receive an email to set their password.");
      } else {
        toast.success(result.message);
      }
 
      resetAndClose();
      onAssigned();
    } catch (error: any) {
      if (error.message?.includes("already")) {
        setEmailError(error.message);
      } else {
        toast.error(error.message || "Failed to assign role");
      }
    } finally {
      setSaving(false);
    }
  }
 
  function resetAndClose() {
    setEmail("");
    setRole("restaurant_admin");
    setEmailError("");
    setPendingConfirm(null);
    onClose();
  }
 
  // ─── Confirmation Screen ────────────────────────────────────────────────
  if (pendingConfirm) {
    return (
      <Modal
        open={open}
        onClose={resetAndClose}
        title="Confirm restaurant change"
        description="This user is already tied to another restaurant"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingConfirm(null)}>
              Go back
            </Button>
            <Button variant="primary" loading={saving} onClick={() => handleAssign(true)}>
              Revoke & assign
            </Button>
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p>
              <strong>{email}</strong> is currently associated with{" "}
              <strong>{pendingConfirm.conflictRestaurantName}</strong>.
            </p>
            <p className="mt-2">
              Assigning them to <strong>{pendingConfirm.targetRestaurantName}</strong> will{" "}
              <strong>revoke all their roles</strong> (admin and/or manager) at{" "}
              {pendingConfirm.conflictRestaurantName}. A user can only be tied to one
              restaurant at a time.
            </p>
          </div>
        </div>
      </Modal>
    );
  }
 
  // ─── Main Assign Screen ─────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Assign Restaurant Admin/Manager"
      description={`Assign a role at: ${restaurant?.business_name}`}
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!email.trim() || saving}
            onClick={() => handleAssign(false)}
          >
            {saving ? "Checking…" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email Address
          </label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError("");
            }}
            disabled={saving}
            className={emailError ? "border-red-500" : ""}
          />
          {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
        </div>
 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "restaurant_admin" | "restaurant_manager")}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="restaurant_admin">Restaurant Admin</option>
            <option value="restaurant_manager">Restaurant Manager</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {role === "restaurant_admin"
              ? "Admin can manage restaurant, menus, and staff"
              : "Manager can manage products and orders"}
          </p>
        </div>
 
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-800">
            <strong>ℹ️ How it works:</strong>
            <br />• A user can be admin <em>and</em> manager of the same restaurant
            <br />• If they're already assigned elsewhere, you'll be asked to confirm before
            their old association is revoked
            <br />• New emails get an account with a password-reset link
          </p>
        </div>
 
        {restaurant?.admin_uid && role === "restaurant_admin" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-800">
              <strong>⚠️ Current admin:</strong> {restaurant.admin_email || "Unknown"}
              <br />
              Assigning a new admin will replace them here. If they're also a manager, they
              keep manager status.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Restaurant Card ────────────────────────────────────────────────────────
function RestaurantCard({
  restaurant, onEdit, onDelete, onToggle, onAssignAdmin,
}: {
  restaurant: Restaurant;
  onEdit: () => void; onDelete: () => void;
  onToggle: () => void; onAssignAdmin: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: restaurant.branding?.primary_color ?? "#ea580c" }}>
            {restaurant.business_name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{restaurant.business_name}</h3>
            <span className="text-xs text-gray-400 font-mono">/{restaurant.url_slug}</span>
          </div>
        </div>
        <button onClick={onToggle}
          className={restaurant.is_open ? "text-green-500" : "text-gray-300"}>
          {restaurant.is_open
            ? <ToggleRight className="w-8 h-8" />
            : <ToggleLeft className="w-8 h-8" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        {restaurant.cuisine_type && <span>🍴 {restaurant.cuisine_type}</span>}
        {restaurant.phone && <span>📞 {restaurant.phone}</span>}
        {restaurant.fssai_number && <span>FSSAI: {restaurant.fssai_number}</span>}
        {restaurant.upi_id && <span>UPI: {restaurant.upi_id}</span>}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={restaurant.is_open ? "success" : "neutral"} dot>
          {restaurant.is_open ? "Open" : "Closed"}
        </Badge>
        {restaurant.admin_uid && <Badge variant="info">Admin assigned</Badge>}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
        <Button size="sm" variant="ghost" icon={<User className="w-3.5 h-3.5" />} onClick={onAssignAdmin}>
          Assign admin
        </Button>
        <Button size="sm" variant="ghost" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />}
          className="text-red-500 hover:text-red-600 ml-auto" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function RootAdminPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [assignTarget, setAssignTarget] = useState<Restaurant | null>(null);

  useEffect(() => {
    Promise.all([getAllRestaurants(), getUsersByRole("customer")]).then(([r, u]) => {
      setRestaurants(r); setUsers(u); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = restaurants.filter((r) =>
    r.business_name.toLowerCase().includes(search.toLowerCase()) ||
    r.url_slug.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(r: Restaurant) {
    if (!confirm(`Delete "${r.business_name}"? This is permanent.`)) return;
    try {
      await deleteRestaurant(r.restaurant_id);
      setRestaurants((prev) => prev.filter((x) => x.restaurant_id !== r.restaurant_id));
      toast.success("Restaurant deleted");
    } catch { toast.error("Delete failed"); }
  }

  async function handleToggle(r: Restaurant) {
    try {
      await updateRestaurant(r.restaurant_id, { is_open: !r.is_open });
      setRestaurants((prev) =>
        prev.map((x) => x.restaurant_id === r.restaurant_id ? { ...x, is_open: !x.is_open } : x)
      );
    } catch { toast.error("Failed to update status"); }
  }

  function handleSaved(saved: Restaurant) {
    setRestaurants((prev) => {
      const idx = prev.findIndex((r) => r.restaurant_id === saved.restaurant_id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  }

  return (
    <DashboardShell title="Restaurants" subtitle={`${restaurants.length} restaurants registered`}
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditTarget(null); setFormOpen(true); }}>
          Add restaurant
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input placeholder="Search restaurants…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Grid */}
      {loading ? (
        <CardSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Store className="w-6 h-6" />}
          title={search ? "No matching restaurants" : "No restaurants yet"}
          description={search ? "Try a different search." : "Click 'Add restaurant' to get started."}
          action={!search && (
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
              onClick={() => { setEditTarget(null); setFormOpen(true); }}>
              Add restaurant
            </Button>
          )} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <RestaurantCard key={r.restaurant_id} restaurant={r}
              onEdit={() => { setEditTarget(r); setFormOpen(true); }}
              onDelete={() => handleDelete(r)}
              onToggle={() => handleToggle(r)}
              onAssignAdmin={() => setAssignTarget(r)} />
          ))}
        </div>
      )}

      <RestaurantFormModal open={formOpen} onClose={() => setFormOpen(false)}
        initial={editTarget} onSaved={handleSaved} />

      <AssignAdminModal open={!!assignTarget} onClose={() => setAssignTarget(null)}
        restaurant={assignTarget} admins={users} onAssigned={() => getAllRestaurants().then(setRestaurants)} />
    </DashboardShell>
  );
}
