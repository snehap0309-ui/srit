import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Alert } from 'react-native';
import {
  VendorBusiness, VendorOffer, VendorOfferRedemption, Reel, ReelComment,
  HiddenGemSubmission, UserProfile,
} from '../types';
import { DEV_FLAGS } from '../config/devFlags';
import { apiClient, authApi, redemptionsApi, vendorsApi } from '../services/api';
import {
  loadVendors, saveVendors, loadVendorOffers, saveVendorOffers,
  loadRedemptions, saveRedemptions, loadCurrentVendor, saveCurrentVendor,
  clearCurrentVendor,
  loadHiddenGemSubmissions, saveHiddenGemSubmissions,
} from '../services/localStorageService';
import * as reelService from '../services/reelService';
import { login as serverLogin, persistAuthUser } from '../services/authService';
import { compressVideo } from '../services/videoCompressor';
import { useUserContext } from './UserContext';
import { checkInPlace } from '../services/placesService';
import { syncService } from '../services/syncService';

interface DataContextType {
  vendors: VendorBusiness[];
  vendorOffers: VendorOffer[];
  redemptions: VendorOfferRedemption[];
  currentVendor: VendorBusiness | null;
  reels: Reel[];
  reelsLoading: boolean;
  reelsUploadProgress: number;
  feedHasMore: boolean;
  hiddenGemSubmissions: HiddenGemSubmission[];
  isStorageLoaded: boolean;
  setCurrentVendor: React.Dispatch<React.SetStateAction<VendorBusiness | null>>;
  setReels: React.Dispatch<React.SetStateAction<Reel[]>>;
  loadMoreReels: () => Promise<void>;
  refreshReels: () => Promise<void>;
  registerVendor: (input: VendorBusiness, options?: { confirmSwitch?: boolean }) => Promise<VendorBusiness | null>;
  loginVendor: (email: string, password: string) => Promise<VendorBusiness | null>;
  logoutVendor: () => void;
  refreshVendorData: () => Promise<void>;
  approveVendor: (vendorId: string) => void;
  rejectVendor: (vendorId: string, reason?: string) => void;
  createVendorOffer: (input: VendorOffer) => void;
  toggleVendorOffer: (offerId: string) => Promise<void>;
  deleteVendorOffer: (offerId: string) => Promise<void>;
  duplicateVendorOffer: (offerId: string) => Promise<VendorOffer | null>;
  updateVendorProfile: (input: Partial<VendorBusiness>) => Promise<VendorBusiness | null>;
  verifyRedemptionCode: (code: string) => Promise<VendorOfferRedemption | null>;
  getVendorById: (id: string) => VendorBusiness | undefined;
  getOfferById: (id: string) => VendorOffer | undefined;
  submitHiddenGem: (input: Omit<HiddenGemSubmission, 'id' | 'status' | 'submittedAt' | 'pointsReward'>) => void;
  approveHiddenGem: (id: string, pts?: number) => void;
  rejectHiddenGem: (id: string, reason?: string) => void;
  handleCreateReel: (data: { videoUri: string; caption: string; spotId: string; tags: string[] }, onProgress?: (p: number) => void) => Promise<void>;
  handleLikeReel: (reelId: string) => Promise<void>;
  handleAddReelComment: (reelId: string, text: string) => Promise<void>;
  handleRedeemOffer: (offerId: string) => Promise<VendorOfferRedemption | null>;
  handleCompleteActivity: (id: string, pts: number) => void;
  handleCompleteStop: (spotId: string, pts: number) => void;
  handleRemoveStop: (spotId: string) => void;
  /** Pending count from canonical syncService (single offline queue). */
  offlineQueue: any[];
  handleSavePlace: (spotId: string) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

/** Map server VendorStatus enum to the mobile lowercase verificationStatus. */
function mapVendorStatus(status: unknown): VendorBusiness['verificationStatus'] {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'CHANGES_REQUESTED': return 'changes_requested';
    case 'SUSPENDED': return 'suspended';
    case 'PAUSED': return 'paused';
    case 'RETIRED': return 'retired';
    default: return 'pending';
  }
}

function normalizeDiscountType(raw: any): 'flat' | 'percentage' | 'freebie' {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'percentage' || v === 'percent') return 'percentage';
  if (v === 'flat' || v === 'fixed') return 'flat';
  if (v === 'freebie' || v === 'other' || v === 'bogo') return 'freebie';
  return 'flat';
}

