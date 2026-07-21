"use client";

import { useEffect, useState, useCallback } from "react";
import { Clapperboard, Handshake, Check, X as XIcon, Pause, Ban, Link2, FileText, Video } from "lucide-react";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getCreatorApplications, verifyCreator, type CreatorApplication, type CreatorStatus } from "@/services/creators";

export default function CreatorsPage() {
  const { notify } = useNotification();
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "primary" | "danger";
    action: () => Promise<void>;
  }>({ open: false, title: "", message: "", variant: "primary", action: async () => {} });

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCreatorApplications();
      setApplications(data);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleVerify = (id: string, status: CreatorStatus) => {
    const isApprove = status === "APPROVED";
    const isChangesRequested = status === "CHANGES_REQUESTED";
    const needsReason = status === "REJECTED" || isChangesRequested;
    const reason = needsReason
      ? window.prompt(isChangesRequested ? "Describe the changes required:" : "Provide a rejection reason:")
      : undefined;

    if (needsReason && !reason?.trim()) return;

    const titles: Record<string, string> = {
      APPROVED: "Approve Creator",
      REJECTED: "Reject Creator",
      CHANGES_REQUESTED: "Request Creator Changes",
      SUSPENDED: "Suspend Creator",
      PAUSED: "Pause Creator",
    };

    setConfirmDialog({
      open: true,
      title: titles[status] || "Update Creator",
      message: isApprove
        ? "Approve this creator on the same user account? They can switch to Creator mode without a new login."
        : `Set creator status to ${status}?`,
      variant: status === "REJECTED" || status === "SUSPENDED" ? "danger" : "primary",
      action: async () => {
        setActionLoading(id);
        try {
          await verifyCreator(id, status, reason?.trim());
          notify("success", `Creator ${status.toLowerCase().replace(/_/g, " ")}`);
          fetchApplications();
        } catch (err) {
          notify("error", err instanceof Error ? err.message : "Failed to update creator");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const columns: Column<CreatorApplication & Record<string, unknown>>[] = [
    {
      key: "username",
      header: "Creator",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.avatar} alt={item.username} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
              <Clapperboard size={18} className="text-amber-600" />
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">@{item.username}</p>
            <p className="text-xs text-gray-500">{item.fullName || item.user?.name} · {item.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "travelCategories",
      header: "Categories",
      render: (item) => (
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {(item.travelCategories || []).length === 0 ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            (item.travelCategories || []).slice(0, 3).map((cat) => (
              <span key={cat} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                {cat}
              </span>
            ))
          )}
          {(item.travelCategories || []).length > 3 && (
            <span className="text-[10px] text-gray-400">+{(item.travelCategories || []).length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "links",
      header: "Links & Docs",
      render: (item) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {item.instagramUrl && (
            <a href={item.instagramUrl} target="_blank" rel="noreferrer" title="Instagram" className="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700 hover:bg-pink-200">
              IG
            </a>
          )}
          {item.youtubeUrl && (
            <a href={item.youtubeUrl} target="_blank" rel="noreferrer" title="YouTube" className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-200">
              YT
            </a>
          )}
          {item.facebookUrl && (
            <a href={item.facebookUrl} target="_blank" rel="noreferrer" title="Facebook" className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-200">
              FB
            </a>
          )}
          {item.sampleReelUrl && (
            <a href={item.sampleReelUrl} target="_blank" rel="noreferrer" title="Sample reel" className="text-indigo-600 hover:text-indigo-800">
              <Video size={14} />
            </a>
          )}
          {item.governmentIdUrl && (
            <a href={item.governmentIdUrl} target="_blank" rel="noreferrer" title="Government ID" className="text-slate-600 hover:text-slate-800">
              <FileText size={14} />
            </a>
          )}
          {(item.portfolioLinks || []).slice(0, 2).map((url, i) => (
            <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" title={`Portfolio ${i + 1}`} className="text-emerald-600 hover:text-emerald-800">
              <Link2 size={14} />
            </a>
          ))}
          {!item.instagramUrl && !item.youtubeUrl && !item.facebookUrl && !item.sampleReelUrl && !item.governmentIdUrl && (item.portfolioLinks || []).length === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: "applicationReason",
      header: "Reason",
      render: (item) => (
        <p className="max-w-[220px] truncate text-sm text-gray-600" title={item.applicationReason || undefined}>
          {item.applicationReason || "—"}
        </p>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      header: "Applied",
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
        <div className="flex flex-wrap items-center gap-1">
          {item.status === "PENDING" && (
            <>
              <button
                onClick={() => handleVerify(item.id, "APPROVED")}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                title="Approve"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => handleVerify(item.id, "REJECTED")}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Reject"
              >
                <XIcon size={16} />
              </button>
              <button
                onClick={() => handleVerify(item.id, "CHANGES_REQUESTED")}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                title="Request Changes"
              >
                <Handshake size={16} />
              </button>
            </>
          )}
          {item.status === "APPROVED" && (
            <>
              <button
                onClick={() => handleVerify(item.id, "PAUSED")}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                title="Pause"
              >
                <Pause size={16} />
              </button>
              <button
                onClick={() => handleVerify(item.id, "SUSPENDED")}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
                title="Suspend"
              >
                <Ban size={16} />
              </button>
            </>
          )}
          {(item.status === "PAUSED" || item.status === "SUSPENDED") && (
            <button
              onClick={() => handleVerify(item.id, "APPROVED")}
              disabled={actionLoading === item.id}
              className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
              title="Re-approve"
            >
              <Check size={16} />
            </button>
          )}
          {item.status === "RETIRED" && (
            <span className="text-xs text-gray-400">Switched roles</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Creators</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review content creator applications. Approval activates the creator profile on the same user account.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={applications as (CreatorApplication & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="No creator applications found"
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog((p) => ({ ...p, open: false }));
        }}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
