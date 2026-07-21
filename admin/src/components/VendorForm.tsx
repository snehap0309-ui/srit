"use client";

import { useState, useRef, useEffect } from "react";
import { X, MapPin, Loader, Info, Phone, Globe, ShieldAlert } from "lucide-react";
import { updateVendorLocation, type Vendor } from "@/services/vendors";
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

interface Props {
  open: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function VendorForm({ open, vendor, onClose, onSaved }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [form, setForm] = useState({
    latitude: vendor?.latitude || 20.5937,
    longitude: vendor?.longitude || 78.9629,
    address: vendor?.address || "",
    city: vendor?.city || "",
    state: vendor?.state || "",
  });

  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (vendor) {
      setForm({
        latitude: vendor.latitude || 20.5937,
        longitude: vendor.longitude || 78.9629,
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
      });
    }
  }, [vendor]);

  // Reverse Geocoding with Nominatim API
  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    setError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "PalSafar-Admin-Dashboard",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to contact geocoding service");
      const data = await res.json();
      
      if (data && data.address) {
        const addr = data.display_name || "";
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
        const state = data.address.state || "";
        
        // Find state in INDIAN_STATES matching Nominatim state
        const matchedState = INDIAN_STATES.find(
          s => s.toLowerCase() === state.toLowerCase()
        ) || state;

        setForm((prev) => ({
          ...prev,
          address: addr,
          city: city || prev.city,
          state: matchedState || prev.state,
        }));
      }
    } catch (err: any) {
      console.error("Geocoding failed:", err);
      setError("Failed to auto-fill address from coordinates.");
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (!open || !mapRef.current || !vendor || leafletMapRef.current) return;

    // Use default coordinates if not set
    const initialLat = vendor.latitude || 20.5937;
    const initialLng = vendor.longitude || 78.9629;

    const map = L.map(mapRef.current, {
      center: [initialLat, initialLng],
      zoom: vendor.latitude ? 14 : 5,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      const lat = parseFloat(pos.lat.toFixed(6));
      const lng = parseFloat(pos.lng.toFixed(6));
      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      reverseGeocode(lat, lng);
    });

    // Also let user click map to place marker
    map.on("click", (e) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lng = parseFloat(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      reverseGeocode(lat, lng);
    });

    leafletMapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    };
  }, [open, vendor]);

  // Keep marker in sync with coordinate text fields
  useEffect(() => {
    if (leafletMapRef.current && markerRef.current) {
      const currentLatLng = markerRef.current.getLatLng();
      if (
        currentLatLng.lat !== form.latitude ||
        currentLatLng.lng !== form.longitude
      ) {
        markerRef.current.setLatLng([form.latitude, form.longitude]);
        leafletMapRef.current.setView(
          [form.latitude, form.longitude],
          leafletMapRef.current.getZoom() < 8 ? 8 : leafletMapRef.current.getZoom()
        );
      }
    }
  }, [form.latitude, form.longitude]);

  if (!open || !vendor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await updateVendorLocation(vendor.id, {
        latitude: form.latitude,
        longitude: form.longitude,
        address: form.address,
        city: form.city,
        state: form.state,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to update vendor location";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Verify Vendor Location: {vendor.businessName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Approved vendors appear on the map based on these coordinates.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left Column: Details & Address Form (2/5 size) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Business Overview Card */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Info size={14} className="text-emerald-600" />
                  Business Overview
                </h3>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-400">Category</span>
                    <p className="font-medium text-gray-700 capitalize">{vendor.businessType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Status</span>
                    <p className="font-medium">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        vendor.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        vendor.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {vendor.status}
                      </span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Owner</span>
                    <p className="font-medium text-gray-700">{vendor.user?.name} ({vendor.user?.email})</p>
                  </div>
                  {vendor.phone && (
                    <div>
                      <span className="text-gray-400 flex items-center gap-1"><Phone size={10} /> Contact</span>
                      <p className="font-medium text-gray-700">{vendor.phone}</p>
                    </div>
                  )}
                  {vendor.website && (
                    <div>
                      <span className="text-gray-400 flex items-center gap-1"><Globe size={10} /> Website</span>
                      <p className="font-medium text-gray-700 truncate max-w-[150px]" title={vendor.website}>{vendor.website}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates Inputs */}
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {/* Address Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Street Address *
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    required
                    rows={3}
                    placeholder="Enter full business address..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      City *
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      State *
                    </label>
                    <select
                      value={form.state}
                      onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {geocoding && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 animate-pulse">
                  <Loader size={14} className="animate-spin" />
                  Fetching address details from Nominatim...
                </div>
              )}
            </div>

            {/* Right Column: Leaflet Map Viewer (3/5 size) */}
            <div className="lg:col-span-3 flex flex-col h-full min-h-[350px]">
              <label className="mb-1 block text-xs font-semibold text-gray-700 flex justify-between">
                <span>Select Location on Map</span>
                <span className="text-gray-400 font-normal">Click map or drag pin to position</span>
              </label>
              <div
                ref={mapRef}
                className="flex-1 w-full rounded-lg border border-gray-300 min-h-[350px]"
                style={{ zIndex: 1 }}
              />

              {vendor.status === 'APPROVED' && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Security Warning:</strong> Modifying coordinates for an <strong>APPROVED</strong> vendor will reset their verification status to <strong>PENDING</strong>. They will need to be re-approved before appearing on the map again.
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || geocoding}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
