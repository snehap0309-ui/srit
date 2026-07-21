"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Search, Eye, Check, X, Trash2 } from "lucide-react";
import { getUser, getUsers, updateUserRole, deleteUser } from "@/services/users";
import { getVendor, verifyVendor } from "@/services/vendors";
import { getCreatorApplications, verifyCreator } from "@/services/creators";
import { getApiErrorCode } from "@/services/client";
import { useNotification } from "@/components/Notification";
import DataTable from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { User, UserCreatorApplication, UserVendorApplication } from "@/types";

function displayValue(value: ReactNode): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 border-b border-gray-100 py-2.5 last:border-0">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{displayValue(children)}</dd>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
    >
      {label || href}
    </a>
  );
}

function LinkList({ urls }: { urls?: string[] | null }) {
  if (!urls?.length) return null;
  return (
    <ul className="space-y-1">
      {urls.map((url) => (
        <li key={url}>
          <ExternalLink href={url} />
        </li>
      ))}
    </ul>
  );
}

function VendorApplicationReview({ vendor }: { vendor: UserVendorApplication }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900">What they submitted — Vendor</h3>
        <StatusBadge status={vendor.status || "—"} />
      </div>
      <dl>
        <FieldRow label="Business name">{vendor.businessName}</FieldRow>
        <FieldRow label="Business type">{vendor.businessType?.replace(/_/g, " ")}</FieldRow>
        <FieldRow label="Phone">{vendor.phone}</FieldRow>
        <FieldRow label="Address">{vendor.address}</FieldRow>
        <FieldRow label="City">{vendor.city}</FieldRow>
        <FieldRow label="State">{vendor.state}</FieldRow>
        <FieldRow label="Description">{vendor.description}</FieldRow>
        <FieldRow label="Website">
          {vendor.website ? <ExternalLink href={vendor.website} /> : null}
        </FieldRow>
        <FieldRow label="Operating hours">{vendor.operatingHours}</FieldRow>
        <FieldRow label="GST number">{vendor.gstNumber}</FieldRow>
        <FieldRow label="Location">
          {vendor.latitude != null && vendor.longitude != null
            ? `${vendor.latitude}, ${vendor.longitude}`
            : null}
        </FieldRow>
        <FieldRow label="Cover image">
          {vendor.imageUrl ? <ExternalLink href={vendor.imageUrl} label="Open image" /> : null}
        </FieldRow>
        <FieldRow label="Images">
          <LinkList urls={vendor.images} />
        </FieldRow>
        <FieldRow label="Documents">
          <LinkList urls={vendor.documents} />
        </FieldRow>
        <FieldRow label="Rejection reason">{vendor.rejectionReason}</FieldRow>
        <FieldRow label="Submitted">
          {vendor.createdAt ? new Date(vendor.createdAt).toLocaleString() : null}
        </FieldRow>
      </dl>
    </div>
  );
}

function CreatorApplicationReview({ creator }: { creator: UserCreatorApplication }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-indigo-900">What they submitted — Creator</h3>
        <StatusBadge status={creator.status || "—"} />
      </div>
      <dl>
        <FieldRow label="Username">{creator.username ? `@${creator.username}` : null}</FieldRow>
        <FieldRow label="Full name">{creator.fullName}</FieldRow>
        <FieldRow label="Bio">{creator.bio}</FieldRow>
        <FieldRow label="Categories">
          {creator.travelCategories?.length ? creator.travelCategories.join(", ") : null}
        </FieldRow>
        <FieldRow label="Languages">
          {creator.languages?.length ? creator.languages.join(", ") : null}
        </FieldRow>
        <FieldRow label="Instagram">
          {creator.instagramUrl ? <ExternalLink href={creator.instagramUrl} /> : null}
        </FieldRow>
        <FieldRow label="YouTube">
          {creator.youtubeUrl ? <ExternalLink href={creator.youtubeUrl} /> : null}
        </FieldRow>
        <FieldRow label="Facebook">
          {creator.facebookUrl ? <ExternalLink href={creator.facebookUrl} /> : null}
        </FieldRow>
        <FieldRow label="Sample reel">
          {creator.sampleReelUrl ? <ExternalLink href={creator.sampleReelUrl} label="Open reel" /> : null}
        </FieldRow>
        <FieldRow label="Government ID">
          {creator.governmentIdUrl ? <ExternalLink href={creator.governmentIdUrl} label="Open document" /> : null}
        </FieldRow>
        <FieldRow label="Portfolio">
          <LinkList urls={creator.portfolioLinks} />
        </FieldRow>
        <FieldRow label="Why apply">{creator.applicationReason}</FieldRow>
        <FieldRow label="Avatar">
          {creator.avatar ? <ExternalLink href={creator.avatar} label="Open avatar" /> : null}
        </FieldRow>
        <FieldRow label="Rejection reason">{creator.rejectionReason}</FieldRow>
        <FieldRow label="Submitted">
          {creator.createdAt ? new Date(creator.createdAt).toLocaleString() : null}
        </FieldRow>
      </dl>
    </div>
  );
}

