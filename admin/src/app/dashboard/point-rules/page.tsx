"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Search, ToggleLeft, ToggleRight, RotateCcw, Edit3, Save, X } from "lucide-react";
import client from "@/services/client";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";

interface PointRule {
  id: string;
  key: string;
  label: string;
  description: string | null;
  points: number;
  category: string;
  isActive: boolean;
  cooldownSec: number | null;
  maxDaily: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export default function PointRulesPage() {
  const { notify } = useNotification();
  const [rules, setRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: "danger" | "primary";
    action: () => void;
  }>({ open: false, title: "", message: "", variant: "danger", action: () => {} });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get<{ success: boolean; data: PointRule[] }>("/point-rules");
      setRules(res.data.data || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleActive = async (rule: PointRule) => {
    setActionLoading(rule.id);
    try {
      await client.patch(`/point-rules/${rule.id}`, { isActive: !rule.isActive });
      notify("success", rule.isActive ? "Rule deactivated" : "Rule activated");
      fetchRules();
    } catch {
      notify("error", "Failed to update rule");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (rule: PointRule) => {
    setEditingId(rule.id);
    setEditValue(String(rule.points));
  };

  const handleSaveEdit = async (rule: PointRule) => {
    const newPoints = parseInt(editValue, 10);
    if (isNaN(newPoints) || newPoints < 0) {
      notify("error", "Please enter a valid positive number");
      return;
    }
    setActionLoading(rule.id);
    try {
      await client.patch(`/point-rules/${rule.id}`, { points: newPoints });
      notify("success", "Points value updated successfully");
      setEditingId(null);
      fetchRules();
    } catch {
      notify("error", "Failed to update points value");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      open: true,
      title: "Reset to Defaults",
      message: "Reset all point rules to their default values? This action cannot be undone.",
      variant: "danger",
      action: async () => {
        setActionLoading("reset");
        try {
          await client.post("/point-rules/reset-defaults");
          notify("success", "Point rules reset to defaults");
          fetchRules();
        } catch {
          notify("error", "Failed to reset point rules");
        } finally {
          setActionLoading(null);
          setConfirmDialog((p) => ({ ...p, open: false }));
        }
      },
    });
  };

  const filteredRules = rules.filter((r) => {
    const matchesSearch = !search || r.label.toLowerCase().includes(search.toLowerCase()) || r.key.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [...new Set(rules.map((r) => r.category))];
  const activeCount = rules.filter((r) => r.isActive).length;
  const totalPoints = rules.reduce((sum, r) => sum + r.points, 0);

  const columns: Column<PointRule & Record<string, unknown>>[] = [
    {
      key: "key",
      header: "Key",
      render: (item) => (
        <div>
          <p className="font-mono text-xs text-gray-500">{item.key}</p>
        </div>
      ),
    },
    {
      key: "label",
      header: "Label",
      render: (item) => (
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{item.label}</p>
          {item.description && (
            <span className="hidden text-xs text-gray-400 lg:inline" title={item.description}>
              ({item.description.slice(0, 40)})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "points",
      header: "Points",
      render: (item) => (
        <div className="flex items-center gap-2">
          {editingId === item.id ? (
            <>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(item);
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              <button
                onClick={() => handleSaveEdit(item)}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              >
                <Save size={14} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="rounded-lg p-1 text-red-600 hover:bg-red-50"
              >
                <X size={14} />
              </button>
            </>
          ) : item.key === 'admin_bonus' ? (
            <span className="text-sm font-medium text-gray-500" title="Set per user in Wallets → Adjust">
              Admin choice
            </span>
          ) : (
            <>
              <span className="font-semibold text-emerald-600">{item.points}</span>
              <button
                onClick={() => handleStartEdit(item)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Edit"
              >
                <Edit3 size={12} />
              </button>
            </>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item) => (
        <span className="text-sm text-gray-600 capitalize">{item.category}</span>
      ),
    },
    {
      key: "cooldownSec",
      header: "Cooldown",
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.cooldownSec ? `${item.cooldownSec}s` : "—"}
        </span>
      ),
    },
    {
      key: "maxDaily",
      header: "Max Daily",
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.maxDaily ?? "∞"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (item) => (
        <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToggleActive(item)}
            disabled={actionLoading === item.id}
            className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
            title={item.isActive ? "Deactivate" : "Activate"}
          >
            {item.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Point Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure points awarded for user actions
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <RotateCcw size={16} />
          Reset to Defaults
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rules" value={rules.length} icon={Settings} color="emerald" />
        <StatCard title="Active" value={activeCount} icon={ToggleRight} color="blue" />
        <StatCard title="Inactive" value={rules.length - activeCount} icon={ToggleLeft} color="red" />
        <StatCard title="Categories" value={uniqueCategories.length} icon={Settings} color="purple" />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label or key..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filteredRules as (PointRule & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="No point rules configured"
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
