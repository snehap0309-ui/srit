"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Trophy, Medal, Crown, TrendingUp, Users, RefreshCw, Search, Award, Coins
} from "lucide-react";
import { getLeaderboard } from "@/services/leaderboard";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  email: string;
  palPoints: number;
  lifetimeEarned: number;
}

interface LeaderboardResponse {
  data: LeaderboardEntry[];
  stats: {
    totalUsers: number;
    averagePoints: number;
    topScore: number;
  };
}

const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, averagePoints: 0, topScore: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaderboard();
      setData(res.data);
      setStats(res.stats);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = searchQuery
    ? data.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : data;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-500">Users ranked by Pal Points — compete for the top spot!</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Total Ranked', value: stats.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { title: 'Average Points', value: stats.averagePoints.toLocaleString(), icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'Top Score', value: stats.topScore.toLocaleString(), icon: Crown, color: 'text-amber-600', bg: 'bg-amber-100' },
          { title: 'Category', value: 'Global', icon: Coins, color: 'text-rose-600', bg: 'bg-rose-100' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1">{kpi.title}</p>
            <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 w-48" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Trophy size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? 'No matching users found' : 'No leaderboard data yet'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filteredData.map((entry) => {
              const isTop3 = entry.rank <= 3;
              return (
                <div key={entry.userId} className={`flex items-center justify-between p-4 ${isTop3 ? 'bg-gradient-to-r from-amber-50/50 to-transparent' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1 ? 'bg-yellow-100 text-yellow-600' :
                      entry.rank === 2 ? 'bg-gray-100 text-gray-500' :
                      entry.rank === 3 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {entry.rank <= 3 ? (
                        <span>{entry.rank === 1 ? <Crown size={14} /> : entry.rank === 2 ? <Medal size={14} /> : <Award size={14} />}</span>
                      ) : (
                        <span>#{entry.rank}</span>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isTop3 ? 'text-gray-900' : 'text-gray-700'}`}>{entry.name}</p>
                      <p className="text-xs text-gray-500">{entry.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{entry.palPoints.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Points</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
