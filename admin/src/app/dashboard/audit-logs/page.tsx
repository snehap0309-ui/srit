"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText, Search, Filter, X, ArrowUpDown,
  RefreshCw, FileDown
} from "lucide-react";
import { getAuditLogs, getAuditActions, getAuditEntityTypes, exportAuditLogsCSV } from "@/services/audit";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import type { AuditLog } from "@/types";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, sortBy: "createdAt", sortOrder };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;
      if (searchQuery) params.search = searchQuery;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await getAuditLogs(params);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
      setHasNext(res.pagination.hasNext);
      setHasPrev(res.pagination.hasPrev);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, searchQuery, fromDate, toDate, sortOrder]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    getAuditActions().then(setActions).catch(() => {});
    getAuditEntityTypes().then(setEntityTypes).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const blob = await exportAuditLogsCSV(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-logs.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      console.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = actionFilter || entityFilter || searchQuery || fromDate || toDate;

  const columns: Column<AuditLog & Record<string, unknown>>[] = [
    {
      key: "action",
      header: "Action",
      render: (item) => (
        <span className="font-medium">
          <StatusBadge status={item.action.replace(/_/g, " ")} />
        </span>
      ),
    },
    {
      key: "entityType",
      header: "Entity",
      render: (item) => (
        <div className="flex flex-col">
          <span className="capitalize text-gray-700">{item.entityType}</span>
          <span className="text-xs text-gray-400 font-mono">{item.entityId.slice(0, 12)}...</span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-gray-700 text-sm">
            {item.actor?.name || item.actor?.email || item.actorId.slice(0, 8)}
          </span>
        </div>
      ),
    },
    {
      key: "previousValues",
      header: "Changes",
      render: (item) => {
        const prev = item.previousValues;
        const next = item.newValues;
        const keys = Object.keys(prev || {}).slice(0, 2);
        if (keys.length === 0) return <span className="text-gray-400">—</span>;
        return (
          <div className="space-y-0.5 text-xs">
            {keys.map((k) => (
              <div key={k} className="text-gray-500">
                <span className="font-medium text-gray-700">{k}</span>:{" "}
                {String(prev?.[k] ?? "null")} →{" "}
                {String(next?.[k] ?? "null")}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "createdAt",
      header: "Timestamp",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all admin actions and system changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}>
            <Filter size={16} />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <FileDown size={16} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button onClick={() => { setPage(1); fetchLogs(); }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search actions, entities..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-8 py-2.5 text-sm outline-none focus:border-emerald-500" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          <ArrowUpDown size={14} />
          {sortOrder === "desc" ? "Newest" : "Oldest"}
        </button>
      </div>

      {showFilters && (
        <div className="mb-5 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Action</label>
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500">
                <option value="">All Actions</option>
                {actions.map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Entity Type</label>
              <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500">
                <option value="">All Entities</option>
                {entityTypes.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">From Date</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">To Date</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {logs.length > 0 ? `Showing ${logs.length} results` : hasActiveFilters ? "No matching logs" : ""}
            </span>
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
              <X size={12} /> Clear Filters
            </button>
          </div>
        </div>
      )}

      {!showFilters && (
        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500">
            <option value="">All Actions</option>
            {actions.map(a => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500">
            <option value="">All Entities</option>
            {entityTypes.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs as (AuditLog & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={setPage}
        emptyMessage="No audit logs found"
      />
    </div>
  );
}