type GrantTarget = "USER" | "VENDOR" | "CONTENT_CREATOR";

const grantRoleLabel = (target: GrantTarget) => {
  switch (target) {
    case "USER":
      return "User";
    case "VENDOR":
      return "Vendor";
    case "CONTENT_CREATOR":
      return "Content Creator";
  }
};

const askedPermissionLabel = (user: User): { role: string; status: string } | null => {
  if (user.vendor?.status === "PENDING" || user.vendor?.status === "CHANGES_REQUESTED") {
    return { role: "Vendor", status: user.vendor.status };
  }
  if (user.creatorProfile?.status === "PENDING" || user.creatorProfile?.status === "CHANGES_REQUESTED") {
    return { role: "Content Creator", status: user.creatorProfile.status };
  }
  if (user.vendor?.status === "APPROVED") {
    return { role: "Vendor", status: "APPROVED" };
  }
  if (user.creatorProfile?.status === "APPROVED") {
    return { role: "Content Creator", status: "APPROVED" };
  }
  return null;
};

const ATTENTION_STATUSES = ["PENDING", "CHANGES_REQUESTED"];

/** True when vendor/creator application still needs admin approve/reject. */
const needsRoleAttention = (user: User) =>
  ATTENTION_STATUSES.includes(user.vendor?.status || "")
  || ATTENTION_STATUSES.includes(user.creatorProfile?.status || "");

/** True when their asked role is already approved (no pending request left). */
const isRoleAlreadyApproved = (user: User) => {
  const asked = askedPermissionLabel(user);
  return asked?.status === "APPROVED";
};

/** Statuses in which a professional role is still "held" (exclusivity applies). */
const HELD_STATUSES = ["PENDING", "APPROVED", "CHANGES_REQUESTED", "SUSPENDED", "PAUSED"];

const holdsBothProfessionalRoles = (user: User) =>
  HELD_STATUSES.includes(user.vendor?.status || "")
  && HELD_STATUSES.includes(user.creatorProfile?.status || "");

