import type { LucideIcon } from "lucide-react";

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = "emerald",
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
            colors[color] || colors.emerald
          }`}
        >
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
