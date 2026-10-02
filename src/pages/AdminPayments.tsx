import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Link2 } from "lucide-react";
import { api } from "../lib/api";
import ScrollableTable from "../components/ScrollableTable";
import { formatVND } from "../lib/formatters";

interface Payment {
  _id: string;
  provider: string;
  providerTxnId: string;
  order: string | null;
  orderCode?: string;
  amount: number;
  content?: string;
  gateway?: string;
  referenceCode?: string;
  transactionDate?: string;
  status: "matched" | "unmatched";
  assignedBy?: string;
  assignedAt?: string;
  createdAt: string;
}

type Filter = "" | "unmatched" | "matched";

function formatWhen(p: Payment) {
  const d = new Date(p.transactionDate || p.createdAt);
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function AssignForm({ payment, onAssigned }: { payment: Payment; onAssigned: (message: string) => void }) {
  const [orderCode, setOrderCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!orderCode.trim()) return;
    if (!window.confirm(`Credit ${formatVND(payment.amount)} to order ${orderCode.trim()}?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`/api/payments/${payment._id}/assign`, { orderCode: orderCode.trim() });
      onAssigned(res.message || "Transfer assigned.");
    } catch (err: any) {
      setError(err.message || "Failed to assign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="text"
          className="w-44 bg-surface-container-lowest rounded-full px-3 py-1.5 text-sm font-mono"
          placeholder="ORD-XXXXXXXX-XXXX"
          value={orderCode}
          onChange={(e) => setOrderCode(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !orderCode.trim()}
          className="bg-primary text-on-primary px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
          Assign
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [webhookConfigured, setWebhookConfigured] = useState(true);
  const [filter, setFilter] = useState<Filter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/payments${filter ? `?status=${filter}` : ""}`);
      setPayments(data.payments || []);
      setUnmatchedCount(data.unmatchedCount || 0);
      setWebhookConfigured(Boolean(data.webhookConfigured));
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-7xl mx-auto px-8 pb-20 space-y-6">
      <div className="flex justify-between items-center pt-10">
        <h1 className="text-4xl font-headline text-primary">Payments</h1>
        <button
          onClick={load}
          className="border border-primary text-primary px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-primary/5"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {!webhookConfigured && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            Automatic bank confirmation is off. Set <code className="font-mono">SEPAY_WEBHOOK_API_KEY</code> on the
            server and add the webhook in SePay (see DEPLOY.md). Until then, record payments by editing the order.
          </span>
        </div>
      )}

      {unmatchedCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            {unmatchedCount} transfer{unmatchedCount > 1 ? "s" : ""} could not be matched to an order (missing or wrong
            transfer content). Assign them below.
          </span>
          {filter !== "unmatched" && (
            <button onClick={() => setFilter("unmatched")} className="ml-auto underline font-bold">
              Show
            </button>
          )}
        </div>
      )}

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          {notice}
        </div>
      )}

      <div className="flex gap-2">
        {(["", "unmatched", "matched"] as Filter[]).map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              filter === f ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            {f === "" ? "All" : f === "unmatched" ? "Unmatched" : "Matched"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl text-center">{error}</div>
      ) : payments.length === 0 ? (
        <div className="bg-surface-container-low rounded-[20px] p-16 text-center text-on-surface-variant">
          No transfers yet.
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-[20px] overflow-hidden">
          <ScrollableTable minWidth={1000}>
            <table className="w-full">
              <thead>
                <tr className="text-left bg-surface-container-high/50">
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Time</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Amount</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Transfer content</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Bank ref</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {payments.map((p) => (
                  <tr key={p._id} className={p.status === "unmatched" ? "bg-red-50/50" : undefined}>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{formatWhen(p)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-primary whitespace-nowrap">{formatVND(p.amount)}</td>
                    <td className="px-4 py-3 text-sm max-w-[320px] break-words font-mono">{p.content || "-"}</td>
                    <td className="px-4 py-3 text-xs text-outline">
                      {p.gateway} {p.referenceCode}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.status === "matched" ? (
                        <div>
                          <span className="font-headline font-bold text-primary">{p.orderCode}</span>
                          {p.assignedBy && <span className="ml-2 text-xs text-outline">(assigned manually)</span>}
                        </div>
                      ) : (
                        <AssignForm
                          payment={p}
                          onAssigned={(message) => {
                            setNotice(message);
                            load();
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
    </div>
  );
}