export default function UsersPage() {
  const { notify } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [search, setSearch] = useState("");
  const [permissionFilter, setPermissionFilter] = useState("");
  const [grantByUser, setGrantByUser] = useState<Record<string, GrantTarget>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "primary" | "danger";
    action: () => Promise<void>;
  }>({ open: false, title: "", message: "", variant: "primary", action: async () => {} });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({
        page,
        limit: 15,
        search: search || undefined,
        permission: permissionFilter || undefined,
      });
      setUsers(res.data);
      setTotalPages(res.pagination.totalPages);
      setHasNext(res.pagination.hasNext);
      setHasPrev(res.pagination.hasPrev);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, permissionFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectedGrant = (user: User): GrantTarget =>
    grantByUser[user.id]
    || (ATTENTION_STATUSES.includes(user.vendor?.status || "")
      ? "VENDOR"
      : ATTENTION_STATUSES.includes(user.creatorProfile?.status || "")
        ? "CONTENT_CREATOR"
        : user.vendor?.status === "APPROVED"
          ? "VENDOR"
          : user.creatorProfile?.status === "APPROVED"
            ? "CONTENT_CREATOR"
            : "USER");

  const isSelf = (user: User) => !!(currentUser && user.id === currentUser.id);

  const openUserDetail = async (user: User) => {
    setDetailUser(user);
    setDetailLoading(true);
    try {
      // Load user first, then enrich from vendor/creator admin APIs which already
      // return the full submitted form (works even if GET /users/:id is still thin).
      const fullUser = await getUser(user.id).catch(() => user);
      const vendorId = fullUser.vendor?.id ?? user.vendor?.id;
      const creatorId = fullUser.creatorProfile?.id ?? user.creatorProfile?.id;

      const [vendorDetail, creators] = await Promise.all([
        vendorId ? getVendor(vendorId).catch(() => null) : Promise.resolve(null),
        creatorId || fullUser.creatorProfile || user.creatorProfile
          ? getCreatorApplications().catch(() => [])
          : Promise.resolve([]),
      ]);

      const creatorMatch = creators.find(
        (c) => c.id === creatorId || c.userId === fullUser.id || c.userId === user.id,
      );

      setDetailUser({
        ...fullUser,
        vendor: vendorDetail
          ? { ...fullUser.vendor, ...vendorDetail, id: vendorDetail.id }
          : fullUser.vendor ?? user.vendor,
        creatorProfile: creatorMatch
          ? { ...fullUser.creatorProfile, ...creatorMatch, id: creatorMatch.id }
          : fullUser.creatorProfile ?? user.creatorProfile,
      });
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to load application details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = (user: User) => {
    if (isSelf(user)) {
      notify("error", "You cannot change your own role.");
      return;
    }
    const target = selectedGrant(user);
    const roleLabel = grantRoleLabel(target);

    const grant = async (confirmSwitch: boolean) => {
      setBusyId(user.id);
      try {
        if (target === "VENDOR" && user.vendor?.id && user.vendor.status === "PENDING" && !confirmSwitch) {
          await verifyVendor(user.vendor.id, "APPROVED");
        } else if (target === "CONTENT_CREATOR" && user.creatorProfile?.id && user.creatorProfile.status === "PENDING" && !confirmSwitch) {
          await verifyCreator(user.creatorProfile.id, "APPROVED");
        } else {
          await updateUserRole(user.id, target, confirmSwitch || undefined);
        }
        notify("success", `${roleLabel} granted`);
        fetchUsers();
      } catch (err) {
        const code = getApiErrorCode(err);
        if (!confirmSwitch && (code === "SWITCH_CONFIRMATION_REQUIRED" || code === "ROLE_ALREADY_EXISTS")) {
          // Exclusivity: this account holds the other professional role. Confirm the switch —
          // the retry goes through updateUserRole with confirmSwitch so the backend retires it.
          const otherRoleLabel = target === "VENDOR" ? "Content Creator" : "Vendor";
          setConfirmDialog({
            open: true,
            title: "Switch professional role?",
            message: `${user.name || user.email} currently holds the ${otherRoleLabel} role. An account may only have ONE professional role — granting ${roleLabel} will retire their ${otherRoleLabel} role. Continue?`,
            variant: "danger",
            action: () => grant(true),
          });
          return;
        }
        notify("error", err instanceof Error ? err.message : "Failed to grant role");
      } finally {
        setBusyId(null);
      }
    };

    setConfirmDialog({
      open: true,
      title: `Grant ${roleLabel}`,
      message: `Grant ${roleLabel} on ${user.name || user.email}? Same account — no new login.`,
      variant: "primary",
      action: () => grant(false),
    });
  };

  const handleDelete = (user: User) => {
    if (isSelf(user)) {
      notify("error", "You cannot delete your own account.");
      return;
    }
    if (user.permission === "ADMIN") {
      notify("error", "Admin accounts cannot be deleted from here.");
      return;
    }
    setConfirmDialog({
      open: true,
      title: "Delete User",
      message: `Permanently delete ${user.name || user.email}? This removes their account and related data. This cannot be undone.`,
      variant: "danger",
      action: async () => {
        setBusyId(user.id);
        try {
          await deleteUser(user.id);
          notify("success", "User deleted");
          if (detailUser?.id === user.id) setDetailUser(null);
          fetchUsers();
        } catch (err) {
          notify("error", err instanceof Error ? err.message : "Failed to delete user");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handleReject = (user: User) => {
    if (isSelf(user)) {
      notify("error", "You cannot change your own role.");
      return;
    }
    const target = selectedGrant(user);
    if (target === "USER") {
      notify("error", "The base User role cannot be rejected.");
      return;
    }
    const reason = window.prompt("Rejection reason:") || "Rejected by admin";
    if (!reason.trim()) return;

    setConfirmDialog({
      open: true,
      title: target === "VENDOR" ? "Reject Vendor" : "Reject Content Creator",
      message: `Reject ${target === "VENDOR" ? "vendor" : "creator"} request for ${user.name || user.email}?`,
      variant: "danger",
      action: async () => {
        setBusyId(user.id);
        try {
          if (target === "VENDOR" && user.vendor?.id) {
            await verifyVendor(user.vendor.id, "REJECTED", reason.trim());
          } else if (target === "CONTENT_CREATOR" && user.creatorProfile?.id) {
            await verifyCreator(user.creatorProfile.id, "REJECTED", reason.trim());
          } else {
            await updateUserRole(user.id, "USER");
          }
          notify("success", "Request rejected");
          fetchUsers();
        } catch (err) {
          notify("error", err instanceof Error ? err.message : "Failed to reject");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const columns: Column<User & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "User",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.name || "Unnamed"}</p>
          <p className="text-xs text-gray-500">{item.email}</p>
        </div>
      ),
    },
    {
      key: "profileName",
      header: "Business / Creator page",
      render: (item) => {
        const user = item as User;
        const names = [
          user.vendor?.businessName,
          user.creatorProfile?.fullName || (user.creatorProfile?.username ? `@${user.creatorProfile.username}` : undefined),
        ].filter(Boolean);

        return names.length ? (
          <div className="space-y-0.5 text-sm text-gray-700">
            {names.map((name) => <p key={name}>{name}</p>)}
          </div>
        ) : <span className="text-gray-400">—</span>;
      },
    },
    {
      key: "permission",
      header: "Current Permission",
      render: (item) => (
        <StatusBadge status={(item as User).permission || "USER"} />
      ),
    },
    {
      key: "grant",
      header: "Asked permission",
      render: (item) => {
        const user = item as User;
        if (isSelf(user) || user.permission === "ADMIN") {
          return <span className="text-xs text-gray-400">—</span>;
        }
        const asked = askedPermissionLabel(user);
        const roleLocked = isRoleAlreadyApproved(user);
        return (
          <div className="flex flex-col gap-1.5">
            {asked ? (
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                asked.status === "PENDING" || asked.status === "CHANGES_REQUESTED"
                  ? "bg-amber-100 text-amber-800"
                  : asked.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-700"
              }`}>
                {asked.status === "PENDING" || asked.status === "CHANGES_REQUESTED"
                  ? "Requested: "
                  : asked.status === "APPROVED"
                    ? "Approved: "
                    : ""}{asked.role}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">No request</span>
            )}
            <select
              aria-label={`Grant role for ${user.email}`}
              value={selectedGrant(user)}
              onChange={(e) =>
                setGrantByUser((prev) => ({
                  ...prev,
                  [user.id]: e.target.value as GrantTarget,
                }))
              }
              disabled={busyId === user.id || roleLocked}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
            >
              <option value="USER">User</option>
              <option value="VENDOR">Vendor</option>
              <option value="CONTENT_CREATOR">Content Creator</option>
            </select>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => {
        const user = item as User;
        const busy = busyId === user.id;
        const canAct = !isSelf(user) && user.permission !== "ADMIN" && needsRoleAttention(user);
        const canDelete = !isSelf(user) && user.permission !== "ADMIN";
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openUserDetail(user)}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"
              title="View application details"
            >
              <Eye size={16} />
            </button>
            {canAct ? (
              <>
                <button
                  type="button"
                  onClick={() => handleApprove(user)}
                  disabled={busy}
                  className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                  title="Approve / grant"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(user)}
                  disabled={busy}
                  className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  title="Reject"
                >
                  <X size={16} />
                </button>
              </>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => handleDelete(user)}
                disabled={busy}
                className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete user"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          View users, grant roles, approve or reject requests, and delete accounts
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search users by name or email..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <select
          value={permissionFilter}
          onChange={(e) => {
            setPermissionFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All permissions</option>
          <option value="USER">User</option>
          <option value="VENDOR">Vendor</option>
          <option value="CONTENT_CREATOR">Content Creator</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users as (User & Record<string, unknown>)[]}
        loading={loading}
        page={page}
        totalPages={totalPages}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onPageChange={setPage}
        showFirstLast
        emptyMessage="No users found"
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.variant === "danger" ? "Confirm" : "Grant"}
        onConfirm={async () => {
          // Close BEFORE running the action: the action may open a follow-up dialog
          // (e.g. switch confirmation), which must not be immediately closed again.
          const action = confirmDialog.action;
          setConfirmDialog((p) => ({ ...p, open: false }));
          await action();
        }}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />

      {detailUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Application form</h2>
                <p className="text-sm text-gray-500">
                  {detailUser.name || "Unnamed"} · {detailUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {detailLoading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading submitted form…</p>
              ) : (
                <>
                  {holdsBothProfessionalRoles(detailUser) && (
                    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      This account holds BOTH professional roles (legacy data). The rule is one professional
                      role per account — retire one of the two via a role grant or the Vendors/Creators pages.
                    </div>
                  )}

                  {!detailUser.vendor && !detailUser.creatorProfile ? (
                    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                      No vendor or creator application on file for this user.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {detailUser.vendor ? <VendorApplicationReview vendor={detailUser.vendor} /> : null}
                      {detailUser.creatorProfile ? (
                        <CreatorApplicationReview creator={detailUser.creatorProfile} />
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              {!isSelf(detailUser) && detailUser.permission !== "ADMIN" && needsRoleAttention(detailUser) ? (
                <>
                  <button
                    type="button"
                    onClick={() => { const u = detailUser; setDetailUser(null); handleReject(u); }}
                    className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => { const u = detailUser; setDetailUser(null); handleApprove(u); }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                >
                  Close
                </button>
              )}
              {!isSelf(detailUser) && detailUser.permission !== "ADMIN" ? (
                <button
                  type="button"
                  onClick={() => { const u = detailUser; setDetailUser(null); handleDelete(u); }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  Delete user
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
