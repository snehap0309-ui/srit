/** Mobile-side destination helpers — uses shared/indiaDestinationAliases.ts */

import {
  INDIA_DESTINATION_ALIASES,
  INDIA_REGION_DESTINATIONS,
} from '../../shared/indiaDestinationAliases';

const DESTINATION_ALIASES = INDIA_DESTINATION_ALIASES;
const REGION_DESTINATIONS = INDIA_REGION_DESTINATIONS;

export function normalizeDestinationKey(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(india|city|town|district)\b/g, '')
    .trim();
}

function destinationMatchesInText(haystack: string, dest: string): boolean {
  if (!haystack || !dest) return false;
  if (haystack === dest) return true;
  if (dest.length < 4) return false;
  const escaped = dest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
}

export function canonicalizeDestination(raw: string): string {
  const key = normalizeDestinationKey(raw);
  if (!key) return '';
  if (DESTINATION_ALIASES[key]) return DESTINATION_ALIASES[key];
  const aliasKeys = Object.keys(DESTINATION_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliasKeys) {
    if (alias.length >= 4 && (key === alias || destinationMatchesInText(key, alias))) {
      return DESTINATION_ALIASES[alias];
    }
  }
  return key;
}

function isRegionDestination(destination: string): boolean {
  return REGION_DESTINATIONS.has(canonicalizeDestination(destination));
}

export function formatDestinationLabel(raw: string): string {
  const key = canonicalizeDestination(raw) || normalizeDestinationKey(raw);
  if (!key) return (raw || '').trim();
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

function canonicalPlaceField(value: string | null | undefined): string {
  const normalized = normalizeDestinationKey(value || '');
  if (!normalized) return '';
  return canonicalizeDestination(normalized) || normalized;
}

export function placeBelongsToDestination(
  place: { city?: string | null; state?: string | null; name?: string | null },
  destination: string,
): boolean {
  const dest = canonicalizeDestination(destination);
  if (!dest || dest.length < 2) return false;
  const city = canonicalPlaceField(place.city);
  const state = canonicalPlaceField(place.state);
  const name = normalizeDestinationKey(place.name || '');
  if (city === dest || state === dest) return true;
  if (dest.length >= 4) {
    if (destinationMatchesInText(city, dest) || (destinationMatchesInText(dest, city) && city.length >= 4)) return true;
    if (isRegionDestination(dest) && (destinationMatchesInText(state, dest) || (destinationMatchesInText(dest, state) && state.length >= 4))) return true;
  }
  if (dest.length >= 4 && destinationMatchesInText(name, dest)) return true;
  return false;
}

/** Extract landmark-like phrases from a free-text trip prompt. */
export function extractMustVisitHints(prompt: string | undefined | null, destination: string): string[] {
  if (!prompt?.trim()) return [];
  const dest = canonicalizeDestination(destination);
  const destLabel = formatDestinationLabel(destination).toLowerCase();

  let text = prompt.trim()
    .replace(/(?:plan|book|make)\s+(?:a\s+)?(?:\d+-?\s*day\s+)?(?:trip|itinerary|holiday|vacation)\s+(?:to|in|around|for)\s+[a-zA-Z]+(?:\s+[a-zA-Z]+)?(?=\s*(?:,|\/|&|\bwith\b|\bincluding\b|\band\b|\bplus\b|$))/gi, ' ')
    .replace(/\b(india|trip|travel|visit|plan|explore|itinerary|holiday|vacation|days?|day|relaxed|balanced|quick|solo|couple|family|friends|budget|morning|evening|afternoon)\b/gi, ' ')
    .replace(/\bin\s+[a-zA-Z]+(?:\s+[a-zA-Z]+)?\s*$/i, ' ');

  const hints = new Set<string>();
  for (const q of text.match(/"([^"]{3,60})"|'([^']{3,60})'/g) || []) {
    const cleaned = q.replace(/['"]/g, '').trim();
    if (cleaned.length >= 3) hints.add(cleaned);
  }
  for (const chunk of text.split(/,|\/|&|\band\b|\bwith\b|\bincluding\b|\bplus\b/i)) {
    const cleaned = chunk.replace(/[^\w\s.-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 3 || cleaned.length > 60) continue;
    const words = cleaned.split(' ').filter(Boolean);
    if (words.length === 0) continue;
    if (words.length === 1 && words[0].length < 5) continue;
    const lower = cleaned.toLowerCase();
    if (lower === dest || lower === destLabel) continue;
    if (/^(temples?|heritage|nature|food|adventure|shopping|culture|waterfalls?)$/i.test(cleaned)) continue;
    hints.add(cleaned);
  }
  return Array.from(hints).slice(0, 12);
}
