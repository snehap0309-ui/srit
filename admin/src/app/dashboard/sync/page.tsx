"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getSyncStatus, getSyncItems } from "@/services/sync";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import type { SyncItem, SyncStats } from "@/types";

export default function SyncPage() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, itemsData] = await Promise.all([
        getSyncStatus(),
        getSyncItems({ page, limit: 15 }),
      ]);
      setStats(statsData);
      setItems(itemsData.data);
      setTotalPages(itemsData.pagination.totalPages);
      setHasNext(itemsData.pagination.hasNext);
      setHasPrev(itemsData.pagination.hasPrev);
    } catch {
      // server may not be connected
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<SyncItem & Record<string, unknown>>[] = [
    { key: "action", header: "Action" },
    { key: "entityType", header: "Entity" },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "retryCount",
      header: "Retries",
      render: (item) => (
        <span className="text-sm text-gray-500">{item.retryCount}</span>
      ),
    },
    {
      key: "error",
      header: "Error",
      render: (item) =>
        item.error ? (
          <span className="max-w-[200px] truncate text-xs text-red-500" title={item.error}>
            {item.error}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "createdAt",
      header: "Queued",
      render: (item) => (
        <span className="text-sm text-gray-500">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sync Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor offline data synchronization
        </p>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Jobs"
          value={stats?.total || 0}
          icon={RefreshCw}
          color="blue"
        />
        <StatCard
          title="Pending"
          value={stats?.pending || 0}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Processing"
          value={stats?.processing || 0}
          icon={Loader2}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={stats?.completed || 0}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Failed"
          value={stats?.failed || 0}
          icon={AlertCircle}
          color="red"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {stats && stats.pending > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-blue-600">
            <Loader2 size={14} className="animate-spin" />
            {stats.pending} jobs in queue
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={items as (SyncItem & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={setPage}
        emptyMessage="No sync jobs"
      />
    </div>
  );
}
