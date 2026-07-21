import { Reel, ReelComment } from '../types';
import { getSampleReels } from '../data/reelsData';
import { DEV_FLAGS } from '../config/devFlags';
import { socialApi, uploadApi } from './api';
import { API_CONFIG } from '../config/api';

const apiOrigin = API_CONFIG.baseUrl.replace(/\/api\/v1\/?$/, '');

const FALLBACK_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
];

function isLikelyUnreachableVideoUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  // Only remote http(s) URLs are playable across devices.
  // file:// and content:// are device-local (often wrongly saved after a failed upload).
  if (!(trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
    return true;
  }
  if (trimmed.includes('10.0.2.2')) return true;
  if (trimmed.includes('127.0.0.1')) return true;
  if (trimmed.includes('localhost')) return true;
  // Render disk uploads vanish on redeploy unless hosted on a CDN.
  if (
    /\/uploads\//i.test(trimmed) &&
    !trimmed.includes('cloudinary') &&
    !trimmed.includes('res.cloudinary.com')
  ) {
    return true;
  }
  return false;
}

export function mapReelUrls(reel: Reel): Reel {
  if (!reel) return reel;
  const mappedVideo = reel.videoUrl && reel.videoUrl.startsWith('/')
    ? `${apiOrigin}${reel.videoUrl}`
    : reel.videoUrl;
  const mappedThumb = reel.thumbnail && reel.thumbnail.startsWith('/')
    ? `${apiOrigin}${reel.thumbnail}`
    : reel.thumbnail;
  return {
    ...reel,
    videoUrl: mappedVideo || '',
    thumbnail: mappedThumb || null,
  };
}

function applyVideoFallback(reel: Reel, index: number): Reel {
  const mapped = mapReelUrls(reel);
  if (!isLikelyUnreachableVideoUrl(mapped.videoUrl)) return mapped;
  const samples = getSampleReels();
  const sample = samples[index % samples.length];
  // Keep real creator/caption — only swap the unplayable media URL.
  return {
    ...mapped,
    videoUrl: sample?.videoUrl || FALLBACK_VIDEOS[index % FALLBACK_VIDEOS.length],
    thumbnail: mapped.thumbnail || sample?.thumbnail || null,
  };
}

export interface ReelUploadData {
  videoUri: string;
  caption: string;
  spotId: string;
  spotName: string;
  tags: string[];
  userId: string;
  userName: string;
  vendorId?: string;
  eventId?: string;
}

const CREATOR_DAILY_REEL_POINTS = 100;
const localCreatorRewardDates = new Set<string>();

function getLocalRewardDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: any;
  hasMore: boolean;
}

function createLocalReel(data: ReelUploadData): Reel {
  const rewardDate = getLocalRewardDate();
  const rewardKey = `${data.userId}:${rewardDate}`;
  const rewardPoints = localCreatorRewardDates.has(rewardKey) ? 0 : CREATOR_DAILY_REEL_POINTS;
  if (rewardPoints > 0) {
    localCreatorRewardDates.add(rewardKey);
  }

  return {
    id: `reel_${Date.now()}`,
    creatorId: `creator_${data.userId}`,
    videoUrl: data.videoUri,
    thumbnail: null,
    title: data.caption.slice(0, 30),
    description: data.caption,
    likes: 0,
    views: 0,
    shares: 0,
    saves: 0,
    featured: false,
    rewardPoints,
    dailyRewardClaimed: rewardPoints > 0,
    dailyRewardDate: rewardDate,
    placeId: data.spotId || null,
    vendorId: data.vendorId || null,
    eventId: data.eventId || null,
    createdAt: new Date().toISOString(),
    creator: {
      id: `creator_${data.userId}`,
      username: data.userName,
      avatar: null,
      verified: false,
      userId: data.userId,
    },
  };
}

let localReelsCache: Reel[] | null = null;

function getLocalReels(): Reel[] {
  if (!localReelsCache) {
    localReelsCache = getSampleReels();
  }
  return localReelsCache;
}

export async function uploadReelVideo(
  videoUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (DEV_FLAGS.USE_SERVER_API) {
    onProgress?.(10);
    const result = await uploadApi.uploadVideo(videoUri, onProgress);
    onProgress?.(100);
    if (!result?.url || !(result.url.startsWith('http://') || result.url.startsWith('https://'))) {
      throw new Error('Video upload did not return a playable URL. Please try again.');
    }
    return result.url;
  }
  return videoUri;
}

