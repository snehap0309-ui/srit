"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Check, X as XIcon, Navigation, Globe, Eye, XCircle } from "lucide-react";
import { getPlaces, getPlace, approvePlace, rejectPlace } from "@/services/places";
import { useNotification } from "@/components/Notification";
import type { Place } from "@/types";

function PlaceDetailModal({ place, onClose }: { place: Place | null; onClose: () => void }) {
  if (!place) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <XCircle size={22} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {place.images?.[0] && (
            <img src={place.images[0]} alt={place.name} className="h-64 w-full rounded-xl object-cover" />
          )}

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              {place.category}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {place.status}
            </span>
            {place.source && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {place.source}
              </span>
            )}
          </div>

          {place.shortDescription && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Short Description</h3>
              <p className="text-gray-700">{place.shortDescription}</p>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Description</h3>
            <p className="text-gray-700 leading-relaxed">{place.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Location</h3>
              <p className="text-gray-700">{place.city}, {place.state}</p>
              <p className="text-gray-500 text-sm">{place.country}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Coordinates</h3>
              <p className="text-gray-700 font-mono">{Number(place.latitude).toFixed(6)}</p>
              <p className="text-gray-700 font-mono">{Number(place.longitude).toFixed(6)}</p>
              <a
                href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:underline"
              >
                Open in Maps →
              </a>
            </div>
          </div>

          {(place.tags as string[])?.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {(place.tags as string[]).map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(place.bestTimeToVisit || place.bestTimeReason) && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Best Time to Visit</h3>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                {(place.bestTimeToVisit as any)?.bestMonths && (
                  <p className="text-sm font-medium text-amber-800">
                    {(place.bestTimeToVisit as any).bestMonths}
                  </p>
                )}
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-amber-700">
                  {(place.bestTimeToVisit as any)?.from && (
                    <span>Open: {(place.bestTimeToVisit as any).from} - {(place.bestTimeToVisit as any).to || '?'}</span>
                  )}
                  {place.bestTimeReason && (
                    <span>{place.bestTimeReason}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {place.rating != null && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Rating</h3>
                <p className="text-gray-700">{Number(place.rating).toFixed(1)} / 5</p>
              </div>
            )}
            {place.popularityScore != null && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Popularity</h3>
                <p className="text-gray-700">{place.popularityScore}</p>
              </div>
            )}
          </div>

          {place.submittedBy && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 uppercase">Submitted By</h3>
              <p className="text-gray-700">{place.submittedBy.name || place.submittedByUser?.name || 'Anonymous'}</p>
            </div>
          )}

          <div className="text-xs text-gray-400">
            Created: {new Date(place.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModeratePage() {
  const { notify } = useNotification();
  const [pending, setPending] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlaces({ status: "PENDING", limit: 100 });
      setPending(res.data);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approvePlace(id);
      notify("success", "Place approved successfully");
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {
      notify("error", "Failed to approve place");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectPlace(id);
      notify("success", "Place rejected successfully");
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {
      notify("error", "Failed to reject place");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moderation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve/reject pending places ({pending.length} pending)
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
          <MapPin size={48} className="text-gray-300" />
          <p className="mt-4 text-lg font-medium text-gray-500">No pending places</p>
          <p className="text-sm text-gray-400">All places have been reviewed</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((place) => (
            <div
              key={place.id}
              className="group rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative h-44 overflow-hidden rounded-t-xl bg-gray-100">
                {place.images?.[0] ? (
                  <img
                    src={place.images[0]}
                    alt={place.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <MapPin size={36} className="text-gray-300" />
                  </div>
                )}
                <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur">
                  {place.category}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{place.name}</h3>

                {place.city && place.state && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <Globe size={12} />
                    <span>{place.city}, {place.state}, {place.country}</span>
                  </div>
                )}

                <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                  {place.description}
                </p>

                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                  <Navigation size={12} />
                  <span>
                    {Number(place.latitude).toFixed(4)}, {Number(place.longitude).toFixed(4)}
                  </span>
                </div>

                <div className="mt-3">
                  <button
                    onClick={async () => {
                      setDetailLoading(true);
                      setDetailPlace(null);
                      try {
                        const full = await getPlace(place.id);
                        setDetailPlace(full);
                      } catch {
                        setDetailPlace(place);
                      }
                      setDetailLoading(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-800"
                  >
                    <Eye size={15} />
                    View Details
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleApprove(place.id)}
                    disabled={actionLoading === place.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === place.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Check size={16} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(place.id)}
                    disabled={actionLoading === place.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <XIcon size={16} />
                    Reject
                  </button>
                </div>

                {(place.tags as string[])?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(place.tags as string[]).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <PlaceDetailModal place={detailPlace} onClose={() => setDetailPlace(null)} />
    </div>
  );
}
