"use client";

import { useState } from "react";
import { User, Lock, Shield, LogOut, Eye, EyeOff, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { changeUserPassword, logoutUser } from "@/lib/firebase/services";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    if (!form.current || !form.next) { toast.error("All fields required"); return; }
    if (form.next !== form.confirm) { toast.error("New passwords don't match"); return; }
    if (form.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await changeUserPassword(form.current, form.next);
      toast.success("Password changed successfully");
      setForm({ current: "", next: "", confirm: "" }); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message.includes("wrong-password")
        ? "Current password is incorrect" : "Failed to change password");
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleChange}>Update password</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Input label="Current password" type={show ? "text" : "password"}
            value={form.current} onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))} />
        </div>
        <Input label="New password" type={show ? "text" : "password"}
          value={form.next} onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))} />
        <Input label="Confirm new password" type={show ? "text" : "password"}
          value={form.confirm} onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="rounded" />
          Show passwords
        </label>
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [pwdOpen, setPwdOpen] = useState(false);

  const roleLabel: Record<string, string> = {
    root_admin: "Root admin",
    restaurant_admin: "Restaurant admin",
    restaurant_manager: "Manager",
    customer: "Customer",
  };

  async function handleLogout() {
    await logoutUser();
    router.push("/login");
    toast.success("Logged out");
  }

  if (!appUser) return null;

  return (
    <DashboardShell title="Profile" subtitle="Manage your account">
      <div className="max-w-lg space-y-4">
        {/* Avatar + info card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-brand-700">
                {appUser.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{appUser.email}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="info">{roleLabel[appUser.role] ?? appUser.role}</Badge>
                {appUser.created_at && (
                  <span className="text-xs text-gray-400">
                    Joined {formatDate(appUser.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account details */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Email address</p>
              <p className="text-sm font-medium text-gray-900">{appUser.email}</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Account role</p>
              <p className="text-sm font-medium text-gray-900">{roleLabel[appUser.role]}</p>
            </div>
          </div>
          {appUser.associated_restaurants?.length > 0 && (
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-sm">🏪</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">Linked restaurants</p>
                <p className="text-sm font-medium text-gray-900">
                  {appUser.associated_restaurants.length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security actions */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <button onClick={() => setPwdOpen(true)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Change password</p>
              <p className="text-xs text-gray-400">Update your account password</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
          <button onClick={handleLogout}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600">Sign out</p>
              <p className="text-xs text-gray-400">Sign out of your account</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </DashboardShell>
  );
}
