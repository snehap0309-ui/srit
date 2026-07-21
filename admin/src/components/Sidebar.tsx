"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Users,
  Video,
  BarChart3,
  Flag,
  Compass,
  Handshake,
  ScrollText,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Store,
  Award,
  Tag,
  Wallet,
  Settings,
  Diamond,
  Trophy,
  ScanLine,
  TrendingUp,
  Map,
  DollarSign,
  Bell,
  Gift,
  Clapperboard,
  FileText,
  ShieldQuestion,
  BookOpen,
  Megaphone,
  FolderLock,
  CreditCard,
  Receipt,
  BadgePercent,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  {
    title: "MAIN",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ]
  },
  {
    title: "CONTENT",
    items: [
      { href: "/dashboard/places", label: "Places", icon: MapPin },
      { href: "/dashboard/hidden-gems", label: "Hidden Gems", icon: Diamond },
      { href: "/dashboard/reels", label: "Reels", icon: Video },
      { href: "/dashboard/moderate", label: "Moderation Queue", icon: ShieldCheck },
    ]
  },
  {
    title: "COMMUNITY",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users },

      { href: "/dashboard/quests", label: "Treasure Hunts", icon: Compass },
      { href: "/dashboard/campaigns", label: "Reward Campaigns", icon: Gift },
      { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
    ]
  },
  {
    title: "BUSINESS",
    items: [
      { href: "/dashboard/vendors", label: "Vendors", icon: Store },
      { href: "/dashboard/creators", label: "Creators", icon: Clapperboard },
      { href: "/dashboard/offers", label: "Offers", icon: Tag },
      { href: "/dashboard/wallets", label: "Wallet Management", icon: Wallet },
    ]
  },
  {
    title: "MONETIZATION",
    items: [
      { href: "/dashboard/monetization/plans", label: "Subscription Plans", icon: CreditCard },
      { href: "/dashboard/monetization/ads", label: "Advertisements", icon: Sparkles },
      { href: "/dashboard/monetization/coupons", label: "Coupons", icon: BadgePercent },
      { href: "/dashboard/monetization/transactions", label: "Transactions", icon: Receipt },
      { href: "/dashboard/monetization/revenue", label: "Platform Revenue", icon: DollarSign },
      { href: "/dashboard/monetization/documents", label: "Vendor Documents", icon: FolderLock },
    ]
  },
  {
    title: "ANALYTICS",
    items: [
      { href: "/dashboard/growth", label: "Growth Analytics", icon: TrendingUp },
      { href: "/dashboard/city-analytics", label: "City Analytics", icon: Map },
      { href: "/dashboard/revenue", label: "Offer Redemptions", icon: DollarSign },
    ]
  },
  {
    title: "LEGAL & CMS",
    items: [
      { href: "/dashboard/legal/privacy-policy", label: "Privacy Policy", icon: FileText },
      { href: "/dashboard/legal/terms-conditions", label: "Terms & Conditions", icon: FileText },
      { href: "/dashboard/legal/rewards-policy", label: "Rewards Policy", icon: Gift },
      { href: "/dashboard/legal/community-guidelines", label: "Community Guidelines", icon: BookOpen },
      { href: "/dashboard/legal/faq", label: "FAQ", icon: ShieldQuestion },
      { href: "/dashboard/legal", label: "Legal Documents", icon: FolderLock },
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone },
    ]
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/reports", label: "Reports", icon: Flag },
      { href: "/dashboard/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/point-rules", label: "Point Rules", icon: Award },
      { href: "/dashboard/sync", label: "Sync Queue", icon: ScanLine },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      router.push("/login");
    });
  };

  const nav = (
    <nav className="flex flex-1 flex-col h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 px-6 py-6 sticky top-0 bg-[#0A192F] z-10">
        <div className="flex items-center justify-center bg-blue-600 rounded-full h-8 w-8">
          <MapPin className="text-white" size={16} />
        </div>
        <div>
          <p className="text-lg font-bold text-white tracking-tight leading-none mb-1">PalSafar</p>
          <p className="text-[10px] text-gray-400 font-medium leading-none tracking-wider">Admin Dashboard</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-2 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-xs font-semibold tracking-wider text-gray-500">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon size={18} className={active ? "text-white" : "text-gray-400 group-hover:text-white"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 mt-auto border-t border-white/5 bg-[#0A192F] sticky bottom-0">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A192F] text-white shadow-lg lg:hidden"
      >
        <Menu size={20} />
      </button>

      <aside className="hidden h-screen w-64 flex-shrink-0 bg-[#0A192F] lg:flex lg:flex-col border-r border-white/5 shadow-xl">
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="h-screen w-72 flex-shrink-0 bg-[#0A192F] shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white z-20"
            >
              <X size={24} />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
