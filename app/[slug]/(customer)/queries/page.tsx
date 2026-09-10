"use client";

import { useState, useEffect } from "react";
import { Plus, MessageSquare } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryList } from "@/components/query/QueryList";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Loading";
import { useAuth } from "@/context/AuthContext";
import { getCustomerQueries, createQuery, getCustomerOrders } from "@/lib/firebase/services";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import type { CustomerQuery, Order } from "@/lib/types";

function RaiseQueryModal({ open, onClose, restaurantId, uid, email, orders, onRaised }: {
  open: boolean; onClose: () => void;
  restaurantId: string; uid: string; email: string;
  orders: Order[]; onRaised: (q: CustomerQuery) => void;
}) {
  const [form, setForm] = useState({ subject: "", description: "", order_id: "" });
  const [saving, setSaving] = useState(false);

  const orderOptions = [
    { value: "", label: "— Not related to an order —" },
    ...orders.map((o) => ({
      value: o.order_id,
      label: `Order #${o.order_number} — ₹${o.billing.grand_total}`,
    })),
  ];

  async function handleSubmit() {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required"); return;
    }
    setSaving(true);
    try {
      const id = await createQuery(restaurantId, {
        restaurant_id: restaurantId, customer_id: uid, customer_email: email,
        subject: form.subject, description: form.description,
        ...(form.order_id && { order_id: form.order_id }),
        status: "OPEN",
      });
      const newQuery: CustomerQuery = {
        query_id: id, restaurant_id: restaurantId,
        customer_id: uid, customer_email: email,
        subject: form.subject, description: form.description,
        ...(form.order_id && { order_id: form.order_id }),
        status: "OPEN", remarks: [],
        created_at: Timestamp.now(),
      };
      onRaised(newQuery);
      toast.success("Query submitted");
      setForm({ subject: "", description: "", order_id: "" }); onClose();
    } catch { toast.error("Failed to submit query"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise a query"
      description="Our support team will respond shortly"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>Submit query</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Subject *" placeholder="e.g. Missing item from order, Refund request"
          value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
        <Select label="Related order (optional)" value={form.order_id} options={orderOptions}
          onChange={(e) => setForm((p) => ({ ...p, order_id: e.target.value }))} />
        <Textarea label="Description *" rows={4} value={form.description}
          placeholder="Please describe your issue in detail…"
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
    </Modal>
  );
}

export default function CustomerQueriesPage() {
  const { appUser } = useAuth();
  const [queries, setQueries] = useState<CustomerQuery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const restaurantId = appUser?.associated_restaurants?.[0] ?? "";

  useEffect(() => {
    if (!restaurantId || !appUser?.uid) { setLoading(false); return; }
    Promise.all([
      getCustomerQueries(restaurantId, appUser.uid),
      getCustomerOrders(restaurantId, appUser.uid),
    ]).then(([q, o]) => { setQueries(q); setOrders(o); }).finally(() => setLoading(false));
  }, [restaurantId, appUser?.uid]);

  return (
    <DashboardShell title="My queries" subtitle={`${queries.length} queries raised`}
      actions={
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
          onClick={() => setRaiseOpen(true)}>
          Raise a query
        </Button>
      }
    >
      {loading ? <CardSkeleton count={3} /> : queries.length === 0 ? (
        <EmptyState icon={<MessageSquare className="w-6 h-6" />}
          title="No queries yet"
          description="Have a question or issue? Raise a query and we'll get back to you."
          action={
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
              onClick={() => setRaiseOpen(true)}>
              Raise a query
            </Button>
          } />
      ) : appUser ? (
        <QueryList queries={queries} currentUser={appUser}
          onQueryUpdated={(u) => setQueries((p) => p.map((q) => q.query_id === u.query_id ? u : q))} />
      ) : null}

      {appUser && (
        <RaiseQueryModal open={raiseOpen} onClose={() => setRaiseOpen(false)}
          restaurantId={restaurantId} uid={appUser.uid} email={appUser.email}
          orders={orders} onRaised={(q) => setQueries((p) => [q, ...p])} />
      )}
    </DashboardShell>
  );
}
