"use client";

import { useEffect, useState } from "react";
import {
  Users, Store, QrCode, Star, Diamond, Video, TrendingUp, TrendingDown,
  ChevronRight, CheckCircle, Clock, MapPin, Bell
} from "lucide-react";
import client from "@/services/client";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardData {
  kpis: {
    totalUsers: { value: number; prev: number };
    dau: { value: number; prev: number };
    mau: { value: number; prev: number };
    activeVendors: { value: number; prev: number };
    qrRedemptions: { value: number; prev: number };
    hiddenGems: { value: number };
    reelsUploaded: { value: number; prev: number };
  };
  charts: {
    userGrowth: { date: string; newUsers: number; dau: number; mau: number }[];
    vendorGrowth: { date: string; vendors: number }[];
    redemptionsPie: { name: string; value: number }[];
  };
  cityAnalytics: { city: string; users: number; growth: number }[];
  pendingApprovals: { hiddenGems: number; vendors: number };
  recentActivity: { id: string; action: string; user: string; target: string; time: string }[];
  quickStats: { newUsers: number; reelsUploaded: number; reviews: number; checkIns: number; qrRedeemed: number };
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await client.get<{ success: boolean; data: DashboardData }>("/analytics/dashboard");
        setData(res.data.data);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-64 bg-gray-200 rounded-lg" />
            <div className="h-4 w-48 bg-gray-100 rounded mt-2" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-9 w-36 bg-gray-200 rounded-lg" />
            <div className="h-9 w-9 bg-gray-200 rounded-lg" />
            <div className="h-9 w-24 bg-gray-200 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="w-8 h-8 bg-gray-200 rounded-lg mb-3" />
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
              <div className="h-64 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-red-500">Failed to load dashboard data</div>;
  }

  const d = data;

  const renderTrend = (current: number, prev: number) => {
    if (prev === 0) return <span className="text-emerald-500 text-xs font-semibold flex items-center"><TrendingUp size={12} className="mr-1"/> +100%</span>;
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    if (pct >= 0) return <span className="text-emerald-500 text-xs font-semibold flex items-center"><TrendingUp size={12} className="mr-1"/> +{pct.toFixed(1)}%</span>;
    return <span className="text-red-500 text-xs font-semibold flex items-center"><TrendingDown size={12} className="mr-1"/> {pct.toFixed(1)}%</span>;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back, Admin! 👋</h1>
          <p className="mt-1 text-sm text-gray-500">Here's what's happening on PalSafar today.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 flex items-center gap-2 shadow-sm">
            <Clock size={16} /> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <button className="relative p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:bg-gray-50">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="flex items-center gap-3 bg-white p-1.5 pr-4 rounded-full border border-gray-200 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">A</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 leading-none">Admin</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Super Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {[
          { title: 'Total Users', value: d.kpis?.totalUsers?.value || 0, prev: d.kpis?.totalUsers?.prev || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { title: 'DAU', value: d.kpis?.dau?.value || 0, prev: d.kpis?.dau?.prev || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'MAU', value: d.kpis?.mau?.value || 0, prev: d.kpis?.mau?.prev || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
          { title: 'Active Vendors', value: d.kpis?.activeVendors?.value || 0, prev: d.kpis?.activeVendors?.prev || 0, icon: Store, color: 'text-orange-500', bg: 'bg-orange-100' },
          { title: 'QR Redemptions', value: d.kpis?.qrRedemptions?.value || 0, prev: d.kpis?.qrRedemptions?.prev || 0, icon: QrCode, color: 'text-pink-600', bg: 'bg-pink-100' },
          { title: 'Hidden Gems', value: d.kpis?.hiddenGems?.value || 0, subtitle: 'Pending Approval', icon: Diamond, color: 'text-teal-600', bg: 'bg-teal-100' },
          { title: 'Reels Uploaded', value: d.kpis?.reelsUploaded?.value || 0, prev: d.kpis?.reelsUploaded?.prev || 0, icon: Video, color: 'text-blue-500', bg: 'bg-blue-100' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1 truncate">{kpi.title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900">{kpi.value.toLocaleString()}</span>
                {kpi.prev !== undefined && renderTrend(kpi.value, kpi.prev)}
              </div>
              {kpi.subtitle && <p className="text-[10px] text-orange-500 font-medium mt-1">{kpi.subtitle}</p>}
              {kpi.prev !== undefined && <p className="text-[10px] text-gray-400 mt-1">vs last 30 days</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">User Growth <span className="text-gray-400 font-normal">(Last 30 Days)</span></h2>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full">View All</button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.charts?.userGrowth || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMau" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" name="New Users" dataKey="newUsers" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" />
                <Area type="monotone" name="DAU" dataKey="dau" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorDau)" />
                <Area type="monotone" name="MAU" dataKey="mau" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorMau)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vendor Growth */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Vendor Growth <span className="text-gray-400 font-normal">(Last 30 Days)</span></h2>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full">View All</button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.charts?.vendorGrowth || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="vendors" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* QR Redemptions Overview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">QR Redemptions Overview</h2>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full">View All</button>
          </div>
          <div className="flex-1 flex items-center">
          <div className="w-1/3">
            <div className="mb-4">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Total</p>
              <p className="text-xl font-bold text-blue-600">{(d.kpis?.qrRedemptions?.value || 0).toLocaleString()}</p>
            </div>
            <div className="mb-4">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Previous Period</p>
              <p className="text-xl font-bold text-gray-900">{(d.kpis?.qrRedemptions?.prev || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">vs Last 30 Days</p>
              <p className="text-lg font-bold mt-1">{(d.kpis?.qrRedemptions?.prev || 0) > 0
                ? renderTrend(d.kpis?.qrRedemptions?.value || 0, d.kpis?.qrRedemptions?.prev || 0)
                : <span className="text-gray-400">N/A</span>
              }</p>
            </div>
          </div>
            <div className="w-2/3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.charts?.redemptionsPie || []} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {(d.charts?.redemptionsPie || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* City Analytics */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">City Analytics <span className="text-gray-400 font-normal">(Top 5 Cities)</span></h2>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full">View All</button>
          </div>
          <div className="space-y-4">
            {(d.cityAnalytics || []).map((city, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">{i + 1}</div>
                  <span className="text-sm font-medium text-gray-900">{city.city}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{city.users.toLocaleString()} Users</span>
                  <span className="text-xs font-bold text-emerald-500 w-10 text-right">↑ {city.growth}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center opacity-30">
            {/* Map Placeholder silhouette */}
            <MapPin size={120} className="text-blue-200" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Pending Approvals</h2>
          
          <div className="bg-red-50 rounded-xl p-4 flex items-center gap-4 border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center shrink-0">
              <Diamond size={24} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium">Hidden Gems</p>
              <p className="text-xl font-bold text-gray-900">{d.pendingApprovals?.hiddenGems || 0}</p>
              <p className="text-[10px] text-red-500 font-medium">Pending Review</p>
            </div>
            <button className="bg-red-100 text-red-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-200">Review Now</button>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-4 border border-emerald-100">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <Store size={24} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium">Vendors</p>
              <p className="text-xl font-bold text-gray-900">{d.pendingApprovals?.vendors || 0}</p>
              <p className="text-[10px] text-emerald-600 font-medium">Pending Approval</p>
            </div>
            <button className="bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-200">View Now</button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-full">View All</button>
          </div>
          <div className="space-y-5 relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 z-0"></div>
            {(d.recentActivity || []).map((act, i) => (
              <div key={i} className="flex gap-4 relative z-10">
                <div className="w-6 h-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center mt-0.5 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-800 leading-snug"><span className="font-semibold text-gray-900">{act.user}</span> {act.action} {act.target}</p>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(act.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Quick Stats <span className="text-gray-400 font-normal">(Today)</span></h2>
        </div>
        <div className="flex items-center gap-8 overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Users size={14}/></div>
            <div><p className="text-[10px] text-gray-500 font-medium">New Users</p><p className="text-sm font-bold text-gray-900">{d.quickStats?.newUsers || 0}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Video size={14}/></div>
            <div><p className="text-[10px] text-gray-500 font-medium">Reels Uploaded</p><p className="text-sm font-bold text-gray-900">{d.quickStats?.reelsUploaded || 0}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center"><Star size={14}/></div>
            <div><p className="text-[10px] text-gray-500 font-medium">Reviews</p><p className="text-sm font-bold text-gray-900">{d.quickStats?.reviews || 0}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><MapPin size={14}/></div>
            <div><p className="text-[10px] text-gray-500 font-medium">Check-ins</p><p className="text-sm font-bold text-gray-900">{d.quickStats?.checkIns || 0}</p></div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><QrCode size={14}/></div>
            <div><p className="text-[10px] text-gray-500 font-medium">QR Redeemed</p><p className="text-sm font-bold text-gray-900">{d.quickStats?.qrRedeemed || 0}</p></div>
          </div>
        </div>
      </div>

    </div>
  );
}
