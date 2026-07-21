"use client";

import { useEffect, useState } from "react";
import { monetizationApi } from "@/services/monetization";

export default function TransactionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");
  const [refunds, setRefunds] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [tx, pl, rf] = await Promise.all([
          monetizationApi.listTransactions(1, 50),
          monetizationApi.listPlans(),
          monetizationApi.listRefunds(1).catch(() => ({ data: { data: [] } })),
        ]);
        setRows((tx.data as any).data || []);
        setPlans((pl.data as any).data || []);
        setRefunds((rf.data as any)?.data || (rf as any).data || []);
      } catch {
        setRows([]);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grant = async () => {
    if (!grantUserId.trim() || !grantPlanId) {
      setGrantMsg("User id and plan are required");
      return;
    }
    setGrantBusy(true);
    setGrantMsg("");
    try {
      await monetizationApi.adminGrant({
        userId: grantUserId.trim(),
        planId: grantPlanId,
        period: "MONTHLY",
      });
      setGrantMsg("Grant applied (server-side).");
      const res = await monetizationApi.listTransactions(1, 50);
      setRows((res.data as any).data || []);
    } catch (e: any) {
      setGrantMsg(e?.response?.data?.message || e?.message || "Grant failed");
    } finally {
      setGrantBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-gray-500">IAP + Razorpay payment log (server-verified only).</p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Admin grant subscription</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            User ID
            <input
              className="block border rounded px-2 py-1 mt-1 min-w-[220px]"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              placeholder="cuid…"
            />
          </label>
          <label className="text-sm">
            Plan
            <select
              className="block border rounded px-2 py-1 mt-1 min-w-[200px]"
              value={grantPlanId}
              onChange={(e) => setGrantPlanId(e.target.value)}
            >
              <option value="">Select plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.audience})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={grantBusy}
            onClick={grant}
            className="bg-amber-700 text-white px-3 py-2 rounded font-semibold disabled:opacity-50"
          >
            {grantBusy ? "Granting…" : "Grant"}
          </button>
        </div>
        {grantMsg ? <p className="text-sm text-gray-600">{grantMsg}</p> : null}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-2">Refunds ({refunds.length})</h2>
        {refunds.length === 0 ? (
          <p className="text-sm text-gray-500">No refund records yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {refunds.slice(0, 10).map((r) => (
              <li key={r.id}>
                {r.id.slice(0, 8)}… · ₹{((r.amountPaise || 0) / 100).toFixed(2)} · {r.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Loading…</div> : rows.length === 0 ? (
          <div className="p-6 text-gray-500">No transactions yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const invoiceId = t.invoice?.id || t.id;
                return (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-3">{t.user?.email || t.userId}</td>
                    <td className="px-4 py-3">{t.provider}</td>
                    <td className="px-4 py-3">₹{(t.amountPaise / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">{t.status}</td>
                    <td className="px-4 py-3">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <a
                        className="text-amber-700 font-semibold hover:underline"
                        href={monetizationApi.invoicePdfUrl(invoiceId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        GST PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
