"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { monetizationApi } from "@/services/monetization";
import { useNotification } from "@/components/Notification";

export default function AdsConfigPage() {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await monetizationApi.getAds();
        setForm((res.data as any).data || {});
      } catch {
        notify("error", "Failed to load ad config");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  const save = async () => {
    setSaving(true);
    try {
      await monetizationApi.updateAds({
        adsEnabled: !!form.adsEnabled,
        killSwitch: !!form.killSwitch,
        bannerEnabled: !!form.bannerEnabled,
        interstitialEnabled: !!form.interstitialEnabled,
        rewardedEnabled: !!form.rewardedEnabled,
        nativeEnabled: !!form.nativeEnabled,
        interstitialCooldownSec: Number(form.interstitialCooldownSec) || 120,
        rewardedPoints: Number(form.rewardedPoints) || 10,
        bannerAdUnitIdAndroid: form.bannerAdUnitIdAndroid || null,
        bannerAdUnitIdIos: form.bannerAdUnitIdIos || null,
        interstitialAdUnitIdAndroid: form.interstitialAdUnitIdAndroid || null,
        interstitialAdUnitIdIos: form.interstitialAdUnitIdIos || null,
        rewardedAdUnitIdAndroid: form.rewardedAdUnitIdAndroid || null,
        rewardedAdUnitIdIos: form.rewardedAdUnitIdIos || null,
        nativeAdUnitIdAndroid: form.nativeAdUnitIdAndroid || null,
        nativeAdUnitIdIos: form.nativeAdUnitIdIos || null,
        enabledCountries: typeof form.enabledCountries === "string"
          ? form.enabledCountries.split(",").map((s: string) => s.trim()).filter(Boolean)
          : form.enabledCountries || [],
        enabledAppVersions: typeof form.enabledAppVersions === "string"
          ? form.enabledAppVersions.split(",").map((s: string) => s.trim()).filter(Boolean)
          : form.enabledAppVersions || [],
      });
      notify("success", "Ad configuration saved");
    } catch {
      notify("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  const toggle = (key: string) => setForm((f) => ({ ...f, [key]: !f[key] }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advertisements</h1>
        <p className="text-sm text-gray-500">Control ad units, frequency, and emergency kill switch. Premium users never see ads.</p>
      </div>

      {form.killSwitch && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium">
          Emergency kill switch is ON — all ads are disabled for every user.
        </div>
      )}

      <div className="rounded-xl border bg-white p-5 space-y-4">
        {[
          ["adsEnabled", "Ads enabled"],
          ["killSwitch", "Emergency kill switch"],
          ["bannerEnabled", "Banner ads"],
          ["interstitialEnabled", "Interstitial ads"],
          ["rewardedEnabled", "Rewarded ads"],
          ["nativeEnabled", "Native ads"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-gray-800">{label}</span>
            <input type="checkbox" checked={!!form[key]} onChange={() => toggle(key)} className="h-4 w-4" />
          </label>
        ))}

        <label className="block text-sm">Interstitial cooldown (seconds)
          <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={form.interstitialCooldownSec ?? 120} onChange={(e) => setForm({ ...form, interstitialCooldownSec: e.target.value })} />
        </label>
        <label className="block text-sm">Rewarded ad PalPoints
          <input className="mt-1 w-full rounded border px-3 py-2" type="number" value={form.rewardedPoints ?? 10} onChange={(e) => setForm({ ...form, rewardedPoints: e.target.value })} />
        </label>
        <label className="block text-sm">Enabled countries (comma ISO codes, empty = all)
          <input className="mt-1 w-full rounded border px-3 py-2" value={Array.isArray(form.enabledCountries) ? form.enabledCountries.join(", ") : (form.enabledCountries || "")} onChange={(e) => setForm({ ...form, enabledCountries: e.target.value })} />
        </label>
        <label className="block text-sm">Enabled app versions (comma, empty = all)
          <input className="mt-1 w-full rounded border px-3 py-2" value={Array.isArray(form.enabledAppVersions) ? form.enabledAppVersions.join(", ") : (form.enabledAppVersions || "")} onChange={(e) => setForm({ ...form, enabledAppVersions: e.target.value })} />
        </label>

        <div className="grid md:grid-cols-2 gap-3 pt-2">
          {[
            "bannerAdUnitIdAndroid",
            "bannerAdUnitIdIos",
            "interstitialAdUnitIdAndroid",
            "interstitialAdUnitIdIos",
            "rewardedAdUnitIdAndroid",
            "rewardedAdUnitIdIos",
            "nativeAdUnitIdAndroid",
            "nativeAdUnitIdIos",
          ].map((key) => (
            <label key={key} className="block text-xs text-gray-600">{key}
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
        </div>

        <button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white">
          <Save size={16} /> {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>
    </div>
  );
}
