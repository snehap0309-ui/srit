"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Compass, Plus, Search, Edit3, Trash2, Eye, Power, PowerOff,
  MapPin, Trophy, Calendar, Star, Users, CheckCircle,
  AlertCircle
} from "lucide-react";
import { getQuests, createQuest, updateQuest, deleteQuest, getQuestCompletions } from "@/services/quests";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Quest {
  id: string;
  title: string;
  description: string | null;
  type: string;
  rewardPoints: number;
  placeIds: string[];
  image: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { completions: number };
}

const TYPES = [
  { value: 'scavenger_hunt', label: 'Scavenger Hunt', icon: MapPin },
  { value: 'quiz', label: 'Quiz', icon: Star },
  { value: 'photo_challenge', label: 'Photo Challenge', icon: MapPin },
];

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<any[]>([]);
  const [showCompletions, setShowCompletions] = useState<string | null>(null);
  const [compPage, setCompPage] = useState(1);
  const [compTotalPages, setCompTotalPages] = useState(1);
  const [loadingComp, setLoadingComp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: "", message: "", action: () => {} });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', type: 'scavenger_hunt', rewardPoints: 200,
    placeIds: '', image: '', startsAt: '', endsAt: ''
  });

  const fetchQuests = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filter) params.isActive = filter;
      if (searchQuery) params.search = searchQuery;
      const res = await getQuests(params);
      setQuests(res.data);
      setTotalPages(res.pagination.totalPages);
      setHasNext(res.pagination.hasNext);
      setHasPrev(res.pagination.hasPrev);
    } catch { setQuests([]); } finally { setLoading(false); }
  }, [page, filter, searchQuery]);

  useEffect(() => { fetchQuests(); }, [fetchQuests]);

  const fetchCompletions = async (questId: string, p: number = 1) => {
    setLoadingComp(true);
    try {
      const res = await getQuestCompletions(questId, { page: p, limit: 20 });
      setCompletions(res.data);
      setCompTotalPages(res.pagination.totalPages);
      setCompPage(p);
    } catch { setCompletions([]); } finally { setLoadingComp(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', description: '', type: 'scavenger_hunt', rewardPoints: 200, placeIds: '', image: '', startsAt: '', endsAt: '' });
    setShowModal(true);
  };

  const openEdit = (q: Quest) => {
    setEditingId(q.id);
    setForm({
      title: q.title, description: q.description || '', type: q.type,
      rewardPoints: q.rewardPoints,
      placeIds: q.placeIds.join(', '), image: q.image || '',
      startsAt: q.startsAt.slice(0, 16), endsAt: q.endsAt ? q.endsAt.slice(0, 16) : ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.startsAt) { setError('Title and start date required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const data = {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        rewardPoints: form.rewardPoints,
        placeIds: form.placeIds ? form.placeIds.split(',').map(s => s.trim()).filter(Boolean) : [],
        image: form.image || undefined,
        startsAt: form.startsAt,
        endsAt: form.endsAt || undefined,
      };
      if (editingId) {
        await updateQuest(editingId, { ...data, endsAt: form.endsAt || null });
      } else {
        await createQuest(data);
      }
      setShowModal(false);
      fetchQuests();
      setSuccess(editingId ? 'Quest updated!' : 'Quest created!');
    } catch { setError('Failed to save quest'); } finally { setSaving(false); }
  };

  const handleToggleActive = async (q: Quest) => {
    try {
      await updateQuest(q.id, { isActive: !q.isActive });
      fetchQuests();
      setSuccess(q.isActive ? 'Quest deactivated' : 'Quest activated');
    } catch { setError('Failed to toggle'); }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete Quest",
      message: "Delete this quest?",
      action: async () => {
        try { await deleteQuest(id); fetchQuests(); setSuccess('Quest deleted'); }
        catch { setError('Failed to delete'); }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const getTypeLabel = (type: string) => TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Treasure Hunts</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage location-based quests</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> New Quest
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={16} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto">&times;</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto">&times;</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search quests..." className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 w-48" />
          </div>
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <span className="text-sm text-gray-400">{quests.length} quests</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Compass size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No quests yet. Create your first treasure hunt!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quests.map(q => (
            <div key={q.id} className={`bg-white rounded-xl border shadow-sm p-5 ${q.isActive ? 'border-gray-100' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${q.isActive ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{q.title}</h3>
                    <span className="text-xs text-gray-500">{getTypeLabel(q.type)}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${q.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                  {q.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {q.description && (
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{q.description}</p>
              )}

              <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(q.startsAt).toLocaleDateString()}
                  {q.endsAt && <> &mdash; {new Date(q.endsAt).toLocaleDateString()}</>}
                </div>
                {q.rewardPoints > 0 && (
                  <div className="flex items-center gap-1">
                    <Trophy size={12} className="text-amber-500" />
                    {q.rewardPoints} pts
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  {q.placeIds.length} places
                </div>
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  {q._count.completions} completions
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button onClick={() => { setShowCompletions(q.id); fetchCompletions(q.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                  <Eye size={13} /> Completions
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggleActive(q)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100" title={q.isActive ? 'Deactivate' : 'Activate'}>
                    {q.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                  </button>
                  <button onClick={() => openEdit(q)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(q.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!hasPrev}
            className="text-sm text-gray-500 hover:text-blue-600 disabled:opacity-40">Previous</button>
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!hasNext}
            className="text-sm text-gray-500 hover:text-blue-600 disabled:opacity-40">Next</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit' : 'Create'} Quest</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Quest title" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Quest description" rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Reward Points</label>
                  <input type="number" value={form.rewardPoints} onChange={e => setForm(p => ({ ...p, rewardPoints: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Place IDs</label>
                  <input value={form.placeIds} onChange={e => setForm(p => ({ ...p, placeIds: e.target.value }))}
                    placeholder="id1, id2, id3" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Image URL</label>
                  <input value={form.image} onChange={e => setForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="https://..." className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date *</label>
                  <input type="datetime-local" value={form.startsAt} onChange={e => setForm(p => ({ ...p, startsAt: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
                  <input type="datetime-local" value={form.endsAt} onChange={e => setForm(p => ({ ...p, endsAt: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.title}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" /> : (editingId ? 'Update' : 'Create') + ' Quest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompletions && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Quest Completions</h3>
              <button onClick={() => setShowCompletions(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            {loadingComp ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              </div>
            ) : completions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No completions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completions.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-700 font-mono">{c.userId.slice(0, 12)}...</p>
                      <p className="text-xs text-gray-400">Completed {new Date(c.completedAt).toLocaleString()}</p>
                    </div>
                    <CheckCircle size={16} className="text-emerald-500" />
                  </div>
                ))}
              </div>
            )}
            {compTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => fetchCompletions(showCompletions, compPage - 1)} disabled={compPage === 1}
                  className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40">Previous</button>
                <span className="text-xs text-gray-400">Page {compPage} of {compTotalPages}</span>
                <button onClick={() => fetchCompletions(showCompletions, compPage + 1)} disabled={compPage >= compTotalPages}
                  className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40">Next</button>
              </div>
            )}
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
