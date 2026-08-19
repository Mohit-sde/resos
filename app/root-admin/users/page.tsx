"use client";

import { useState, useEffect } from "react";
import { Users, Search, UserPlus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { getUsersByRole, createUserAccount } from "@/lib/firebase/services";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import type { AppUser, UserRole } from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "restaurant_manager", label: "Restaurant manager" },
  { value: "restaurant_admin", label: "Restaurant admin" },
];

const roleBadge: Record<UserRole, "info" | "warning" | "success" | "neutral"> = {
  root_admin: "warning",
  restaurant_admin: "success",
  restaurant_manager: "info",
  customer: "neutral",
};

const roleLabel: Record<UserRole, string> = {
  root_admin: "Root admin",
  restaurant_admin: "Restaurant admin",
  restaurant_manager: "Manager",
  customer: "Customer",
};

function CreateUserModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (u: AppUser) => void;
}) {
  const [form, setForm] = useState({ email: "", password: "", role: "customer" as UserRole });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.email || !form.password) { toast.error("Email and password required"); return; }
    setSaving(true);
    try {
      await createUserAccount(form.email, form.password, form.role);
      toast.success("User created");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Creation failed");
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create user"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>Create</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Email" type="email" value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <Input label="Password" type="password" value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        <Select label="Role" value={form.role} options={ROLE_OPTIONS}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))} />
      </div>
    </Modal>
  );
}

export default function RootAdminUsersPage() {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getUsersByRole("customer"), getUsersByRole("restaurant_admin"),
      getUsersByRole("restaurant_manager"),
    ]).then(([c, a, m]) => {
      setAllUsers([...c, ...a, ...m]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = allUsers.filter((u) => {
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const roleTabs: { value: "ALL" | UserRole; label: string }[] = [
    { value: "ALL", label: `All (${allUsers.length})` },
    { value: "restaurant_admin", label: "Admins" },
    { value: "restaurant_manager", label: "Managers" },
    { value: "customer", label: "Customers" },
  ];

  return (
    <DashboardShell title="Users" subtitle="All platform users"
      actions={
        <Button variant="primary" size="sm" icon={<UserPlus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}>
          Create user
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input placeholder="Search by email…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex gap-1">
            {roleTabs.map((tab) => (
              <button key={tab.value} onClick={() => setRoleFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === tab.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? <CardSkeleton count={4} /> : filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title="No users found" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Restaurants</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.uid} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-900 truncate max-w-[200px]">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadge[u.role]}>{roleLabel[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500">
                      {u.associated_restaurants?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs">
                      {u.created_at ? formatDate(u.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(u) => setAllUsers((p) => [u, ...p])} />
    </DashboardShell>
  );
}
