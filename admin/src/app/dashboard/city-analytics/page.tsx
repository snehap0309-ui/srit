"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Map, Users, Eye, MapPin, Tag, Diamond, Clock, Video, BarChart3,
  Star, TrendingUp
} from "lucide-react";
import { getCityAnalyticsDashboard } from "@/services/cityAnalytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

interface CityData {
  cityVisitors: { city: string; state: string; visitors: number; uniqueVisitors: number; checkins: number }[];
  topPlaces: { placeId: string; name: string; city: string; state: string; category: string; visits: number }[];
  topViewed: { placeId: string; name: string; city: string; views: number }[];
  topCategories: { category: string; count: number }[];
  hiddenGemStats: { placeId: string; name: string; city: string; visits: number; views: number }[];
  reelsByCity: { city: string; count: number }[];
  avgDuration: { city: string; avgMinutes: number }[];
  filters: { states: string[]; cities: { city: string; state: string }[] };
}

export default function CityAnalyticsPage() {
  const [data, setData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (stateFilter) params.state = stateFilter;
      if (cityFilter) params.city = cityFilter;
      const result = await getCityAnalyticsDashboard(params);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center mt-20 text-red-500">Failed to load city analytics</div>;
  }

  const filteredCities = data.filters.cities.filter(c => !stateFilter || c.state === stateFilter);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">City Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Tourism intelligence by city</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setCityFilter(''); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">All States</option>
            {data.filters.states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">All Cities</option>
            {filteredCities.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Total Visitors', value: data.cityVisitors.reduce((s, c) => s + c.visitors, 0), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { title: 'Unique Visitors', value: data.cityVisitors.reduce((s, c) => s + c.uniqueVisitors, 0), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'Total Check-ins', value: data.cityVisitors.reduce((s, c) => s + c.checkins, 0), icon: MapPin, color: 'text-purple-600', bg: 'bg-purple-100' },
          { title: 'Total Reels', value: data.reelsByCity.reduce((s, c) => s + c.count, 0), icon: Video, color: 'text-rose-600', bg: 'bg-rose-100' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1">{kpi.title}</p>
            <p className="text-xl font-bold text-gray-900">{kpi.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-gray-900 mb-4">City Visitors</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cityVisitors.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6B7280'}} />
                <YAxis type="category" dataKey="city" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#374151'}} width={70} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Bar dataKey="visitors" name="Visitors" fill="#3B82F6" radius={[0,4,4,0]} />
                <Bar dataKey="uniqueVisitors" name="Unique" fill="#10B981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Top Categories</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.topCategories} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="category">
                  {data.topCategories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Top Destinations</h2>
          </div>
          <div className="space-y-3">
            {data.topPlaces.slice(0, 10).map((p, i) => (
              <div key={p.placeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.city}, {p.state} · {p.category}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-600">{p.visits} visits</span>
              </div>
            ))}
            {data.topPlaces.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No data available</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Most Viewed</h2>
          </div>
          <div className="space-y-3">
            {data.topViewed.slice(0, 10).map((p, i) => (
              <div key={p.placeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.city}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-purple-600">{p.views} views</span>
              </div>
            ))}
            {data.topViewed.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No data available</p>}
          </div>
        </div>
      </div>

      {data.hiddenGemStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Hidden Gem Popularity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.hiddenGemStats.slice(0, 10).map((h) => (
              <div key={h.placeId} className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <Diamond size={14} className="text-teal-600" />
                  <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">{h.city}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{h.visits} visits</span>
                  <span className="text-teal-600 font-medium">{h.views} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Average Visit Duration (minutes)</h2>
          <div className="space-y-3">
            {data.avgDuration.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{a.city}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{a.avgMinutes} min</span>
              </div>
            ))}
            {data.avgDuration.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Reels by City</h2>
          <div className="space-y-3">
            {data.reelsByCity.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video size={14} className="text-rose-400" />
                  <span className="text-sm text-gray-700">{r.city}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{r.count} reels</span>
              </div>
            ))}
            {data.reelsByCity.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
