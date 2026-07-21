"use client";

import { useState } from "react";
import {
  FileText, Download, Users, Store, MapPin, DollarSign, BarChart3,
  FileDown
} from "lucide-react";

const REPORT_TYPES = [
  { value: 'users', label: 'Users Report', icon: Users, desc: 'User registrations, roles, activity' },
  { value: 'vendors', label: 'Vendors Report', icon: Store, desc: 'Vendor performance metrics' },
  { value: 'places', label: 'Places Report', icon: MapPin, desc: 'Place creation, categories, statuses' },
  { value: 'revenue', label: 'Revenue Report', icon: DollarSign, desc: 'Revenue, redemptions, trends' },
  { value: 'engagement', label: 'Engagement Report', icon: BarChart3, desc: 'User engagement, sessions, retention' },
];

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState('users');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const selectedReport = REPORT_TYPES.find(r => r.value === selectedType);
  const Icon = selectedReport?.icon || FileText;

  const handleGenerate = async (format: string = 'json') => {
    setLoading(true); setError(''); setData(null);
    try {
      const { generateReport } = await import('@/services/reports');
      const params: any = { type: selectedType, format };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (city) params.city = city;
      if (category) params.category = category;

      const result = await generateReport(params);
      if (format === 'csv') {
        const url = window.URL.createObjectURL(result as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}-report.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setData(result);
      }
    } catch {
      setError('Failed to generate report');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Generate and export data reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Report Type</h2>
            <div className="space-y-2">
              {REPORT_TYPES.map(r => (
                <button key={r.value} onClick={() => { setSelectedType(r.value); setData(null); }}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedType === r.value ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                  <div className={`p-2 rounded-lg ${selectedType === r.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <r.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Filters</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Filter by city"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Filter by category"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-600 text-white">
                  <Icon size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selectedReport?.label}</h2>
                  <p className="text-xs text-gray-500">Configure options below</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleGenerate('json')} disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <BarChart3 size={16} />}
                  Generate
                </button>
                <button onClick={() => handleGenerate('csv')} disabled={loading}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <FileDown size={16} /> Export CSV
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            )}

            {!loading && data && (
              <div className="space-y-4">
                {data.metrics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {Object.entries(data.metrics).map(([key, val]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-lg font-bold text-gray-900">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {data.summary && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">Summary</h3>
                    <p className="text-sm text-blue-700">{data.summary}</p>
                  </div>
                )}

                {data.rows && data.rows.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Results ({data.rows.length})</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(data.rows[0]).slice(0, 10).map((key) => (
                              <th key={key} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                                {key.replace(/([A-Z])/g, ' $1')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.rows.slice(0, 50).map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {Object.keys(row).slice(0, 10).map((key) => (
                                <td key={key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                                  {String(row[key] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {data.rows.length > 50 && (
                      <p className="text-xs text-gray-400 mt-2">Showing 50 of {data.rows.length} rows. Use CSV export for full data.</p>
                    )}
                  </div>
                )}

                {!data.metrics && !data.summary && !data.rows && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{JSON.stringify(data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {!loading && !data && !error && (
              <div className="text-center py-16 text-gray-400">
                <FileText size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a report type and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
