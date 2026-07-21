"use client";

import { useCallback, useEffect, useState } from "react";
import { monetizationApi } from "@/services/monetization";
import { useNotification } from "@/components/Notification";

export default function VendorDocumentsAdminPage() {
  const { notify } = useNotification();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await monetizationApi.listDocuments(1);
      setRows((res.data as any).data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, status: string) => {
    try {
      await monetizationApi.reviewDocument(id, status);
      notify("success", `Marked ${status}`);
      load();
    } catch {
      notify("error", "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendor Documents</h1>
        <p className="text-sm text-gray-500">Approve, reject, or request changes on KYC uploads.</p>
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Loading…</div> : rows.length === 0 ? (
          <div className="p-6 text-gray-500">No pending documents.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">{d.vendor?.businessName}<div className="text-xs text-gray-500">{d.vendor?.user?.email}</div></td>
                  <td className="px-4 py-3">{d.type}</td>
                  <td className="px-4 py-3"><a className="text-amber-700 underline" href={d.fileUrl} target="_blank" rel="noreferrer">View</a></td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => review(d.id, "APPROVED")} className="rounded bg-green-600 px-2 py-1 text-white text-xs">Approve</button>
                    <button onClick={() => review(d.id, "CHANGES_REQUESTED")} className="rounded bg-amber-600 px-2 py-1 text-white text-xs">Changes</button>
                    <button onClick={() => review(d.id, "REJECTED")} className="rounded bg-red-600 px-2 py-1 text-white text-xs">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
