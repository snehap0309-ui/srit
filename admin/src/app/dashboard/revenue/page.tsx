"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, QrCode, Tag, Download, TrendingUp,
} from "lucide-react";
import { getRevenueDashboard, exportRevenueCSV } from "@/services/revenue";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

interface RevenueData {
  metrics: { totalRedemptions: number; redemptionValue: number; totalOffers: number; activeOffers: number; avgRedemptions: number };
  revenueByCity: { city: string; redemptions: number; value: number }[];
  revenueByCategory: { category: string; redemptions: number; value: number }[];
  topOffers: { offerId: string; title: string; vendorName: string; redemptions: number; value: number }[];
  vendorPerformance: { vendorId: string; businessName: string; city: string; redemptions: number; revenue: number; offersCount: number }[];
  revenueTrend: { date: string; redemptions: number; value: number }[];
}

export default function RevenueAnalyticsPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRevenueDashboard();
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (type: string) => {
    try {
      const blob = await exportRevenueCSV({ type }) as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-${type}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-red-500">Failed to load revenue data</div>;
  }

  const KpiCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center mb-3`}>
        <Icon size={20} className={color.text} />
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Track business performance and redemptions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('redemptions')}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={16} /> Export Redemptions
          </button>
          <button onClick={() => handleExport('vendors')}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={16} /> Export Vendors
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Redemptions" value={data.metrics.totalRedemptions} icon={QrCode} color={{ bg: 'bg-blue-100', text: 'text-blue-600' }} />
        <KpiCard title="Redemption Value" value={`₹${data.metrics.redemptionValue.toLocaleString()}`} icon={DollarSign} color={{ bg: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard title="Total Offers" value={data.metrics.totalOffers} icon={Tag} color={{ bg: 'bg-amber-100', text: 'text-amber-600' }} subtitle={`${data.metrics.activeOffers} active`} />
        <KpiCard title="Avg Redemptions" value={data.metrics.avgRedemptions} icon={TrendingUp} color={{ bg: 'bg-purple-100', text: 'text-purple-600' }} subtitle="per offer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Area type="monotone" dataKey="value" name="Revenue (₹)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue by Category</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.revenueByCategory} innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="category">
                  {data.revenueByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Most Redeemed Offers</h2>
          </div>
          <div className="space-y-3">
            {data.topOffers.slice(0, 10).map((o, i) => (
              <div key={o.offerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.title}</p>
                    <p className="text-xs text-gray-500">{o.vendorName} · {o.redemptions} redemptions</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">₹{o.value.toLocaleString()}</span>
              </div>
            ))}
            {data.topOffers.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No data</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Vendor Performance</h2>
          </div>
          <div className="space-y-3">
            {data.vendorPerformance.slice(0, 10).map((v, i) => (
              <div key={v.vendorId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{v.businessName}</p>
                    <p className="text-xs text-gray-500">{v.city} · {v.offersCount} offers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">₹{v.revenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{v.redemptions} redemptions</p>
                </div>
              </div>
            ))}
            {data.vendorPerformance.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No data</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue by City</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByCity.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                <YAxis type="category" dataKey="city" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#374151'}} width={70} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Bar dataKey="value" name="Revenue (₹)" fill="#3B82F6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Offer Conversion</h2>
          <div className="space-y-4">
            {data.topOffers.slice(0, 8).map((o, i) => {
              const maxVal = Math.max(...data.topOffers.map(x => x.redemptions), 1);
              const pct = (o.redemptions / maxVal) * 100;
              return (
                <div key={o.offerId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700 truncate max-w-[200px]">{o.title}</span>
                    <span className="text-gray-500">{o.redemptions} redemptions</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.topOffers.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