export async function createReel(data: ReelUploadData, onProgress?: (p: number) => void): Promise<Reel> {
  if (DEV_FLAGS.USE_SERVER_API) {
    onProgress?.(5);
    const videoUrl = await uploadReelVideo(data.videoUri, (p) => onProgress?.(Math.round(p * 0.85)));
    onProgress?.(90);

    // Approved vendors post to VendorReel API; creators use social Reel API.
    if (data.vendorId) {
      const { vendorsApi } = require('./api');
      const vendorReel = await vendorsApi.createVendorReel({
        videoUrl,
        title: data.caption?.slice(0, 200) || undefined,
        description: data.caption || undefined,
      });
      onProgress?.(100);
      return mapReelUrls({
        id: vendorReel.id,
        creatorId: data.vendorId,
        videoUrl: vendorReel.videoUrl,
        thumbnail: vendorReel.thumbnail || null,
        title: vendorReel.title || null,
        description: vendorReel.description || null,
        likes: vendorReel.likes || 0,
        views: vendorReel.views || 0,
        shares: 0,
        saves: 0,
        featured: false,
        eventId: null,
        rewardPoints: 0,
        createdAt: vendorReel.createdAt || new Date().toISOString(),
        tags: data.tags || [],
        placeId: data.spotId || undefined,
        vendorId: data.vendorId,
        creator: {
          id: data.vendorId,
          username: data.userName,
          fullName: data.userName,
          avatar: null,
          verified: true,
          userId: data.userId,
        },
      } as Reel);
    }

    const res = await socialApi.createReel({
      videoUrl,
      description: data.caption,
      placeId: data.spotId || undefined,
      vendorId: data.vendorId || undefined,
      eventId: data.eventId || undefined,
    });
    onProgress?.(100);
    return mapReelUrls(res.data);
  }
  const newReel = createLocalReel({ ...data });
  const localReels = getLocalReels();
  localReels.unshift({ ...newReel });
  return newReel;
}

export async function getReelsFeed(
  lastDoc?: any,
  pageSize: number = 5,
  category?: string,
  coords?: { latitude: number; longitude: number }
): Promise<PaginatedResult<Reel>> {
  if (DEV_FLAGS.USE_SERVER_API) {
    try {
      const page = typeof lastDoc === 'number' ? Math.floor(lastDoc / pageSize) + 1 : 1;
      const res = await socialApi.getReelsFeed({
        page,
        limit: pageSize,
        category,
        lat: coords?.latitude,
        lng: coords?.longitude,
        radius: 100,
      });
      const items = (res.data || [])
        .map(applyVideoFallback)
        .filter((r): r is Reel => !!r?.id);
      return {
        items,
        lastDoc: page * pageSize,
        hasMore: items.length === pageSize,
      };
    } catch {
      // API unavailable — fall through to local sample reels silently
    }
  }
  const localReels = getLocalReels();
  const startIndex = lastDoc || 0;
  const items = localReels.slice(startIndex, startIndex + pageSize);
  return {
    items: items.map(applyVideoFallback),
    lastDoc: startIndex + pageSize,
    hasMore: startIndex + pageSize < localReels.length,
  };
}

export async function getReelById(reelId: string): Promise<Reel | null> {
  if (DEV_FLAGS.USE_SERVER_API) {
    const res = await socialApi.getReelById(reelId);
    return res.data ? applyVideoFallback(res.data, 0) : null;
  }
  const local = getLocalReels().find(r => r.id === reelId);
  return local ? { ...local, videoUrl: local.videoUrl || '' } : null;
}

export async function likeReel(reelId: string, _userId: string): Promise<void> {
  if (DEV_FLAGS.USE_SERVER_API) {
    await socialApi.likeReel(reelId);
    return;
  }
  const localReels = getLocalReels();
  const reel = localReels.find(r => r.id === reelId);
  if (reel) {
    reel.likes += 1;
  }
}

export async function unlikeReel(reelId: string, _userId: string): Promise<void> {
  if (DEV_FLAGS.USE_SERVER_API) {
    await socialApi.unlikeReel(reelId);
    return;
  }
  const localReels = getLocalReels();
  const reel = localReels.find(r => r.id === reelId);
  if (reel) {
    reel.likes = Math.max(0, reel.likes - 1);
  }
}

export async function addCommentToReel(
  reelId: string,
  comment: { userId: string; userName: string; text: string },
): Promise<ReelComment> {
  if (DEV_FLAGS.USE_SERVER_API) {
    const res = await socialApi.addComment(reelId, comment.text);
    return res.data;
  }
  const newComment: ReelComment = {
    id: `cmt_${Date.now()}`,
    reelId,
    userId: comment.userId,
    text: comment.text,
    createdAt: new Date().toISOString(),
    user: {
      id: comment.userId,
      name: comment.userName,
    },
  };

  const localReels = getLocalReels();
  const _reel = localReels.find(r => r.id === reelId);
  return newComment;
}

export async function getComments(
  reelId: string,
  lastDoc?: any,
  _pageSize: number = 20,
): Promise<PaginatedResult<ReelComment>> {
  if (DEV_FLAGS.USE_SERVER_API) {
    const res = await socialApi.getComments(reelId);
    const items = res.data || [];
    return {
      items,
      lastDoc: items.length,
      hasMore: false,
    };
  }
  return {
    items: [],
    lastDoc: 0,
    hasMore: false,
  };
}

export async function incrementReelViews(reelId: string): Promise<void> {
  if (DEV_FLAGS.USE_SERVER_API) {
    await socialApi.incrementViews(reelId);
    return;
  }
  const localReels = getLocalReels();
  const reel = localReels.find(r => r.id === reelId);
  if (reel) reel.views += 1;
}

