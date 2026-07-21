"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Wallet, Plus, Minus, Coins, TrendingUp } from "lucide-react";
import { getUsers } from "@/services/users";
import client from "@/services/client";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { User, SingleResponse } from "@/types";

interface WalletData {
  palPoints: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

interface WalletUser extends User {
  wallet?: WalletData;
}

export default function WalletsPage() {
  const { notify } = useNotification();
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [search, setSearch] = useState("");

  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    user: WalletUser | null;
    wallet: WalletData | null;
  }>({ open: false, user: null, wallet: null });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: "", message: "", action: () => {} });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({ page, limit: 15, search: search || undefined });
      const ids = res.data.map(u => u.id);
      let walletMap: Record<string, WalletData> = {};
      if (ids.length > 0) {
        try {
          const batchRes = await client.get<{ success: boolean; data: Record<string, WalletData> }>(
            "/wallet/admin/batch", { params: { userIds: ids.join(',') } }
          );
          walletMap = batchRes.data.data || {};
        } catch {
          const walletResults = await Promise.all(
            ids.map(async (id) => {
              try {
                const wr = await client.get<SingleResponse<WalletData>>(`/wallet/admin/${id}`);
                return { id, wallet: wr.data.data as unknown as WalletData };
              } catch {
                return { id, wallet: null };
              }
            })
          );
          walletResults.forEach(({ id, wallet }) => { if (wallet) walletMap[id] = wallet; });
        }
      }
      const usersWithWallet: WalletUser[] = res.data.map(u => ({
        ...u,
        wallet: walletMap[u.id],
      }));
      setUsers(usersWithWallet);
      setTotalPages(res.pagination.totalPages);
      setHasNext(res.pagination.hasNext);
      setHasPrev(res.pagination.hasPrev);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenAdjust = async (user: WalletUser) => {
    try {
      const res = await client.get<SingleResponse<WalletData>>(`/wallet/admin/${user.id}`);
      const wallet = res.data.data as unknown as WalletData;
      setAdjustModal({ open: true, user, wallet });
    } catch {
      setAdjustModal({ open: true, user, wallet: null });
    }
    setAdjustAmount("");
    setAdjustReason("");
  };

  const handleAdjust = async () => {
    if (!adjustModal.user) return;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) {
      notify("error", "Please enter a valid non-zero amount");
      return;
    }
    if (!adjustReason.trim()) {
      notify("error", "Please provide a reason");
      return;
    }
    setAdjusting(true);
    try {
      await client.post(`/wallet/adjust/${adjustModal.user.id}`, {
        palPoints: amount,
        reason: adjustReason,
      });
      notify("success", "Wallet adjusted successfully");
      setAdjustModal({ open: false, user: null, wallet: null });
      fetchUsers();
    } catch {
      notify("error", "Failed to adjust wallet");
    } finally {
      setAdjusting(false);
    }
  };

  const totalPalPoints = users.reduce((sum, u) => sum + (u.wallet?.palPoints || 0), 0);


  const columns: Column<WalletUser & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "User",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.name || "Unnamed"}</p>
          <p className="text-xs text-gray-500">{item.email}</p>
        </div>
      ),
    },
    {
      key: "palPoints",
      header: "Pal Points",
      render: (item) => (
        <span className="font-semibold text-emerald-600">
          {(item.wallet?.palPoints ?? "—") as React.ReactNode}
        </span>
      ),
    },
    {
      key: "lifetimeEarned",
      header: "Lifetime Earned",
      render: (item) => (
        <span className="text-sm text-gray-700">
          {item.wallet?.lifetimeEarned ?? "—"}
        </span>
      ),
    },
    {
      key: "lifetimeSpent",
      header: "Lifetime Spent",
      render: (item) => (
        <span className="text-sm text-gray-700">
          {item.wallet?.lifetimeSpent ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <button
          onClick={() => handleOpenAdjust(item as WalletUser)}
          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
        >
          Adjust
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage user wallet balances and points
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={users.length} icon={Wallet} color="blue" />
        <StatCard title="Total Pal Points" value={totalPalPoints.toLocaleString()} icon={Coins} color="emerald" />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search users by name or email..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users as (WalletUser & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={setPage}
        emptyMessage="No users found"
      />

      {adjustModal.open && adjustModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Coins size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Adjust Wallet</h3>
                  <p className="text-sm text-gray-500">{adjustModal.user.name || adjustModal.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModal({ open: false, user: null, wallet: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {adjustModal.wallet && (
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4">
                <div>
                  <p className="text-xs text-gray-500">Current Points</p>
                  <p className="text-lg font-bold text-emerald-600">{adjustModal.wallet.palPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lifetime Earned</p>
                  <p className="text-lg font-bold text-gray-800">{adjustModal.wallet.lifetimeEarned}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (+ to add, - to subtract)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {adjustAmount.startsWith("-") ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 100 or -50"
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Bonus for contribution"
                  className="w-full rounded-lg border border-gray-300 py-2.5 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setAdjustModal({ open: false, user: null, wallet: null })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjusting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {adjusting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {adjusting ? "Adjusting..." : "Adjust"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