function mapServerOffer(o: any, vendorId?: string): VendorOffer {
  return {
    id: o.id,
    vendorId: o.vendorId || vendorId || '',
    offerTitle: o.title || o.offerTitle || '',
    offerDescription: o.description || o.offerDescription || '',
    discountType: normalizeDiscountType(o.discountType),
    discountValue: o.discountValue,
    pointsRequired: o.pointsRequired,
    minBillAmount: o.minBillAmount ?? undefined,
    couponCode: o.couponCode ?? undefined,
    dailyLimit: o.dailyLimit ?? undefined,
    validTill: o.validTill ?? undefined,
    startDate: o.startDate ?? undefined,
    isActive: !!o.isActive,
    isApproved: o.isApproved,
    imageUrl: o.imageUrl || o.banner || undefined,
    currentRedemptions: o.currentRedemptions ?? 0,
    viewCount: o.viewCount ?? 0,
    clickCount: o.clickCount ?? 0,
    createdAt: o.createdAt,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, setUser, setIsAuthenticated, isAuthenticated } = useUserContext();
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [vendors, setVendors] = useState<VendorBusiness[]>([]);
  const [vendorOffers, setVendorOffers] = useState<VendorOffer[]>([]);
  const [redemptions, setRedemptions] = useState<VendorOfferRedemption[]>([]);
  const [currentVendor, setCurrentVendor] = useState<VendorBusiness | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsUploadProgress, setReelsUploadProgress] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const feedCursorRef = useRef<any>(undefined);
  const reelsLoadingRef = useRef(false);
  const feedHasMoreRef = useRef(true);
  // A direct vendor login already fetches and installs this profile before it
  // authenticates the app. Avoid immediately hydrating the same session again.
  const hydratedVendorUserIdRef = useRef<string | null>(null);
  const [hiddenGemSubmissions, setHiddenGemSubmissions] = useState<HiddenGemSubmission[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const pendingStopRef = useRef<Set<string>>(new Set());
  const pendingHiddenGemRef = useRef<Set<string>>(new Set());
  const pendingLikeRef = useRef<Set<string>>(new Set());
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      console.warn('[DataContext] Storage load timed out — showing app with defaults');
      setIsStorageLoaded(true);
    }, 15000);

    (async () => {
      try {
        const [lv, lo, lr, lc, lhg] = await Promise.all([
          loadVendors(), loadVendorOffers(), loadRedemptions(),
          loadCurrentVendor(), loadHiddenGemSubmissions(),
        ]);
        await syncService.init();
        if (cancelled) return;
        if (lv) setVendors(lv);
        if (lo) setVendorOffers(lo);
        if (lr) setRedemptions(lr);
        if (lc) setCurrentVendor(lc);
        if (lhg) setHiddenGemSubmissions(lhg);
        setOfflineQueue(syncService.getQueue());
      } catch (e) { console.warn('Storage load failed', e); }
      if (!cancelled) {
        setIsStorageLoaded(true);
        clearTimeout(timeout);
      }
    })();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    // Only clear after boot finishes — wiping during init races with restore + vendor login
    if (!isStorageLoaded) return;
    if (!isAuthenticated) {
      hydratedVendorUserIdRef.current = null;
      setCurrentVendor(null);
      clearCurrentVendor().catch(() => {});
    }
  }, [isAuthenticated, isStorageLoaded]);

  // On login/restore/profile-switch: hydrate the vendor business for this account.
  useEffect(() => {
    if (!DEV_FLAGS.USE_SERVER_API || !isAuthenticated || !isStorageLoaded) return;
    if (user.uid === 'guest-user') return;

    const activeMode = String(user.activeMode || user.activeRole || user.role || '').toUpperCase();
    const roles = (user.roles || []).map((r) => String(r).toUpperCase());
    const hasVendorCapability =
      roles.includes('VENDOR') || String(user.permission || '').toUpperCase() === 'VENDOR';
    const needsVendorShell = activeMode === 'VENDOR' && hasVendorCapability;
    const authVendorStatus = String((user as any)?.vendor?.status || '').toUpperCase();
    // After admin approval, AsyncStorage may still hold pending — force re-fetch.
    const needsStatusRefresh =
      !!authVendorStatus &&
      !!currentVendor?.id &&
      mapVendorStatus(authVendorStatus) !== currentVendor.verificationStatus;
    // First time we learn this account is a vendor (role or approved auth stub), load business.
    const needsInitialVendorHydrate =
      (hasVendorCapability || authVendorStatus === 'APPROVED' || authVendorStatus === 'PENDING') &&
      !currentVendor?.id &&
      hydratedVendorUserIdRef.current !== user.uid;

    // Skip only when we already hydrated this user and either we have a vendor
    // profile or the user is not currently entering the vendor shell —
    // unless auth profile says status changed (post-approval).
    if (
      hydratedVendorUserIdRef.current === user.uid &&
      !needsStatusRefresh &&
      !needsInitialVendorHydrate &&
      (!needsVendorShell || currentVendor?.id)
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const vendorRes = await vendorsApi.getMe();
        const vendor = (vendorRes as any)?.data ?? vendorRes;
        if (cancelled) return;
        if (!vendor?.id) {
          // Fall back to thin vendor stub from auth profile so VendorTabs can mount
          const stub = (user as any)?.vendor;
          if (stub?.id && (needsVendorShell || hasVendorCapability || authVendorStatus === 'APPROVED')) {
            setCurrentVendor({
              id: stub.id,
              businessName: stub.businessName || 'My Business',
              category: 'cafe',
              linkedSpotIds: [],
              city: '',
              state: '',
              address: '',
              verificationStatus: mapVendorStatus(stub.status || 'approved'),
              vendorCode: stub.vendorCode || undefined,
              createdAt: new Date().toISOString(),
            });
          }
          hydratedVendorUserIdRef.current = user.uid;
          return;
        }

        const mapped: VendorBusiness = {
          id: vendor.id,
          businessName: vendor.businessName,
          category: vendor.businessType as any,
          linkedSpotIds: vendor.linkedSpotIds || [],
          city: vendor.city,
          state: vendor.state,
          address: vendor.address,
          latitude: vendor.latitude ?? undefined,
          longitude: vendor.longitude ?? undefined,
          phone: vendor.phone || undefined,
          email: vendor.user?.email,
          description: vendor.description || undefined,
          openingHours: vendor.operatingHours || undefined,
          imageUrl: vendor.imageUrl || undefined,
          website: vendor.website || undefined,
          verificationStatus: mapVendorStatus(vendor.status),
          rejectedReason: vendor.rejectionReason || undefined,
          vendorCode: vendor.vendorCode || undefined,
          createdAt: vendor.createdAt,
          showOnMap: vendor.showOnMap,
          showContact: vendor.showContact,
          showWebsite: vendor.showWebsite,
          showImages: vendor.showImages,
          showOffers: vendor.showOffers,
          showReels: vendor.showReels,
          showNavigation: vendor.showNavigation,
        };
        setCurrentVendor(mapped);
        hydratedVendorUserIdRef.current = user.uid;
      } catch {
        // Still entering Vendor shell — seed from auth profile so UI is not stuck
        const stub = (user as any)?.vendor;
        if (!cancelled && stub?.id && (needsVendorShell || hasVendorCapability || authVendorStatus === 'APPROVED')) {
          setCurrentVendor({
            id: stub.id,
            businessName: stub.businessName || 'My Business',
            category: 'cafe',
            linkedSpotIds: [],
            city: '',
            state: '',
            address: '',
            verificationStatus: mapVendorStatus(stub.status || 'approved'),
            vendorCode: stub.vendorCode || undefined,
            createdAt: new Date().toISOString(),
          });
        }
        hydratedVendorUserIdRef.current = user.uid;
      }
    })();

    return () => { cancelled = true; };
  }, [
    isAuthenticated,
    isStorageLoaded,
    user.uid,
    user.activeMode,
    user.permission,
    // roles array identity changes often — use joined string
    (user.roles || []).join(','),
    (user as any)?.vendor?.status,
  ]);

  useEffect(() => { if (isStorageLoaded) saveVendors(vendors); }, [vendors, isStorageLoaded]);
  useEffect(() => { if (isStorageLoaded) saveVendorOffers(vendorOffers); }, [vendorOffers, isStorageLoaded]);
  useEffect(() => { if (isStorageLoaded) saveRedemptions(redemptions); }, [redemptions, isStorageLoaded]);
  useEffect(() => { if (currentVendor) saveCurrentVendor(currentVendor); }, [currentVendor]);
  useEffect(() => { if (isStorageLoaded) saveHiddenGemSubmissions(hiddenGemSubmissions); }, [hiddenGemSubmissions, isStorageLoaded]);
  useEffect(() => {
    const unsub = syncService.subscribe(() => setOfflineQueue(syncService.getQueue()));
    return unsub;
  }, []);

  useEffect(() => {
    if (DEV_FLAGS.USE_SERVER_API && isStorageLoaded) {
      const mapVendors = (vendorList: any[]): VendorBusiness[] =>
        vendorList.map((v: any) => ({
          id: v.id,
          businessName: v.businessName,
          category: v.businessType,
          linkedSpotIds: v.linkedSpotIds || [],
          city: v.city,
          state: v.state,
          address: v.address,
          latitude: v.latitude ?? undefined,
          longitude: v.longitude ?? undefined,
          phone: v.phone || undefined,
          email: v.user?.email || '',
          description: v.description || undefined,
          operatingHours: v.operatingHours || undefined,
          imageUrl: v.imageUrl || undefined,
          website: v.website || undefined,
          images: v.images || [],
          verificationStatus: 'approved',
          showOnMap: v.showOnMap,
          showContact: v.showContact,
          showWebsite: v.showWebsite,
          showImages: v.showImages,
          showOffers: v.showOffers,
          showReels: v.showReels,
          showNavigation: v.showNavigation,
        }));

      const load = async (attempt = 1) => {
        try {
          const res = await vendorsApi.listForMap();
          const vendorList = (res as any).data || res || [];
          setVendors(mapVendors(vendorList));
        } catch (err) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2500));
            return load(attempt + 1);
          }
          console.warn('Failed to fetch vendors from server for DataContext:', err);
        }
      };
      load();
    }
  }, [isStorageLoaded]);

  useEffect(() => { reelsLoadingRef.current = reelsLoading; }, [reelsLoading]);
  useEffect(() => { feedHasMoreRef.current = feedHasMore; }, [feedHasMore]);

  const loadMoreReels = useCallback(async () => {
    if (reelsLoadingRef.current || !feedHasMoreRef.current) return;
    setReelsLoading(true);
    try {
      const result = await reelService.getReelsFeed(feedCursorRef.current, 5);
      if (result.items.length > 0) {
        setReels(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newItems = result.items.filter(r => !existingIds.has(r.id));
          return [...prev, ...newItems];
        });
      }
      feedCursorRef.current = result.lastDoc;
      setFeedHasMore(result.hasMore);
    } catch (e) {
      console.warn('Failed to load reels:', e);
    } finally {
      setReelsLoading(false);
    }
  }, []);

  const refreshReels = useCallback(async () => {
    feedCursorRef.current = undefined;
    setFeedHasMore(true);
    setReelsLoading(true);
    try {
      const result = await reelService.getReelsFeed(undefined, 5);
      setReels(result.items);
      feedCursorRef.current = result.lastDoc;
      setFeedHasMore(result.hasMore);
    } catch (e) {
      console.warn('Failed to refresh reels:', e);
    } finally {
      setReelsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshReels().then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [refreshReels]);

  const getVendorById = useCallback((id: string) => vendors.find(p => p.id === id), [vendors]);
  const getOfferById = useCallback((id: string) => vendorOffers.find(o => o.id === id), [vendorOffers]);

  const loginVendor = useCallback(async (email: string, password: string): Promise<VendorBusiness | null> => {
    if (DEV_FLAGS.USE_SERVER_API) {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        if (__DEV__) {
          console.info('[DataContext] Vendor login →', require('../config/api').API_CONFIG.baseUrl);
        }

        const result = await serverLogin(normalizedEmail, password);
        if (!result) return null;

        if (!apiClient.getToken()) {
          await apiClient.init();
        }
        if (!apiClient.getToken()) {
          throw new Error('Login did not produce an auth token. Please try again.');
        }

        const roles = result.user.roles?.length ? result.user.roles : [result.user.activeRole || result.user.role || 'USER'];
        if (!roles.includes('VENDOR') && !roles.includes('ADMIN')) {
          throw new Error('NOT_A_VENDOR');
        }
        if (roles.includes('VENDOR')) {
          await authApi.setActiveRole('VENDOR');
        }

        const vendorRes = await vendorsApi.getMe();
        const vendor = vendorRes?.data ?? null;

        if (!vendor?.id) {
          throw new Error(roles.includes('VENDOR') ? 'VENDOR_PROFILE_MISSING' : 'NOT_A_VENDOR');
        }

        const mapped: VendorBusiness = {
          id: vendor.id,
          businessName: vendor.businessName,
          category: vendor.businessType as any,
          linkedSpotIds: vendor.linkedSpotIds || [],
          city: vendor.city,
          state: vendor.state,
          address: vendor.address,
          latitude: vendor.latitude ?? undefined,
          longitude: vendor.longitude ?? undefined,
          phone: vendor.phone || undefined,
          email: vendor.user?.email || normalizedEmail,
          description: vendor.description || undefined,
          openingHours: vendor.operatingHours || undefined,
          imageUrl: vendor.imageUrl || undefined,
          website: vendor.website || undefined,
          verificationStatus: mapVendorStatus(vendor.status),
          rejectedReason: vendor.rejectionReason || undefined,
          vendorCode: vendor.vendorCode || undefined,
          createdAt: vendor.createdAt,
          showOnMap: vendor.showOnMap,
          showContact: vendor.showContact,
          showWebsite: vendor.showWebsite,
          showImages: vendor.showImages,
          showOffers: vendor.showOffers,
          showReels: vendor.showReels,
          showNavigation: vendor.showNavigation,
        };

        const vendorUser = {
          ...result.user,
          uid: vendor.user?.id || result.user.uid,
          email: normalizedEmail,
          displayName: vendor.businessName,
          role: 'vendor' as const,
          roles,
          activeRole: 'VENDOR',
          vendor: { id: vendor.id, businessName: vendor.businessName },
        };

        // Persist FIRST, then set vendor profile BEFORE flipping auth.
        // Cross-context updates after await can otherwise mount VendorTabs with currentVendor=null
        // and crash (hooks-after-early-return) or stick on "Loading vendor data...".
        try {
          await persistAuthUser(vendorUser as any, 'vendor');
          await saveCurrentVendor(mapped);
        } catch (err) {
          console.warn('[DataContext] Failed to persist vendor session:', err);
        }

        setCurrentVendor(mapped);
        hydratedVendorUserIdRef.current = vendorUser.uid;
        setUser(vendorUser as any);
        setIsAuthenticated(true);

        // Background loads — failures must not block login
        Promise.all([
          vendorsApi.listMyOffers().then((offersRes) => {
            const offersList = offersRes.data || [];
            setVendorOffers(offersList.map((o: any) => mapServerOffer(o, vendor.id)));
          }),
          redemptionsApi.vendorRedemptions().then((redemptionsRes) => {
            const redemptionsList = redemptionsRes.data || [];
            setRedemptions(redemptionsList.map((r: any) => ({
              id: r.id,
              vendorId: r.vendorId || vendor.id,
              offerId: r.offerId,
              userId: r.userId,
              pointsSpent: r.pointsSpent,
              discountReceived: r.discountValue,
              redeemedAt: r.createdAt,
              status: r.status === 'VERIFIED' ? 'verified' : r.status === 'CANCELLED' ? 'cancelled' : 'pending',
              verificationCode: r.qrCode || '',
              verifiedAt: r.verifiedAt || undefined,
              userName: r.user?.name || r.userName || undefined,
              offerTitle: r.offer?.title || r.offerTitle || undefined,
            })));
          }),
        ]).catch((err) => {
          console.warn('[DataContext] Vendor post-login data load failed:', err);
        });

        return mapped;
      } catch (err: any) {
        console.warn('[DataContext] Server vendor login failed:', err?.message);
        throw err;
      }
    }

    const vendor = vendors.find(p => p.email === email && p.password === password) || null;
    if (vendor) {
      setUser(prev => ({
        ...prev,
        uid: vendor.id,
        displayName: vendor.businessName,
        email,
        role: 'vendor',
        vendor: { id: vendor.id, businessName: vendor.businessName }
      }));
      setIsAuthenticated(true);
      setCurrentVendor(vendor);
    }
    return vendor;
  }, [vendors, setUser, setIsAuthenticated, setCurrentVendor]);

  const logoutVendor = useCallback(() => {
    hydratedVendorUserIdRef.current = null;
    setCurrentVendor(null);
    clearCurrentVendor();
  }, []);

  const registerVendor = useCallback(async (
    input: VendorBusiness,
    options?: { confirmSwitch?: boolean },
  ): Promise<VendorBusiness | null> => {
    if (!isAuthenticated || userRef.current.uid === 'guest-user') {
      throw new Error('You must be signed in before registering a business.');
    }
    if (DEV_FLAGS.USE_SERVER_API) {
      if (!apiClient.getToken()) {
        throw new Error('You must be signed in before registering a business.');
      }
      try {
        const vendorData = await vendorsApi.register({
          businessName: input.businessName,
          businessType: input.category,
          phone: input.phone || '',
          address: input.address,
          city: input.city,
          state: input.state,
          description: input.description,
          operatingHours: input.openingHours || input.operatingHours,
          linkedSpotIds: input.linkedSpotIds || [],
          latitude: input.latitude,
          longitude: input.longitude,
          website: input.website,
          imageUrl: input.imageUrl,
          images: input.images,
          confirmSwitch: options?.confirmSwitch,
        });

        const mapped: VendorBusiness = {
          id: vendorData.id,
          businessName: vendorData.businessName,
          category: input.category,
          linkedSpotIds: vendorData.linkedSpotIds || [],
          city: vendorData.city,
          state: vendorData.state,
          address: vendorData.address,
          latitude: vendorData.latitude ?? input.latitude,
          longitude: vendorData.longitude ?? input.longitude,
          phone: vendorData.phone || undefined,
          email: vendorData.user?.email,
          description: vendorData.description || undefined,
          openingHours: vendorData.operatingHours || undefined,
          imageUrl: vendorData.imageUrl || undefined,
          website: vendorData.website || undefined,
          images: vendorData.images || input.images,
          verificationStatus: mapVendorStatus(vendorData.status),
          createdAt: vendorData.createdAt,
          showOnMap: vendorData.showOnMap,
          showContact: vendorData.showContact,
          showWebsite: vendorData.showWebsite,
          showImages: vendorData.showImages,
          showOffers: vendorData.showOffers,
          showReels: vendorData.showReels,
          showNavigation: vendorData.showNavigation,
        };

        setVendors(prev => {
          const exists = prev.some(vendor => vendor.id === mapped.id);
          return exists ? prev.map(vendor => vendor.id === mapped.id ? mapped : vendor) : [...prev, mapped];
        });
        setCurrentVendor(mapped);
        setUser((prev: any) => ({
          ...prev,
          vendor: { id: vendorData.id, businessName: vendorData.businessName },
        }));
        return mapped;
      } catch (err: any) {
        // Structured role-transition errors (e.g. SWITCH_CONFIRMATION_REQUIRED) must reach the
        // screen so it can branch on err.code; only swallow unstructured network-style failures.
        if (err?.code) throw err;
        console.warn('[DataContext] Server registration failed:', err?.message);
        return null;
      }
    }

    setVendors(prev => [...prev, input]);
    return input;
  }, [isAuthenticated, setUser]);

  const approveVendor = useCallback((vendorId: string) => {
    setVendors(prev => prev.map(p => p.id === vendorId ? { ...p, verificationStatus: 'approved' as const } : p));
  }, []);

  const rejectVendor = useCallback((vendorId: string, reason?: string) => {
    setVendors(prev => prev.map(p => p.id === vendorId ? { ...p, verificationStatus: 'rejected' as const, rejectionReason: reason } : p));
  }, []);

  const createVendorOffer = useCallback((input: VendorOffer) => {
    setVendorOffers(prev => {
      const withoutDup = prev.filter(o => o.id !== input.id);
      return [input, ...withoutDup];
    });
  }, []);

  const toggleVendorOffer = useCallback(async (offerId: string) => {
    const existing = vendorOffers.find(o => o.id === offerId);
    if (!existing) return;

    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        if (existing.isActive) {
          await vendorsApi.pauseOffer(offerId);
        } else {
          await vendorsApi.resumeOffer(offerId);
        }
      } catch (err: any) {
        console.warn('[DataContext] toggleVendorOffer failed:', err?.message);
        throw err;
      }
    }

    setVendorOffers(prev =>
      prev.map(o => (o.id === offerId ? { ...o, isActive: !o.isActive } : o)),
    );
  }, [vendorOffers]);

  const deleteVendorOffer = useCallback(async (offerId: string) => {
    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        await vendorsApi.deleteOffer(offerId);
      } catch (err: any) {
        console.warn('[DataContext] deleteVendorOffer failed:', err?.message);
        throw err;
      }
    }
    setVendorOffers(prev => prev.filter(o => o.id !== offerId));
  }, []);

  const duplicateVendorOffer = useCallback(async (offerId: string): Promise<VendorOffer | null> => {
    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const created = await vendorsApi.duplicateOffer(offerId);
        if (!created?.id) return null;
        const mapped = mapServerOffer(created, created.vendorId);
        setVendorOffers(prev => [mapped, ...prev.filter(o => o.id !== mapped.id)]);
        return mapped;
      } catch (err: any) {
        console.warn('[DataContext] duplicateVendorOffer failed:', err?.message);
        throw err;
      }
    }
    const existing = vendorOffers.find(o => o.id === offerId);
    if (!existing) return null;
    const cloned: VendorOffer = {
      ...existing,
      id: `offer_${Date.now()}`,
      offerTitle: `${existing.offerTitle} (Copy)`,
      isActive: false,
      currentRedemptions: 0,
      createdAt: new Date().toISOString(),
    };
    setVendorOffers(prev => [cloned, ...prev]);
    return cloned;
  }, [vendorOffers]);

  const updateVendorProfile = useCallback(async (input: Partial<VendorBusiness>): Promise<VendorBusiness | null> => {
    if (!DEV_FLAGS.USE_SERVER_API) {
      setCurrentVendor(prev => {
        if (!prev) return prev;
        const next = { ...prev, ...input };
        saveCurrentVendor(next).catch(() => {});
        return next;
      });
      setVendors(prev => prev.map(v => (v.id === currentVendor?.id ? { ...v, ...input } : v)));
      return currentVendor ? { ...currentVendor, ...input } : null;
    }
    try {
      const payload: Parameters<typeof vendorsApi.updateMe>[0] = {};
      if (input.businessName !== undefined) payload.businessName = input.businessName;
      if (input.category !== undefined) payload.businessType = input.category;
      if (input.phone !== undefined) payload.phone = input.phone;
      if (input.address !== undefined) payload.address = input.address;
      if (input.city !== undefined) payload.city = input.city;
      if (input.state !== undefined) payload.state = input.state;
      if (input.latitude !== undefined) payload.latitude = input.latitude;
      if (input.longitude !== undefined) payload.longitude = input.longitude;
      if (input.description !== undefined) payload.description = input.description;
      if (input.imageUrl !== undefined) payload.imageUrl = input.imageUrl;
      if (input.website !== undefined) payload.website = input.website;
      if (input.openingHours !== undefined || input.operatingHours !== undefined) {
        payload.operatingHours = input.openingHours ?? input.operatingHours ?? null;
      }
      if (input.images !== undefined) payload.images = input.images;
      if (input.linkedSpotIds !== undefined) payload.linkedSpotIds = input.linkedSpotIds;
      if (input.showOnMap !== undefined) payload.showOnMap = input.showOnMap;
      if (input.showContact !== undefined) payload.showContact = input.showContact;
      if (input.showWebsite !== undefined) payload.showWebsite = input.showWebsite;
      if (input.showImages !== undefined) payload.showImages = input.showImages;
      if (input.showOffers !== undefined) payload.showOffers = input.showOffers;
      if (input.showReels !== undefined) payload.showReels = input.showReels;
      if (input.showNavigation !== undefined) payload.showNavigation = input.showNavigation;

      const updated = await vendorsApi.updateMe(payload);
      if (!updated?.id) return null;
      const mapped: VendorBusiness = {
        id: updated.id,
        businessName: updated.businessName,
        category: (updated.businessType || currentVendor?.category || 'cafe') as VendorBusiness['category'],
        linkedSpotIds: updated.linkedSpotIds || [],
        city: updated.city,
        state: updated.state,
        address: updated.address,
        latitude: updated.latitude ?? undefined,
        longitude: updated.longitude ?? undefined,
        phone: updated.phone || undefined,
        email: updated.user?.email || currentVendor?.email,
        description: updated.description || undefined,
        openingHours: updated.operatingHours || undefined,
        imageUrl: updated.imageUrl || undefined,
        website: updated.website || undefined,
        images: updated.images,
        verificationStatus:
          mapVendorStatus(updated.status),
        rejectedReason: updated.rejectionReason || undefined,
        vendorCode: updated.vendorCode || currentVendor?.vendorCode,
        createdAt: updated.createdAt,
        showOnMap: updated.showOnMap,
        showContact: updated.showContact,
        showWebsite: updated.showWebsite,
        showImages: updated.showImages,
        showOffers: updated.showOffers,
        showReels: updated.showReels,
        showNavigation: updated.showNavigation,
      };
      setCurrentVendor(mapped);
      setVendors(prev => {
        const exists = prev.some(v => v.id === mapped.id);
        return exists ? prev.map(v => (v.id === mapped.id ? mapped : v)) : [...prev, mapped];
      });
      await saveCurrentVendor(mapped);
      return mapped;
    } catch (err: any) {
      console.warn('[DataContext] updateVendorProfile failed:', err?.message);
      throw err;
    }
  }, [currentVendor]);

  const verifyRedemptionCode = useCallback(async (code: string): Promise<VendorOfferRedemption | null> => {
    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const res = await redemptionsApi.verify(code.trim());
        const srv = res.data;
        const mapped: VendorOfferRedemption = {
          id: srv.id,
          userId: srv.userId,
          vendorId: srv.vendorId,
          offerId: srv.offerId,
          pointsSpent: srv.pointsSpent,
          discountReceived: srv.discountValue,
          redeemedAt: srv.createdAt,
          status: srv.status === 'VERIFIED' ? 'verified' : srv.status === 'CANCELLED' ? 'cancelled' : 'pending',
          verificationCode: srv.qrCode,
          verifiedAt: srv.verifiedAt ?? undefined,
        };
        setRedemptions(prev => {
          const exists = prev.find(x => x.id === mapped.id);
          if (exists) return prev.map(x => x.id === mapped.id ? mapped : x);
          return [...prev, mapped];
        });
        return mapped;
      } catch (err: any) {
        console.warn('[DataContext] API verify failed:', err?.message);
        return null;
      }
    }
    // Local fallback
    const r = redemptions.find(r => r.verificationCode === code && r.status === 'pending');
    if (r) {
      const verified = { ...r, status: 'verified' as const };
      setRedemptions(prev => prev.map(x => x.id === r.id ? verified : x));
      return verified;
    }
    return null;
  }, [redemptions]);

  const calculateQualityPoints = (sub: HiddenGemSubmission): number => {
    const hasImage = !!sub.imageUri;
    const hasGoodDesc = sub.description.length > 50;
    const hasWorth = sub.worthVisitingReason.length > 30;
    if (hasImage && hasGoodDesc && hasWorth) return 150;
    if (hasGoodDesc || hasImage) return 100;
    return 50;
  };

  const submitHiddenGem = useCallback((input: Omit<HiddenGemSubmission, 'id' | 'status' | 'submittedAt' | 'pointsReward'>) => {
    const sub: HiddenGemSubmission = {
      ...input,
      id: `hg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      submittedAt: Date.now(),
      pointsReward: 0,
    };
    setHiddenGemSubmissions(prev => [...prev, sub]);
    Alert.alert('Submitted!', "Your hidden gem is pending review. You'll earn Pal Points once approved!");
  }, []);

  const approveHiddenGem = useCallback((id: string, pts?: number) => {
    if (pendingHiddenGemRef.current.has(id)) return;
    pendingHiddenGemRef.current.add(id);

    setHiddenGemSubmissions(prev => {
      const sub = prev.find(s => s.id === id);
      if (!sub || sub.status !== 'pending') return prev;
      const pts2 = pts || calculateQualityPoints(sub);
      if (pts2 > 0) {
        setUser(u => ({ ...u, totalPoints: (u.totalPoints || 0) + pts2 }));
      }
      Alert.alert('Approved!', 'Hidden gem added to map. Pal Points awarded!');
      return prev.map(s =>
        s.id === id ? { ...s, status: 'approved' as const, reviewedAt: Date.now(), pointsReward: pts2 } : s
      );
    });

    pendingHiddenGemRef.current.delete(id);
  }, [setUser]);

  const rejectHiddenGem = useCallback((id: string, reason?: string) => {
    setHiddenGemSubmissions(prev => prev.map(sub =>
      sub.id === id ? { ...sub, status: 'rejected' as const, reviewedAt: Date.now(), rejectionReason: reason } : sub
    ));
  }, []);

  const handleCompleteActivity = useCallback((id: string, pts: number) => {
    if (userRef.current.uid === 'guest-user') {
      Alert.alert('Sign In Required', 'Create an account or sign in to earn Pal Points.');
      return;
    }
    if (userRef.current.completedActivities?.includes(id)) {
      Alert.alert('Already Completed', 'You already earned points for this.');
      return;
    }
    setUser(u => ({
      ...u,
      completedActivities: [...(u.completedActivities || []), id],
      totalPoints: (u.totalPoints || 0) + pts,
    }));
    Alert.alert(`+${pts} Pal Points!`, 'Activity completed! Keep exploring!');
  }, [setUser]);

  const handleCompleteStop = useCallback(async (spotId: string, pts: number) => {
    if (userRef.current.uid === 'guest-user') {
      Alert.alert('Sign In Required', 'Create an account or sign in to earn Pal Points.');
      return;
    }
    if (pendingStopRef.current.has(spotId)) return;
    if (userRef.current.completedItineraryStops?.includes(spotId)) return;
    pendingStopRef.current.add(spotId);

    try {
      let queued = false;
      try {
        const result = await checkInPlace(spotId);
        queued = !!(result && (result as any).queued);
      } catch (e) {
        console.warn('Failed to sync check-in with server:', e);
        await syncService.queueAction('CHECK_IN', { placeId: spotId, spotId });
        queued = true;
      }

      setUser(u => ({
        ...u,
        completedItineraryStops: [...(u.completedItineraryStops || []), spotId],
        visitedSpots: [...(u.visitedSpots || []), spotId],
        totalPoints: (u.totalPoints || 0) + pts,
      }));

      if (pts > 0) {
        Alert.alert(
          `+${pts} Pal Points!`,
          queued ? 'Saved offline! We will sync this when you are back online.' : 'Stop completed!',
        );
      }
    } finally {
      pendingStopRef.current.delete(spotId);
    }
  }, [setUser]);

  const handleSavePlace = useCallback(async (spotId: string) => {
    let queued = false;
    try {
      const { savePlace } = require('../services/placesService');
      const result = await savePlace(spotId);
      queued = !!(result && result.queued);
    } catch (e) {
      console.warn('Failed to sync save place with server:', e);
      await syncService.queueAction('SAVE_PLACE', { placeId: spotId, spotId });
      queued = true;
    }

    Alert.alert(
      'Saved!',
      queued ? 'Saved offline! We will sync this when you are back online.' : 'Destination saved successfully.',
    );
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    await syncService.sync();
    setOfflineQueue(syncService.getQueue());
  }, []);

  useEffect(() => {
    if (offlineQueue.length > 0 && isStorageLoaded) {
      const interval = setInterval(() => {
        syncOfflineQueue();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [offlineQueue.length, isStorageLoaded, syncOfflineQueue]);

  const handleRemoveStop = useCallback((spotId: string) => {
    setUser(u => ({
      ...u,
      currentItinerary: u.currentItinerary.filter(id => id !== spotId),
    }));
  }, [setUser]);

  const handleCreateReel = useCallback(async (
    data: { videoUri: string; caption: string; spotId: string; spotName?: string; tags: string[] },
    onProgress?: (p: number) => void,
  ) => {
    const u = userRef.current;
    const vendorId =
      currentVendor?.verificationStatus === 'approved' ? currentVendor.id : undefined;
    try {
      const compressed = await compressVideo(data.videoUri);
      const uploadProgress = (p: number) => {
        setReelsUploadProgress(p);
        onProgress?.(p);
      };
      const newReel = await reelService.createReel({
        videoUri: compressed.compressedUri,
        caption: data.caption,
        spotId: data.spotId,
        spotName: data.spotName || 'Unknown',
        tags: data.tags,
        userId: u.uid,
        userName: u.displayName,
        vendorId,
      }, uploadProgress);
      const rewardPoints = newReel.rewardPoints || 0;
      setReels(prev => [newReel, ...prev]);
      setUser(prev => ({
        ...prev,
        createdReels: [...(prev.createdReels || []), newReel.id],
        totalPoints: (prev.totalPoints || 0) + rewardPoints,
      }));
      setReelsUploadProgress(0);
      Alert.alert(
        'Reel Posted!',
        rewardPoints > 0
          ? `You earned ${rewardPoints} Pal Points for your first reel today!`
          : vendorId
            ? 'Your vendor reel is live on your business profile.'
            : 'Your reel is live.',
      );
    } catch (err: any) {
      setReelsUploadProgress(0);
      Alert.alert('Upload Failed', err?.message || 'Could not upload your reel. Please try again.');
      throw err;
    }
  }, [currentVendor, setUser]);

  const handleLikeReel = useCallback(async (reelId: string) => {
    const u = userRef.current;
    const liked = u.likedReels || [];
    const isLiked = liked.includes(reelId);
    if (pendingLikeRef.current.has(reelId)) return;
    pendingLikeRef.current.add(reelId);

    setReels(prev => prev.map(r =>
      r.id === reelId ? { ...r, likes: isLiked ? r.likes - 1 : r.likes + 1 } : r
    ));
    setUser(prev => ({
      ...prev,
      likedReels: isLiked
        ? (prev.likedReels || []).filter(id => id !== reelId)
        : [...(prev.likedReels || []), reelId],
    }));
    try {
      if (isLiked) {
        await reelService.unlikeReel(reelId, u.uid);
      } else {
        await reelService.likeReel(reelId, u.uid);
      }
    } catch (e) {
      console.warn('Like sync failed, reverting optimistic update:', e);
      setReels(prev => prev.map(r =>
        r.id === reelId ? { ...r, likes: isLiked ? r.likes + 1 : r.likes - 1 } : r
      ));
      setUser(prev => ({
        ...prev,
        likedReels: isLiked
          ? [...(prev.likedReels || []), reelId]
          : (prev.likedReels || []).filter(id => id !== reelId),
      }));
    } finally {
      pendingLikeRef.current.delete(reelId);
    }
  }, [setUser]);

  const handleAddReelComment = useCallback(async (reelId: string, text: string) => {
    const u = userRef.current;
    const comment: ReelComment = {
      id: `cmt_${Date.now()}`,
      reelId,
      userId: u.uid,
      text,
      createdAt: new Date().toISOString(),
      user: {
        id: u.uid,
        name: u.displayName,
      },
    };
    setReels(prev => prev.map(r => r.id === reelId ? { ...r, comments: [...(r.comments || []), comment] } : r));
    try {
      await reelService.addCommentToReel(reelId, { userId: u.uid, userName: u.displayName, text });
    } catch (e) {
      console.warn('Comment sync failed:', e);
    }
  }, []);

  const handleRedeemOffer = useCallback(async (offerId: string): Promise<VendorOfferRedemption | null> => {
    const u = userRef.current;
    if (u.uid === 'guest-user') {
      Alert.alert('Sign In Required', 'Create an account or sign in to redeem offers.');
      return null;
    }
    const offer = getOfferById(offerId);
    if (!offer) return null;

    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const res = await redemptionsApi.generate(offerId);
        const srv = res.data;
        const redemption: VendorOfferRedemption = {
          id: srv.id,
          userId: srv.userId,
          vendorId: srv.vendorId,
          offerId: srv.offerId,
          pointsSpent: srv.pointsSpent,
          discountReceived: srv.discountValue,
          redeemedAt: srv.createdAt,
          status: 'pending',
          verificationCode: srv.qrCode,
        };
        setRedemptions(prev => [...prev, redemption]);
        const savings = offer.discountType === 'flat' ? srv.discountValue : 0;
        const redeemed = u.redeemedOffers || [];
        setUser(prev => ({
          ...prev,
          totalPoints: (prev.totalPoints || 0) - srv.pointsSpent,
          redeemedOffers: [...redeemed, redemption],
          totalSavings: (prev.totalSavings || 0) + savings,
        }));
        return redemption;
      } catch (err: any) {
        const msg = err?.data?.message || err?.message || 'Redemption failed';
        Alert.alert('Redemption Failed', msg);
        return null;
      }
    }

    // Local fallback
    const vendor = getVendorById(offer.vendorId);
    if (!vendor || vendor.verificationStatus !== 'approved') return null;
    if (!offer.isActive) return null;
    if ((u.totalPoints || 0) < offer.pointsRequired) return null;
    const redeemed = u.redeemedOffers || [];
    const today = new Date().toISOString().slice(0, 10);
    if (redeemed.some(r => r.offerId === offerId && r.redeemedAt.slice(0, 10) === today)) return null;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const redemption: VendorOfferRedemption = {
      id: `red_${Date.now()}`,
      userId: u.uid,
      vendorId: offer.vendorId,
      offerId: offer.id,
      pointsSpent: offer.pointsRequired,
      discountReceived: offer.discountValue,
      redeemedAt: new Date().toISOString(),
      status: 'pending' as const,
      verificationCode: code,
    };
    setRedemptions(prev => [...prev, redemption]);
    const savings = offer.discountType === 'flat' ? offer.discountValue : 0;
    setUser(prev => ({
      ...prev,
      totalPoints: (prev.totalPoints || 0) - offer.pointsRequired,
      redeemedOffers: [...redeemed, redemption],
      totalSavings: (prev.totalSavings || 0) + savings,
    }));
    return redemption;
  }, [getOfferById, getVendorById, setUser]);

  const refreshVendorData = useCallback(async () => {
    if (!DEV_FLAGS.USE_SERVER_API) return;
    try {
      const vendorRes = await vendorsApi.getMe();
      const vendor = vendorRes.data;
      if (!vendor) return;

      const mapped: VendorBusiness = {
        id: vendor.id,
        businessName: vendor.businessName,
        category: vendor.businessType as any,
        linkedSpotIds: vendor.linkedSpotIds || [],
        city: vendor.city,
        state: vendor.state,
        address: vendor.address,
        latitude: vendor.latitude ?? undefined,
        longitude: vendor.longitude ?? undefined,
        phone: vendor.phone || undefined,
        email: vendor.user?.email,
        description: vendor.description || undefined,
        openingHours: vendor.operatingHours || undefined,
        imageUrl: vendor.imageUrl || undefined,
        website: vendor.website || undefined,
        verificationStatus: mapVendorStatus(vendor.status),
        rejectedReason: vendor.rejectionReason || undefined,
        vendorCode: vendor.vendorCode || undefined,
        createdAt: vendor.createdAt,
        showOnMap: vendor.showOnMap,
        showContact: vendor.showContact,
        showWebsite: vendor.showWebsite,
        showImages: vendor.showImages,
        showOffers: vendor.showOffers,
        showReels: vendor.showReels,
        showNavigation: vendor.showNavigation,
      };
      setCurrentVendor(mapped);

      const offersRes = await vendorsApi.listMyOffers();
      const offersList = offersRes.data || [];
      const mappedOffers: VendorOffer[] = offersList.map((o: any) => mapServerOffer(o, vendor.id));
      setVendorOffers(mappedOffers);

      const redemptionsRes = await redemptionsApi.vendorRedemptions();
      const redemptionsList = redemptionsRes.data || [];
      const mappedRedemptions: VendorOfferRedemption[] = redemptionsList.map((r: any) => ({
        id: r.id,
        vendorId: r.vendorId || vendor.id,
        offerId: r.offerId,
        userId: r.userId,
        pointsSpent: r.pointsSpent,
        discountReceived: r.discountValue,
        redeemedAt: r.createdAt,
        status: r.status === 'VERIFIED' ? 'verified' : r.status === 'CANCELLED' ? 'cancelled' : 'pending',
        verificationCode: r.qrCode || '',
        verifiedAt: r.verifiedAt || undefined,
        userName: r.user?.name || r.userName || undefined,
        offerTitle: r.offer?.title || r.offerTitle || undefined,
      }));
      setRedemptions(mappedRedemptions);
    } catch (e) {
      console.warn('[DataContext] Failed to refresh vendor data:', e);
    }
  }, []);

  return (
    <DataContext.Provider value={{
      vendors, vendorOffers, redemptions, currentVendor, reels,
      reelsLoading, reelsUploadProgress, feedHasMore,
      loadMoreReels, refreshReels,
      hiddenGemSubmissions, isStorageLoaded,
      setCurrentVendor, setReels,
      registerVendor, loginVendor, logoutVendor, refreshVendorData,
      approveVendor, rejectVendor, createVendorOffer, toggleVendorOffer, deleteVendorOffer,
      duplicateVendorOffer, updateVendorProfile,
      verifyRedemptionCode, getVendorById, getOfferById,
      submitHiddenGem, approveHiddenGem, rejectHiddenGem,
      handleCreateReel, handleLikeReel, handleAddReelComment,
      handleRedeemOffer, handleCompleteActivity, handleCompleteStop, handleRemoveStop,
      offlineQueue, handleSavePlace, syncOfflineQueue,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataContext must be used within DataProvider');
  return ctx;
}
