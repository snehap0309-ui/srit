"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, MapPin, Store, Star, Clock, TrendingUp, TrendingDown,
} from "lucide-react";
import client from "@/services/client";

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

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
    userGrowth: { date: string; newUsers: number }[];
    vendorGrowth: { date: string; vendors: number }[];
    redemptionsPie: { name: string; value: number }[];
  };
  cityAnalytics: { city: string; users: number; growth: number }[];
  pendingApprovals: { hiddenGems: number; vendors: number };
  recentActivity: { id: string; action: string; user: string; target: string; time: string }[];
  quickStats: { newUsers: number; reelsUploaded: number; reviews: number; checkIns: number; qrRedeemed: number };
}

function Trend({ value, prev }: { value: number; prev: number }) {
  if (prev === 0) return <span className="text-emerald-500 text-xs font-semibold flex items-center"><TrendingUp size={12} className="mr-1" /> +100%</span>;
  const pct = ((value - prev) / prev) * 100;
  if (pct >= 0) return <span className="text-emerald-500 text-xs font-semibold flex items-center"><TrendingUp size={12} className="mr-1" /> +{pct.toFixed(1)}%</span>;
  return <span className="text-red-500 text-xs font-semibold flex items-center"><TrendingDown size={12} className="mr-1" /> {pct.toFixed(1)}%</span>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get<{ success: boolean; data: DashboardData }>("/analytics/dashboard");
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-red-500">Failed to load analytics</div>;
  }

  const d = data;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Platform activity and trends</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={d.kpis.totalUsers.value} icon={Users} color="blue" trend={d.kpis.totalUsers} />
        <StatCard title="DAU" value={d.kpis.dau.value} icon={TrendingUp} color="emerald" trend={d.kpis.dau} />
        <StatCard title="MAU" value={d.kpis.mau.value} icon={Users} color="purple" trend={d.kpis.mau} />
        <StatCard title="Active Vendors" value={d.kpis.activeVendors.value} icon={Store} color="orange" trend={d.kpis.activeVendors} />
        <StatCard title="QR Redemptions" value={d.kpis.qrRedemptions.value} icon={Star} color="pink" trend={d.kpis.qrRedemptions} />
        <StatCard title="Hidden Gems" value={d.kpis.hiddenGems.value} icon={MapPin} color="teal" />
        <StatCard title="Reels Uploaded" value={d.kpis.reelsUploaded.value} icon={Star} color="blue" trend={d.kpis.reelsUploaded} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">User Growth (30 days)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.charts.userGrowth}>
                <defs>
                  <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none" }} />
                <Area type="monotone" dataKey="newUsers" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#ug)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Vendor Growth (30 days)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.charts.vendorGrowth}>
                <defs>
                  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none" }} />
                <Area type="monotone" dataKey="vendors" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#vg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Redemption Overview</h2>
          <div className="h-64 flex items-center justify-center">
            {(d.charts.redemptionsPie?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.charts.redemptionsPie} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                    {d.charts.redemptionsPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm">No redemption data yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Pending Approvals</h2>
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 flex items-center justify-between border border-red-100">
              <div>
                <p className="text-xs text-gray-500 font-medium">Hidden Gems</p>
                <p className="text-xl font-bold text-gray-900">{d.pendingApprovals.hiddenGems}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between border border-emerald-100">
              <div>
                <p className="text-xs text-gray-500 font-medium">Vendors</p>
                <p className="text-xl font-bold text-gray-900">{d.pendingApprovals.vendors}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Store size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">City Analytics</h2>
          <div className="space-y-3">
            {d.cityAnalytics.slice(0, 5).map((city, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{city.city}</span>
                </div>
                <span className="text-sm text-gray-500">{city.users.toLocaleString()} users</span>
              </div>
            ))}
            {d.cityAnalytics.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Stats (Today)</h2>
          <div className="grid grid-cols-3 gap-4">
            <QuickStat label="New Users" value={d.quickStats.newUsers} icon={Users} color="blue" />
            <QuickStat label="Reels" value={d.quickStats.reelsUploaded} icon={Star} color="purple" />
            <QuickStat label="Reviews" value={d.quickStats.reviews} icon={Star} color="yellow" />
            <QuickStat label="Check-ins" value={d.quickStats.checkIns} icon={MapPin} color="emerald" />
            <QuickStat label="QR Redeemed" value={d.quickStats.qrRedeemed} icon={Star} color="blue" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: {
  title: string; value: number; icon: any; color: string; trend?: { value: number; prev: number };
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600", emerald: "bg-emerald-100 text-emerald-600",
    purple: "bg-purple-100 text-purple-600", orange: "bg-orange-100 text-orange-500",
    pink: "bg-pink-100 text-pink-600", yellow: "bg-yellow-100 text-yellow-500",
    teal: "bg-teal-100 text-teal-600",
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className={`w-8 h-8 rounded-lg ${colors[color] || colors.blue} flex items-center justify-center mb-3`}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-gray-900">{value.toLocaleString()}</span>
        {trend && <Trend value={trend.value} prev={trend.prev} />}
      </div>
    </div>
  );
}

function QuickStat({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600", purple: "bg-purple-100 text-purple-600",
    yellow: "bg-yellow-100 text-yellow-500", emerald: "bg-emerald-100 text-emerald-600",
    pink: "bg-pink-100 text-pink-600",
  };
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className={`w-8 h-8 rounded-full ${colors[color] || colors.blue} flex items-center justify-center mx-auto mb-2`}>
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-[10px] text-gray-500 font-medium truncate">{label}</p>
    </div>
  );
}
