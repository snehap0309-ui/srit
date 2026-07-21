import type { UserActiveMode, UserProfile } from '../types';

export function isCreatorApproved(user?: UserProfile | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  return (
    roles.includes('CONTENT_CREATOR')
    || user.permission === 'CONTENT_CREATOR'
    || user.creatorProfile?.status === 'APPROVED'
  );
}

export function isVendorApproved(
  user?: UserProfile | null,
  vendorVerificationStatus?: string | null,
): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const authStatus = String((user as any).vendor?.status || '').toUpperCase();
  const extStatus = String(vendorVerificationStatus || '').toUpperCase();
  return (
    roles.includes('VENDOR')
    || user.permission === 'VENDOR'
    || authStatus === 'APPROVED'
    || extStatus === 'APPROVED'
  );
}

export function getSwitchableModes(
  user?: UserProfile | null,
  vendorVerificationStatus?: string | null,
): UserActiveMode[] {
  const modes: UserActiveMode[] = ['USER'];
  if (isVendorApproved(user, vendorVerificationStatus)) modes.push('VENDOR');
  if (isCreatorApproved(user)) modes.push('CONTENT_CREATOR');
  return modes;
}
