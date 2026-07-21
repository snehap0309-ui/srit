"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import { getCampaigns, deleteCampaign } from "@/services/campaigns";
import { useNotification } from "@/components/Notification";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotification();

  const fetchCampaigns = async () => {
    try {
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch (err: any) {
      notify("error", "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await deleteCampaign(id);
      notify("success", "Campaign deleted");
      fetchCampaigns();
    } catch (err: any) {
      notify("error", "Failed to delete campaign");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reward Campaigns</h1>
          <p className="text-sm text-gray-500">Manage premium reward campaigns for users.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Create Campaign
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 font-medium">Campaign</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Points</th>
                <th className="px-6 py-3 font-medium">Slots (Left/Total)</th>
                <th className="px-6 py-3 font-medium">Dates</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {c.imageUrl && (
                        <img src={c.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{c.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{c.pointsRequired}</td>
                  <td className={`px-6 py-4 ${c.remainingWinnerSlots < 0 ? "text-red-600 font-medium" : ""}`}>
                    {c.remainingWinnerSlots} / {c.totalWinnerSlots}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                      <div>Start: {new Date(c.startDate).toLocaleDateString()}</div>
                      <div>End: {new Date(c.endDate).toLocaleDateString()}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="text-amber-600 hover:text-amber-800 text-sm font-medium mr-3"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No campaigns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
