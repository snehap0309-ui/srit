"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag, Check, X as XIcon, Star, AlertTriangle } from "lucide-react";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import client from "@/services/client";
import type { PaginatedResponse } from "@/types";

export interface AdminOffer {
  id: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  pointsRequired: number;
  isApproved: boolean;
  isActive: boolean;
  rejectionReason: string | null;
  currentRedemptions: number;
  maxRedemptions: number | null;
  viewCount: number;
  clickCount: number;
  createdAt: string;
  vendor: {
    id: string;
    businessName: string;
    businessType: string;
    city: string;
    state: string;
  };
  approvedBy: { id: string; name: string } | null;
  rejectedBy: { id: string; name: string } | null;
}

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
] as const;

function getOfferStatus(offer: AdminOffer): string {
  if (offer.isApproved) return "APPROVED";
  if (offer.rejectionReason) return "REJECTED";
  return "PENDING";
}

export default function OfferApprovalsPage() {
  const { notify } = useNotification();
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [search, setSearch] = useState("");

  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    offerId: string;
    offerTitle: string;
    reason: string;
  }>({ open: false, offerId: "", offerTitle: "", reason: "" });

  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    offerId: string;
    offerTitle: string;
    isFeatured: boolean;
  }>({ open: false, offerId: "", offerTitle: "", isFeatured: false });

  const fetchOffers = useCallback(async (status: string, p: number, q?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (status) params.status = status;
      if (q) params.search = q;
      const res = await client.get<PaginatedResponse<AdminOffer>>("/vendors/admin/offers/all", { params });
      setOffers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setHasNext(res.data.pagination.hasNext);
      setHasPrev(res.data.pagination.hasPrev);
      setPage(res.data.pagination.page);
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers(activeTab, 1, search);
  }, [activeTab, fetchOffers, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOffers(activeTab, 1, search);
  };

  const handleApprove = (offer: AdminOffer) => {
    setApproveDialog({
      open: true,
      offerId: offer.id,
      offerTitle: offer.title,
      isFeatured: false,
    });
  };

  const executeApprove = async () => {
    const { offerId } = approveDialog;
    setActionLoading(offerId);
    try {
      await client.post(`/vendors/admin/offers/${offerId}/approve`, {
        isFeatured: approveDialog.isFeatured,
      });
      notify("success", "Offer approved successfully");
      setApproveDialog((d) => ({ ...d, open: false }));
      fetchOffers(activeTab, page, search);
    } catch {
      notify("error", "Failed to approve offer");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (offer: AdminOffer) => {
    setRejectDialog({
      open: true,
      offerId: offer.id,
      offerTitle: offer.title,
      reason: "",
    });
  };

  const executeReject = async () => {
    const { offerId, reason } = rejectDialog;
    if (!reason.trim()) {
      notify("error", "Please provide a rejection reason");
      return;
    }
    setActionLoading(offerId);
    try {
      await client.post(`/vendors/admin/offers/${offerId}/reject`, {
        rejectionReason: reason,
      });
      notify("success", "Offer rejected successfully");
      setRejectDialog((d) => ({ ...d, open: false }));
      fetchOffers(activeTab, page, search);
    } catch {
      notify("error", "Failed to reject offer");
    } finally {
      setActionLoading(null);
    }
  };

  const statCards = [
    { label: "Total Offers", value: offers.length, color: "bg-blue-500" },
    {
      label: "Pending Approval",
      value: offers.filter((o) => getOfferStatus(o) === "PENDING").length,
      color: "bg-yellow-500",
    },
    {
      label: "Approved",
      value: offers.filter((o) => getOfferStatus(o) === "APPROVED").length,
      color: "bg-emerald-500",
    },
    {
      label: "Rejected",
      value: offers.filter((o) => getOfferStatus(o) === "REJECTED").length,
      color: "bg-red-500",
    },
  ];

  const discountLabel = (offer: AdminOffer) => {
    if (offer.discountType === "PERCENTAGE") return `${offer.discountValue}%`;
    if (offer.discountType === "FLAT") return `₹${offer.discountValue}`;
    return `${offer.discountValue} ${offer.discountType}`;
  };

  const columns: Column<AdminOffer & Record<string, unknown>>[] = [
    {
      key: "title",
      header: "Title",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
            <Tag size={18} className="text-indigo-600" />
          </div>
          <p className="font-medium text-gray-900">{item.title}</p>
        </div>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (item) => (
        <span className="text-sm text-gray-600">{item.vendor.businessName}</span>
      ),
    },
    {
      key: "pointsRequired",
      header: "Points",
      render: (item) => (
        <span className="text-sm font-medium text-gray-700">{item.pointsRequired}</span>
      ),
    },
    {
      key: "discountValue",
      header: "Discount",
      render: (item) => (
        <span className="text-sm text-gray-700">{discountLabel(item)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={getOfferStatus(item)} />,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item) => (
        <span className="text-sm text-gray-500">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          {getOfferStatus(item) === "PENDING" && (
            <>
              <button
                onClick={() => handleApprove(item)}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                title="Approve"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => openRejectDialog(item)}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Reject"
              >
                <XIcon size={16} />
              </button>
            </>
          )}
          {getOfferStatus(item) !== "PENDING" && (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review vendor offers and approve or reject them directly from this list
        </p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`h-2.5 w-2.5 rounded-full ${card.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setPage(1); }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers..."
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      <DataTable
        columns={columns}
        data={offers as (AdminOffer & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={(p) => fetchOffers(activeTab, p, search)}
        emptyMessage={
          activeTab
            ? `No ${activeTab.toLowerCase()} offers found`
            : "No offers found"
        }
      />

      {/* Approve Dialog */}
      {approveDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Check size={20} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Approve Offer</h3>
              </div>
              <button
                onClick={() => setApproveDialog((d) => ({ ...d, open: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Approve the offer &quot;{approveDialog.offerTitle}&quot;?
            </p>
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={approveDialog.isFeatured}
                onChange={(e) =>
                  setApproveDialog((d) => ({ ...d, isFeatured: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Star size={14} className="text-yellow-500" />
              <span className="text-sm text-gray-700">Mark as featured offer</span>
            </label>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setApproveDialog((d) => ({ ...d, open: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeApprove}
                disabled={actionLoading === approveDialog.offerId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === approveDialog.offerId ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Offer</h3>
              </div>
              <button
                onClick={() => setRejectDialog((d) => ({ ...d, open: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon size={20} />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              Reject &quot;{rejectDialog.offerTitle}&quot;?
            </p>
            <textarea
              value={rejectDialog.reason}
              onChange={(e) =>
                setRejectDialog((d) => ({ ...d, reason: e.target.value }))
              }
              placeholder="Provide a reason for rejection..."
              rows={4}
              className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectDialog((d) => ({ ...d, open: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeReject}
                disabled={actionLoading === rejectDialog.offerId || !rejectDialog.reason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectDialog.offerId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
