"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell, Send, Users, MapPin, Tag, FileText, Plus, Trash2,
  Edit3, RefreshCw, CheckCircle, AlertCircle, Eye
} from "lucide-react";
import {
  getAdminNotificationList, sendNotification, sendToRole, sendToCity,
  sendToCategory, getTemplates, createTemplate, updateTemplate,
  deleteTemplate, sendFromTemplate
} from "@/services/notificationsAdmin";
import ConfirmDialog from "@/components/ConfirmDialog";

type Tab = 'send' | 'templates' | 'history';

interface TempForm {
  name: string;
  title: string;
  body: string;
  type: string;
  variables: string;
}

interface SendForm {
  targetType: 'user' | 'role' | 'city' | 'category';
  userId: string;
  title: string;
  body: string;
  type: string;
  role: string;
  city: string;
  category: string;
  templateId: string;
  templateTarget: { type: string; value: string };
  templateVars: string;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('send');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sendForm, setSendForm] = useState<SendForm>({
    targetType: 'user', userId: '', title: '', body: '', type: 'admin',
    role: 'USER', city: '', category: '', templateId: '',
    templateTarget: { type: 'role', value: 'USER' }, templateVars: ''
  });
  const [tempForm, setTempForm] = useState<TempForm>({ name: '', title: '', body: '', type: 'admin', variables: '' });
  const [templates, setTemplates] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: "", message: "", action: () => {} });

  const fetchTemplates = useCallback(async () => {
    try {
      const t = await getTemplates();
      setTemplates(t);
    } catch { setTemplates([]); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getAdminNotificationList({ page: historyPage, limit: 20 });
      setHistory(res.data || []);
    } catch { setHistory([]); }
  }, [historyPage]);

  useEffect(() => { if (tab === 'templates') fetchTemplates(); }, [tab, fetchTemplates]);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  const handleSend = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      if (sendForm.targetType === 'user') {
        await sendNotification({ userId: sendForm.userId, title: sendForm.title, body: sendForm.body, type: sendForm.type });
      } else if (sendForm.targetType === 'role') {
        await sendToRole({ role: sendForm.role, title: sendForm.title, body: sendForm.body, type: sendForm.type });
      } else if (sendForm.targetType === 'city') {
        await sendToCity({ city: sendForm.city, title: sendForm.title, body: sendForm.body, type: sendForm.type });
      } else {
        await sendToCategory({ category: sendForm.category, title: sendForm.title, body: sendForm.body, type: sendForm.type });
      }
      setSuccess('Notification sent successfully!');
      setSendForm(prev => ({ ...prev, title: '', body: '' }));
    } catch {
      setError('Failed to send notification');
    } finally { setLoading(false); }
  };

  const handleSendFromTemplate = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      let variables: Record<string, string> = {};
      try { variables = JSON.parse(sendForm.templateVars || '{}'); } catch { }
      await sendFromTemplate({
        templateId: sendForm.templateId,
        target: sendForm.templateTarget,
        variables
      });
      setSuccess('Template notification sent!');
    } catch {
      setError('Failed to send template notification');
    } finally { setLoading(false); }
  };

  const handleSaveTemplate = async () => {
    setLoading(true); setError('');
    try {
      const vars = tempForm.variables ? tempForm.variables.split(',').map(v => v.trim()).filter(Boolean) : [];
      if (editingTemplate) {
        await updateTemplate(editingTemplate, {
          name: tempForm.name, title: tempForm.title, body: tempForm.body,
          type: tempForm.type, variables: vars
        });
      } else {
        await createTemplate({
          name: tempForm.name, title: tempForm.title, body: tempForm.body,
          type: tempForm.type, variables: vars
        });
      }
      setShowTempModal(false);
      setEditingTemplate(null);
      setTempForm({ name: '', title: '', body: '', type: 'admin', variables: '' });
      fetchTemplates();
      setSuccess('Template saved!');
    } catch {
      setError('Failed to save template');
    } finally { setLoading(false); }
  };

  const handleEditTemplate = (t: any) => {
    setEditingTemplate(t.id);
    setTempForm({ name: t.name, title: t.title, body: t.body || '', type: t.type || 'admin', variables: (t.variables || []).join(', ') });
    setShowTempModal(true);
  };

  const handleDeleteTemplate = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete Template",
      message: "Delete this template?",
      action: async () => {
        try {
          await deleteTemplate(id);
          fetchTemplates();
          setSuccess('Template deleted');
        } catch {
          setError('Failed to delete');
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'send', label: 'Send Notification', icon: Send },
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'history', label: 'History', icon: Eye },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">Send and manage push notifications</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
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

      {tab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Send</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Target</label>
                <div className="flex gap-2 flex-wrap">
                  {(['user', 'role', 'city', 'category'] as const).map(t => (
                    <button key={t} onClick={() => setSendForm(prev => ({ ...prev, targetType: t }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        sendForm.targetType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {t === 'user' ? <Bell size={13} /> : t === 'role' ? <Users size={13} /> : t === 'city' ? <MapPin size={13} /> : <Tag size={13} />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {sendForm.targetType === 'user' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">User ID</label>
                  <input value={sendForm.userId} onChange={e => setSendForm(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="Enter user ID" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              {sendForm.targetType === 'role' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Role</label>
                  <select value={sendForm.role} onChange={e => setSendForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                    <option value="USER">User</option>
                    <option value="TOURIST">Tourist</option>
                    <option value="PARTNER">Vendor</option>
                    <option value="CREATOR">Creator</option>
                    <option value="ADMIN">Admin</option>
                    <option value="ALL">All Users</option>
                  </select>
                </div>
              )}
              {sendForm.targetType === 'city' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">City</label>
                  <input value={sendForm.city} onChange={e => setSendForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city name" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              {sendForm.targetType === 'category' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Category</label>
                  <input value={sendForm.category} onChange={e => setSendForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Enter category" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Title</label>
                <input value={sendForm.title} onChange={e => setSendForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Body</label>
                <textarea value={sendForm.body} onChange={e => setSendForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Notification body" rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</label>
                <select value={sendForm.type} onChange={e => setSendForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option value="admin">Admin</option>
                  <option value="promo">Promo</option>
                  <option value="alert">Alert</option>
                  <option value="update">Update</option>
                </select>
              </div>
              <button onClick={handleSend} disabled={loading || !sendForm.title || (sendForm.targetType === 'user' && !sendForm.userId)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send size={16} />}
                Send Notification
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Send from Template</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Template</label>
                <select value={sendForm.templateId} onChange={e => setSendForm(prev => ({ ...prev, templateId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option value="">Select template</option>
                  {templates.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Target Type</label>
                <select value={sendForm.templateTarget.type} onChange={e => setSendForm(prev => ({ ...prev, templateTarget: { ...prev.templateTarget, type: e.target.value } }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option value="role">Role</option>
                  <option value="city">City</option>
                  <option value="category">Category</option>
                  <option value="all">All Users</option>
                </select>
              </div>
              {sendForm.templateTarget.type !== 'all' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Target Value</label>
                  <input value={sendForm.templateTarget.value} onChange={e => setSendForm(prev => ({ ...prev, templateTarget: { ...prev.templateTarget, value: e.target.value } }))}
                    placeholder={sendForm.templateTarget.type === 'role' ? 'USER, ADMIN, etc.' : 'City or category name'}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Variables (JSON)</label>
                <textarea value={sendForm.templateVars} onChange={e => setSendForm(prev => ({ ...prev, templateVars: e.target.value }))}
                  placeholder='{"name": "User", "code": "SAVE50"}'
                  rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 font-mono resize-none" />
              </div>
              <button onClick={handleSendFromTemplate} disabled={loading || !sendForm.templateId}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send size={16} />}
                Send from Template
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{templates.length} templates</p>
            <button onClick={() => { setEditingTemplate(null); setTempForm({ name: '', title: '', body: '', type: 'admin', variables: '' }); setShowTempModal(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
              <Plus size={16} /> New Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t: any) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full capitalize">{t.type}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-1">{t.title}</p>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.body || 'No body'}</p>
                {t.variables && t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.variables.map((v: string) => (
                      <span key={v} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{'{' + v + '}'}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => handleEditTemplate(t)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => handleDeleteTemplate(t.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No templates yet. Create one to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Recent notifications</p>
            <button onClick={() => { setHistoryPage(1); fetchHistory(); }}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {history.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Bell size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No notifications sent yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {history.map((n: any) => (
                  <div key={n.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body || ''}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">
                        To: {Array.isArray(n.recipients) ? `${n.recipients.length} users` : (n.recipientId || n.role || n.city || n.category || '—')}
                      </span>
                      {n.type && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{n.type}</span>}
                      {n.readAt && <span className="text-xs text-emerald-600">Read</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {history.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                className="text-sm text-gray-500 hover:text-blue-600 disabled:opacity-40">Previous</button>
              <span className="text-xs text-gray-400">Page {historyPage}</span>
              <button onClick={() => setHistoryPage(p => p + 1)} disabled={history.length < 20}
                className="text-sm text-gray-500 hover:text-blue-600 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {showTempModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editingTemplate ? 'Edit' : 'Create'} Template</h3>
              <button onClick={() => setShowTempModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                <input value={tempForm.name} onChange={e => setTempForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template name" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
                <input value={tempForm.title} onChange={e => setTempForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Body</label>
                <textarea value={tempForm.body} onChange={e => setTempForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Notification body (use {variable} placeholders)" rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                <select value={tempForm.type} onChange={e => setTempForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option value="admin">Admin</option>
                  <option value="promo">Promo</option>
                  <option value="alert">Alert</option>
                  <option value="update">Update</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Variables (comma-separated)</label>
                <input value={tempForm.variables} onChange={e => setTempForm(prev => ({ ...prev, variables: e.target.value }))}
                  placeholder="name, code, discount" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <button onClick={handleSaveTemplate} disabled={loading || !tempForm.name || !tempForm.title}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {editingTemplate ? 'Update' : 'Create'} Template
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
