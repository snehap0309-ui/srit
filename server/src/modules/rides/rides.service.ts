import { haversineDistance } from '../../shared/utils/geo';

interface RideOption {
  provider: 'uber' | 'ola' | 'rapido';
  displayName: string;
  type: 'bike' | 'auto' | 'cab' | 'xl';
  baseFare: number;
  perKmRate: number;
  minFare: number;
}

interface RideEstimate {
  provider: 'uber' | 'ola' | 'rapido';
  displayName: string;
  type: 'bike' | 'auto' | 'cab' | 'xl';
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  currency: string;
  durationMinutes: number;
  distanceKm: number;
  deepLink: string;
}

const RIDE_OPTIONS: RideOption[] = [
  // Uber
  { provider: 'uber', displayName: 'Uber Moto', type: 'bike', baseFare: 15, perKmRate: 5, minFare: 25 },
  { provider: 'uber', displayName: 'Uber Go', type: 'cab', baseFare: 25, perKmRate: 12, minFare: 50 },
  { provider: 'uber', displayName: 'Uber XL', type: 'xl', baseFare: 35, perKmRate: 18, minFare: 75 },
  // Ola
  { provider: 'ola', displayName: 'Ola Bike', type: 'bike', baseFare: 15, perKmRate: 5, minFare: 25 },
  { provider: 'ola', displayName: 'Ola Auto', type: 'auto', baseFare: 20, perKmRate: 10, minFare: 35 },
  { provider: 'ola', displayName: 'Ola Mini', type: 'cab', baseFare: 25, perKmRate: 12, minFare: 50 },
  { provider: 'ola', displayName: 'Ola Cab', type: 'cab', baseFare: 30, perKmRate: 14, minFare: 60 },
  // Rapido
  { provider: 'rapido', displayName: 'Rapido Bike', type: 'bike', baseFare: 12, perKmRate: 4, minFare: 20 },
  { provider: 'rapido', displayName: 'Rapido Auto', type: 'auto', baseFare: 18, perKmRate: 9, minFare: 30 },
  { provider: 'rapido', displayName: 'Rapido Cab', type: 'cab', baseFare: 25, perKmRate: 13, minFare: 50 },
];

function estimatePrice(option: RideOption, distanceKm: number): { price: number; low: number; high: number } {
  const base = option.baseFare;
  const perKm = option.perKmRate * distanceKm;
  const estimated = Math.max(base + perKm, option.minFare);
  const surgeLow = Math.round(estimated * 0.9);
  const surgeHigh = Math.round(estimated * 1.3);
  const price = Math.round(estimated);
  return { price, low: surgeLow, high: Math.max(surgeHigh, price + 10) };
}

function estimateDuration(distanceKm: number): number {
  const avgSpeedKmh = 25;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

function buildDeepLink(provider: string, originLat: number, originLng: number, destLat: number, destLng: number): string {
  switch (provider) {
    case 'uber':
      return (
        'https://m.uber.com/looking?' +
        `pickup=${encodeURIComponent(JSON.stringify({ latitude: originLat, longitude: originLng }))}` +
        `&drop[0]=${encodeURIComponent(JSON.stringify({ latitude: destLat, longitude: destLng }))}`
      );
    case 'ola':
      return (
        'https://book.olacabs.com/?' +
        `pickup_lat=${originLat}&pickup_lng=${originLng}` +
        `&drop_lat=${destLat}&drop_lng=${destLng}`
      );
    case 'rapido':
      return (
        'https://m.rapido.bike/unup-home/seo?' +
        `pickup_lat=${originLat}&pickup_lng=${originLng}` +
        `&drop_lat=${destLat}&drop_lng=${destLng}`
      );
    default:
      return '';
  }
}

export const ridesService = {
  getEstimates(originLat: number, originLng: number, destLat: number, destLng: number): RideEstimate[] {
    const distanceKm = haversineDistance(originLat, originLng, destLat, destLng) / 1000;
    const roundedDistance = Math.round(distanceKm * 10) / 10;

    return RIDE_OPTIONS.map((option) => {
      const { price, low, high } = estimatePrice(option, roundedDistance);
      return {
        provider: option.provider,
        displayName: option.displayName,
        type: option.type,
        estimatedPrice: price,
        priceRange: { low, high },
        currency: 'INR',
        durationMinutes: estimateDuration(roundedDistance),
        distanceKm: roundedDistance,
        deepLink: buildDeepLink(option.provider, originLat, originLng, destLat, destLng),
      };
    });
  },
};
