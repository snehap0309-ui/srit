"use client";

import { useState, useRef, useEffect } from "react";
import { X, MapPin } from "lucide-react";
import { createPlace, updatePlace, uploadImage } from "@/services/places";
import type { Place, PlaceFormData } from "@/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const categories = [
  "temple", "mosque", "church", "gurudwara", "monument",
  "museum", "park", "lake", "fort", "palace", "beach",
  "waterfall", "trek", "market", "ghat", "other",
];

interface Props {
  open: boolean;
  place?: Place | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PlaceForm({ open, place, onClose, onSaved }: Props) {
  const isEdit = !!place;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [form, setForm] = useState<PlaceFormData>({
    name: place?.name || "",
    description: place?.description || "",
    shortDescription: place?.shortDescription || "",
    category: place?.category || "temple",
    latitude: place?.latitude || 20.5937,
    longitude: place?.longitude || 78.9629,
    city: place?.city || "",
    state: place?.state || "",
    country: place?.country || "India",
    images: place?.images || [],
    tags: place?.tags || [],
    bestTimeFrom: (place?.bestTimeToVisit as any)?.from || "",
    bestTimeTo: (place?.bestTimeToVisit as any)?.to || "",
    bestTimeMonths: (place?.bestTimeToVisit as any)?.bestMonths || "",
    bestTimeReason: place?.bestTimeReason || "",
    openingFrom: (place?.openingHours as any)?.from || "",
    openingTo: (place?.openingHours as any)?.to || "",
  });
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const allIndianCities = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai",
    "Kolkata", "Pune", "Jaipur", "Lucknow", "Surat", "Varanasi",
    "Agra", "Udaipur", "Goa", "Shimla", "Manali", "Rishikesh",
    "Amritsar", "Jodhpur", "Bikaner", "Mysore", "Kochi", "Trivandrum",
    "Bhubaneswar", "Guwahati", "Chandigarh", "Nagpur", "Indore", "Bhopal",
    "Patna", "Ranchi", "Raipur", "Dehradun", "Haridwar", "Mathura",
    "Gwalior", "Khajuraho", "Hampi", "Madurai", "Rameswaram", "Kanyakumari",
    "Pondicherry", "Darjeeling", "Gangtok", "Leh", "Srinagar", "Jammu",
    "Ajanta", "Ellora", "Mahabalipuram", "Konark", "Puri", "Jaisalmer",
    "Mount Abu", "Pachmarhi", "Shillong", "Tawang", "Ziro", "Kaziranga",
    "Munnar", "Ooty", "Kodaikanal", "Coorg", "Chikmagalur", "Wayanad",
    "Alleppey", "Kumarakom", "Lonavala", "Mahabaleshwar", "Matheran",
    "Panaji", "Calangute", "Diu", "Mandarmoni", "Digha", "Gokarna",
    "Tirupati", "Shirdi", "Ajmer", "Pushkar", "Bodh Gaya", "Sarnath",
    "Rishikesh", "Vrindavan", "Dwarka", "Somnath", "Patan", "Modhera",
    "Chittorgarh", "Kumbhalgarh", "Mehrangarh", "Amber", "Fatehpur Sikri",
    "Sanchi", "Sravasti", "Nalanda", "Halebidu", "Belur", "Badami",
    "Pattadakal", "Aihole", "Kanchipuram", "Thanjavur", "Chettinad",
    "Jhansi", "Orchha", "Bandhavgarh", "Kanha", "Ranthambore", "Jim Corbett",
    "Sunderbans", "Gir", "Periyar", "Sariska", "Dudhwa",
  ];

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const q = searchQuery.toLowerCase();
      const matches = allIndianCities.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
      setCitySuggestions(matches);
      setShowCityDropdown(matches.length > 0);
    } else {
      setShowCityDropdown(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!open || !mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [form.latitude, form.longitude],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([form.latitude, form.longitude], {
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setForm(prev => ({
        ...prev,
        latitude: parseFloat(pos.lat.toFixed(6)),
        longitude: parseFloat(pos.lng.toFixed(6)),
      }));
    });

    leafletMapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (leafletMapRef.current && markerRef.current) {
      markerRef.current.setLatLng([form.latitude, form.longitude]);
      leafletMapRef.current.setView([form.latitude, form.longitude], leafletMapRef.current.getZoom() < 8 ? 8 : leafletMapRef.current.getZoom());
    }
  }, [form.latitude, form.longitude]);

  if (!open) return null;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadImage(file);
      setForm(prev => ({ ...prev, images: [...prev.images, url] }));
    } catch (err) {
      setError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => {
      const newImages = [...prev.images];
      newImages.splice(index, 1);
      return { ...prev, images: newImages };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const bestTimeToVisit = form.bestTimeFrom || form.bestTimeMonths
        ? { from: form.bestTimeFrom || '', to: form.bestTimeTo || '', bestMonths: form.bestTimeMonths || '' }
        : undefined;
      const openingHours = form.openingFrom || form.openingTo
        ? { from: form.openingFrom || '', to: form.openingTo || '' }
        : undefined;
      const payload = {
        name: form.name,
        description: form.description,
        shortDescription: form.shortDescription || form.description.substring(0, 200),
        category: form.category,
        latitude: form.latitude,
        longitude: form.longitude,
        city: form.city,
        state: form.state,
        country: form.country,
        images: form.images,
        tags: form.tags,
        bestTimeToVisit,
        bestTimeReason: form.bestTimeReason || undefined,
        openingHours,
      };
      if (isEdit && place) {
        await updatePlace(place.id, payload);
      } else {
        await createPlace(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save place";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "Edit Place" : "Add Place"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Short Description
                </label>
                <textarea
                  value={form.shortDescription}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shortDescription: e.target.value }))
                  }
                  rows={2}
                  placeholder="Brief one-line description (auto-filled from description if empty)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    City *
                  </label>
                  <div className="relative">
                    <input
                      value={form.city}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, city: e.target.value }));
                        setSearchQuery(e.target.value);
                      }}
                      onFocus={() => {
                        if (citySuggestions.length > 0) setShowCityDropdown(true);
                      }}
                      onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                      placeholder="Search city..."
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                    {showCityDropdown && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {citySuggestions.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onMouseDown={() => {
                              setForm((p) => ({ ...p, city: c }));
                              setSearchQuery(c);
                              setShowCityDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    State *
                  </label>
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, state: e.target.value }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  value={form.country}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, country: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))
                      }
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))
                      }
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Map (drag marker to set location)
                  </label>
                </div>
                <div
                  ref={mapRef}
                  className="h-56 w-full rounded-lg border border-gray-300 overflow-hidden"
                  style={{ zIndex: 1 }}
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Images</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.images.map((img, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                  <img src={img} alt="Place" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-white/80 text-red-600 hover:bg-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                id="image-upload"
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className={`cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 ${
                  uploading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {uploading ? "Uploading..." : "Upload Image"}
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          </div>

          {/* Best Time & Opening Hours */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Best Time to Visit & Hours</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Open From</label>
                <input
                  value={form.bestTimeFrom || ''}
                  onChange={e => setForm(p => ({ ...p, bestTimeFrom: e.target.value }))}
                  placeholder="e.g. 8:00 AM"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Open Till</label>
                <input
                  value={form.bestTimeTo || ''}
                  onChange={e => setForm(p => ({ ...p, bestTimeTo: e.target.value }))}
                  placeholder="e.g. 5:00 PM"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Best Season/Months</label>
                <input
                  value={form.bestTimeMonths || ''}
                  onChange={e => setForm(p => ({ ...p, bestTimeMonths: e.target.value }))}
                  placeholder="e.g. October to March"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>

          </div>

          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <MapPin size={16} />
            Drag the marker on the map to set location, or enter manually
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : isEdit ? "Update Place" : "Create Place"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
