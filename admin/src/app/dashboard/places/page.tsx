"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search, Check, X as XIcon, Edit, Trash2, MapPin, Globe, Upload, Download, FileDown } from "lucide-react";
import { getPlaces, approvePlace, rejectPlace, deletePlace, importPlaces } from "@/services/places";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import PlaceForm from "@/components/PlaceForm";
import type { Place } from "@/types";
import Papa from "papaparse";

export default function PlacesPage() {
  const { notify } = useNotification();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Lakshadweep", "Puducherry",
  ];

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: "", message: "", action: () => {} });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [placeForm, setPlaceForm] = useState<{
    open: boolean;
    place: Place | null;
  }>({ open: false, place: null });

  const [importModal, setImportModal] = useState(false);
  const [importData, setImportData] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importStatus, setImportStatus] = useState("APPROVED");

  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlaces({
        page,
        limit: 15,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        state: stateFilter || undefined,
        city: cityFilter || undefined,
        search: search || undefined,
      });
      setPlaces(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
      setHasNext(res.pagination.hasNext);
      setHasPrev(res.pagination.hasPrev);
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, search, stateFilter, cityFilter]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approvePlace(id);
      fetchPlaces();
      notify('success', 'Place approved');
    } catch {
      notify('error', 'Failed to approve place');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectPlace(id);
      fetchPlaces();
      notify('success', 'Place rejected');
    } catch {
      notify('error', 'Failed to reject place');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete Place",
      message: "Are you sure? This action cannot be undone.",
      action: async () => {
        setActionLoading(id);
        try {
          await deletePlace(id);
          notify('success', 'Place deleted successfully');
        } catch {
          notify('error', 'Failed to delete place');
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(null);
        fetchPlaces();
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;

      if (file.name.endsWith('.csv')) {
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        const data = (parsed.data as any[]).map(normalizeRecord);
        setImportData(data);
        setImportResult(null);
        setImportModal(true);
      } else if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          const arr = Array.isArray(data) ? data : (data.places || data.data || []);
          setImportData(arr.map(normalizeRecord));
          setImportResult(null);
          setImportModal(true);
        } catch {
          notify('error', 'Invalid JSON file');
        }
      } else {
        notify('error', 'Please upload a CSV or JSON file');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const normalizeRecord = (record: any) => ({
    name: record.Name || record.name || record.title || '',
    description: record.Description || record.description || '',
    shortDescription: record["Short Description"] || record.shortDescription || record.short_description || '',
    latitude: parseFloat(record.Latitude || record.latitude || record.lat || '') || undefined,
    longitude: parseFloat(record.Longitude || record.longitude || record.lng || record.lon || '') || undefined,
    category: (record.Category || record.category || '').toLowerCase(),
    tags: parseTags(record.Tags || record.tags || ''),
    images: parseImages(record.Images || record.images || ''),
    city: record.City || record.city || '',
    state: record.State || record.state || '',
    country: record.Country || record.country || 'India',
    openingHours: record["Open From"] || record["Open Till"] || record.openingHours || record.opening_hours
      ? { from: record["Open From"] || '', till: record["Open Till"] || '' }
      : undefined,
    bestTimeToVisit: record["Best Season"] || record["Best Season/Months"] || record.bestTimeToVisit || record.best_time_to_visit || '',
    bestTimeReason: record["Best Time Reason"] || record.bestTimeReason || '',
  });

  const parseTags = (val: string) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map((t: string) => t.trim()).filter(Boolean);
  };

  const parseImages = (val: string) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map((t: string) => t.trim()).filter(Boolean);
  };

  const handleImport = async () => {
    if (!importData?.length) return;
    setImporting(true);
    try {
      const result = await importPlaces(importData, {
        overwrite: importOverwrite,
        source: 'ADMIN',
        status: importStatus,
      });
      setImportResult(result);
      notify('success', `Imported ${result.created} places (${result.skipped} skipped, ${result.errors} errors)`);
      fetchPlaces();
    } catch (err: any) {
      notify('error', err?.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<Place & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.images?.[0] ? (
            <img
              src={item.images[0]}
              alt=""
              className="h-9 w-9 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <MapPin size={16} className="text-gray-400" />
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-500">{item.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (item) => (
        <div className="text-sm">
          <p className="font-medium text-gray-700">
            {item.city ? `${item.city}, ` : ''}{item.state || ''}
          </p>
          <a
            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            <Globe size={12} />
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </a>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "tags",
      header: "Tags",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {(item.tags as string[])?.slice(0, 3).map((t: string, i: number) => (
            <span
              key={`${t}-${i}`}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {t}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "bestTime",
      header: "Best Time",
      render: (item) => {
        const btv = (item as any).bestTimeToVisit;
        const reason = (item as any).bestTimeReason;
        const months = btv?.bestMonths || (typeof btv === 'string' ? btv : '') || '';
        if (!months && !reason) return <span className="text-xs text-gray-400">—</span>;
        return (
          <div className="text-xs leading-tight">
            {months && <p className="font-medium text-gray-700">{months}</p>}
            {reason && <p className="text-gray-500 truncate max-w-[140px]">{reason}</p>}
          </div>
        );
      },
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
          {item.status === "PENDING" && (
            <>
              <button
                onClick={() => handleApprove(item.id)}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                title="Approve"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => handleReject(item.id)}
                disabled={actionLoading === item.id}
                className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Reject"
              >
                <XIcon size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => setPlaceForm({ open: true, place: item as Place })}
            className="rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-50"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            disabled={actionLoading === item.id}
            className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            title="Delete"
          >
            {actionLoading === item.id ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Places</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalRecords > 0
              ? `Manage, approve, and edit places — ${totalRecords.toLocaleString()} total`
              : 'Manage, approve, and edit places'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <Upload size={18} />
            Import CSV/JSON
          </button>
          <button
            onClick={() => setPlaceForm({ open: true, place: null })}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus size={18} />
            Add Place
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search places..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Categories</option>
          <option value="ghat">Ghat</option>
          <option value="temple">Temple</option>
          <option value="waterfall">Waterfall</option>
          <option value="mosque">Mosque</option>
          <option value="church">Church</option>
          <option value="gurudwara">Gurudwara</option>
          <option value="monument">Monument</option>
          <option value="museum">Museum</option>
          <option value="park">Park</option>
          <option value="lake">Lake</option>
          <option value="fort">Fort</option>
          <option value="beach">Beach</option>
          <option value="market">Market</option>
          <option value="trek">Trek</option>
          <option value="palace">Palace</option>
          <option value="adventure">Adventure</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All States</option>
          {INDIAN_STATES.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
        <input
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by City..."
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <DataTable
        columns={columns}
        data={places as (Place & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={setPage}
        emptyMessage="No places found"
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />

      <PlaceForm
        key={placeForm.place?.id || 'new'}
        open={placeForm.open}
        place={placeForm.place}
        onClose={() => setPlaceForm({ open: false, place: null })}
        onSaved={fetchPlaces}
      />

      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {importResult ? 'Import Complete' : 'Import Places'}
                </h2>
                <p className="text-sm text-gray-500">
                  {importData?.length} records found in file
                </p>
              </div>
              <button
                onClick={() => { setImportModal(false); setImportResult(null); }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="p-6">
              {importResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-lg bg-emerald-50 p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                      <p className="text-sm text-emerald-700">Created</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                      <p className="text-sm text-amber-700">Skipped</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                      <p className="text-sm text-red-700">Errors</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{importResult.total}</p>
                      <p className="text-sm text-blue-700">Total</p>
                    </div>
                  </div>

                  {importResult.skippedReasons?.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-700">Skipped Records</h3>
                      <div className="max-h-40 overflow-y-auto rounded-lg border p-3 text-sm text-gray-600">
                        {importResult.skippedReasons.slice(0, 50).map((r: any, i: number) => (
                          <p key={i} className="mb-1">
                            <span className="font-medium">{r.name}</span>: {r.reason}
                          </p>
                        ))}
                        {importResult.skippedReasons.length > 50 && (
                          <p className="text-xs text-gray-400">...and {importResult.skippedReasons.length - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {importResult.errorDetails?.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-red-700">Errors</h3>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {importResult.errorDetails.map((r: any, i: number) => (
                          <p key={i} className="mb-1"><span className="font-medium">{r.name}</span>: {r.error}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => { setImportModal(false); setImportResult(null); }}
                      className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="importStatus"
                        checked={importStatus === 'APPROVED'}
                        onChange={() => setImportStatus('APPROVED')}
                        className="accent-emerald-600"
                      />
                      Approve all
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="importStatus"
                        checked={importStatus === 'PENDING'}
                        onChange={() => setImportStatus('PENDING')}
                        className="accent-amber-600"
                      />
                      Keep pending
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={importOverwrite}
                        onChange={(e) => setImportOverwrite(e.target.checked)}
                        className="accent-blue-600"
                      />
                      Overwrite existing
                    </label>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">#</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Category</th>
                          <th className="px-4 py-2">City</th>
                          <th className="px-4 py-2">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importData!.slice(0, 200).map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">{item.name || '?'}</td>
                            <td className="px-4 py-2 text-gray-600">{item.category || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{item.city || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{item.state || '—'}</td>
                          </tr>
                        ))}
                        {importData!.length > 200 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-400">
                              ...and {importData!.length - 200} more records
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {importData!.length} records ready for import
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setImportModal(false); setImportResult(null); }}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={importing}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {importing ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Upload size={16} />
                        )}
                        Import {importData!.length} Places
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
