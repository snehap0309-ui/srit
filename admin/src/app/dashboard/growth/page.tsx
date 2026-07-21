"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, TrendingUp, CalendarDays, Activity, UserPlus,
  ArrowUp,
} from "lucide-react";
import { getGrowthDashboard } from "@/services/growth";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';

interface GrowthData {
  metrics: {
    totalUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    dau: number;
    wau: number;
    mau: number;
    d1Retention: number;
    d7Retention: number;
    d30Retention: number;
  };
  charts: {
    dailySignups: { date: string; signups: number; activeUsers: number }[];
    weeklyGrowth: { week: string; newUsers: number; totalUsers: number }[];
    monthlyGrowth: { month: string; newUsers: number; totalUsers: number }[];
    activeUsersTrend: { date: string; activeUsers: number }[];
    userGrowthTrend: { date: string; signups: number }[];
  };
}

const FILTERS = [
  { label: 'Today', value: '1' },
  { label: '7 Days', value: '7' },
  { label: '30 Days', value: '30' },
  { label: '90 Days', value: '90' },
  { label: 'Custom', value: 'custom' },
];

export default function GrowthAnalyticsPage() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (period === 'custom') {
        if (customFrom) params.from = customFrom;
        if (customTo) params.to = customTo;
      } else {
        const days = parseInt(period);
        const to = new Date();
        const from = new Date(to.getTime() - days * 86400000);
        params.from = from.toISOString().split('T')[0];
        params.to = to.toISOString().split('T')[0];
      }
      const result = await getGrowthDashboard(params);
      setData(result);
    } catch (e) {
      console.error("Failed to load growth data", e);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-red-500">Failed to load growth analytics</div>;
  }

  const { metrics, charts } = data;

  const MetricCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center`}>
          <Icon size={20} className={color.text} />
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">User growth, retention, and engagement metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPeriod(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === f.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-sm font-medium text-gray-700">From:</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-sm font-medium text-gray-700">To:</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            Apply
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Users" value={metrics.totalUsers} icon={Users} color={{ bg: 'bg-blue-100', text: 'text-blue-600' }} />
        <MetricCard title="New Today" value={metrics.newUsersToday} icon={UserPlus} color={{ bg: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <MetricCard title="This Week" value={metrics.newUsersThisWeek} icon={CalendarDays} color={{ bg: 'bg-purple-100', text: 'text-purple-600' }} />
        <MetricCard title="This Month" value={metrics.newUsersThisMonth} icon={TrendingUp} color={{ bg: 'bg-amber-100', text: 'text-amber-600' }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard title="DAU" value={metrics.dau} icon={Activity} color={{ bg: 'bg-cyan-100', text: 'text-cyan-600' }} subtitle="Daily Active Users" />
        <MetricCard title="WAU" value={metrics.wau} icon={Activity} color={{ bg: 'bg-indigo-100', text: 'text-indigo-600' }} subtitle="Weekly Active Users" />
        <MetricCard title="MAU" value={metrics.mau} icon={Activity} color={{ bg: 'bg-rose-100', text: 'text-rose-600' }} subtitle="Monthly Active Users" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard title="D1 Retention" value={`${metrics.d1Retention}%`} icon={ArrowUp} color={{ bg: 'bg-green-100', text: 'text-green-600' }} />
        <MetricCard title="D7 Retention" value={`${metrics.d7Retention}%`} icon={ArrowUp} color={{ bg: 'bg-teal-100', text: 'text-teal-600' }} />
        <MetricCard title="D30 Retention" value={`${metrics.d30Retention}%`} icon={ArrowUp} color={{ bg: 'bg-sky-100', text: 'text-sky-600' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Daily Signups & Active Users</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.dailySignups}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" name="Signups" dataKey="signups" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#signupGrad)" />
                <Area type="monotone" name="Active Users" dataKey="activeUsers" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#activeGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">User Growth Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.userGrowthTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="signups" name="New Signups" fill="#3B82F6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {(charts.monthlyGrowth?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Monthly Growth</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.monthlyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="newUsers" name="New Users" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalUsers" name="Total Users" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {charts.weeklyGrowth?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Weekly Growth</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.weeklyGrowth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" dataKey="newUsers" name="New Users" stroke="#10B981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="totalUsers" name="Total Users" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
