import { LiveChannel } from '../types/media';

export interface IptvParseResult {
  channels: LiveChannel[];
  sourceUrl: string;
  error?: string;
}

const DEFAULT_MASTER_INDEX_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const playlistCache = new Map<string, LiveChannel[]>();

const CORS_FRIENDLY_HOSTS = [
  'akamaized.net',
  'mux.dev',
  'amagi.tv',
  'wurl.tv',
  'cloudfront.net',
  'fastly.net',
  'unified-streaming.com',
  'bitdash',
  'apple.com',
  'pluto.tv',
  'plex.tv',
  'dai.google.com',
  'xumo',
  'tubi',
  'llnwi.net',
  'redbull',
  'nasa',
];

function scoreChannelBrowserCompatibility(ch: LiveChannel): number {
  let score = 0;
  const lower = ch.streamUrl.toLowerCase();
  if (lower.startsWith('https://')) score += 10;
  if (lower.includes('.m3u8')) score += 4;
  if (CORS_FRIENDLY_HOSTS.some((host) => lower.includes(host))) score += 20;
  if (ch.logo && ch.logo.startsWith('https://')) score += 2;
  return score;
}

function extractExtinfAttribute(line: string, attribute: string): string | undefined {
  const pattern = new RegExp(`${attribute}="([^"]*)"`, 'i');
  const match = line.match(pattern);
  const value = match?.[1]?.trim();
  return value || undefined;
}

function normalizeGroupTitle(rawGroup?: string): string {
  if (!rawGroup) return 'General';
  const primary = rawGroup.split(';')[0]?.trim();
  return primary || 'General';
}

export function getMasterIptvUrl(): string {
  return window.__KINO_API_CONFIG__?.iptvOrg?.masterIndexUrl || DEFAULT_MASTER_INDEX_URL;
}

/**
 * Parses raw #EXTM3U playlist text into a deduplicated, browser-prioritized list of LiveChannel items.
 */
export function parseIptvM3u(
  rawContent: string,
  playlistId = 'iptv-org-master',
  playlistName = 'iptv-org Master Index'
): LiveChannel[] {
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: LiveChannel[] = [];
  const seenUrls = new Set<string>();

  let pendingMeta: {
    name: string;
    group: string;
    logo?: string;
    tvgId?: string;
    country?: string;
    language?: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.lastIndexOf(',');
      const displayName = commaIndex !== -1 ? line.slice(commaIndex + 1).trim() : '';
      const tvgName = extractExtinfAttribute(line, 'tvg-name');
      const tvgLogo = extractExtinfAttribute(line, 'tvg-logo');
      const tvgId = extractExtinfAttribute(line, 'tvg-id');
      const groupTitle = extractExtinfAttribute(line, 'group-title');
      const country = extractExtinfAttribute(line, 'tvg-country');
      const language = extractExtinfAttribute(line, 'tvg-language');

      pendingMeta = {
        name: displayName || tvgName || `Channel ${channels.length + 1}`,
        group: normalizeGroupTitle(groupTitle),
        logo: tvgLogo,
        tvgId,
        country,
        language,
      };
      continue;
    }

    if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      if (!seenUrls.has(line)) {
        seenUrls.add(line);
        const channelKey = pendingMeta?.tvgId || `ch-${channels.length + 1}`;
        channels.push({
          id: `${playlistId}::${channelKey}::${channels.length}`,
          name: pendingMeta?.name || `Live Stream ${channels.length + 1}`,
          group: pendingMeta?.group || 'General',
          logo: pendingMeta?.logo,
          streamUrl: line,
          playlistId,
          playlistName,
          isLive: true,
          tvgId: pendingMeta?.tvgId,
          country: pendingMeta?.country,
          language: pendingMeta?.language,
        });
      }
      pendingMeta = null;
    }
  }

  return channels.sort(
    (a, b) => scoreChannelBrowserCompatibility(b) - scoreChannelBrowserCompatibility(a)
  );
}

/**
 * Fetches and parses an M3U playlist URL (defaults to window.__KINO_API_CONFIG__.iptvOrg.masterIndexUrl).
 */
export async function fetchAndParseIptvM3u(options?: {
  url?: string;
  playlistId?: string;
  playlistName?: string;
  forceRefresh?: boolean;
}): Promise<IptvParseResult> {
  const sourceUrl = options?.url || getMasterIptvUrl();
  const playlistId = options?.playlistId || 'iptv-org-master';
  const playlistName = options?.playlistName || 'iptv-org Master Index';

  if (!options?.forceRefresh && playlistCache.has(sourceUrl)) {
    return {
      channels: playlistCache.get(sourceUrl) || [],
      sourceUrl,
    };
  }

  try {
    const fetchTarget = sourceUrl.startsWith('/api/')
      ? sourceUrl
      : `/api/proxy?url=${encodeURIComponent(sourceUrl)}`;
    let response = await fetch(fetchTarget);
    if (!response.ok) {
      response = await fetch(sourceUrl);
    }
    if (!response.ok) {
      return {
        channels: [],
        sourceUrl,
        error: `iptv-org playlist returned HTTP ${response.status}`,
      };
    }

    const rawText = await response.text();
    const channels = parseIptvM3u(rawText, playlistId, playlistName);
    playlistCache.set(sourceUrl, channels);

    return {
      channels,
      sourceUrl,
    };
  } catch {
    return {
      channels: [],
      sourceUrl,
      error: `Unable to fetch M3U playlist from ${sourceUrl}.`,
    };
  }
}

/**
 * Deep browser CORS HLS check: verifies master #EXTM3U, first variant playlist if adaptive,
 * and confirms the first media segment (.ts / .m4s) responds with HTTP 200 or 206 via Range probe.
 */
export async function probeChannelPlayableInBrowser(
  streamUrl: string,
  timeoutMs = 3500
): Promise<boolean> {
  if (!streamUrl.startsWith('https://')) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const probeFirstSegment = async (mediaPlaylistText: string, playlistBaseUrl: string): Promise<boolean> => {
    const segmentLine = mediaPlaylistText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    if (!segmentLine) return false;

    const segmentUrl = new URL(segmentLine, playlistBaseUrl).toString();
    const segRes = await fetch(segmentUrl, {
      method: 'GET',
      mode: 'cors',
      headers: { Range: 'bytes=0-1023' },
      signal: controller.signal,
    });
    return segRes.status === 200 || segRes.status === 206;
  };

  try {
    const response = await fetch(streamUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      return false;
    }

    const bodyText = await response.text();
    if (!bodyText.includes('#EXTM3U')) {
      return contentType.startsWith('video/');
    }

    // If master playlist points to variant playlists, verify the first variant playlist + its first segment
    if (bodyText.includes('#EXT-X-STREAM-INF')) {
      const lines = bodyText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      const firstVariant = lines[0];
      if (!firstVariant) return false;

      const resolvedVariantUrl = new URL(firstVariant, response.url || streamUrl).toString();
      const variantRes = await fetch(resolvedVariantUrl, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      if (!variantRes.ok) return false;
      const variantText = await variantRes.text();
      if (!variantText.includes('#EXTM3U') || !variantText.includes('#EXTINF')) return false;
      return probeFirstSegment(variantText, variantRes.url || resolvedVariantUrl);
    }

    if (!bodyText.includes('#EXTINF')) return false;
    return probeFirstSegment(bodyText, response.url || streamUrl);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function probeChannelsBatch(
  channels: LiveChannel[],
  onBatchComplete: (results: Record<string, boolean>) => void,
  concurrency = 6
): Promise<void> {
  for (let i = 0; i < channels.length; i += concurrency) {
    const slice = channels.slice(i, i + concurrency);
    const settled = await Promise.all(
      slice.map(async (ch) => ({
        id: ch.id,
        playable: await probeChannelPlayableInBrowser(ch.streamUrl),
      }))
    );

    const map: Record<string, boolean> = {};
    for (const item of settled) {
      map[item.id] = item.playable;
    }
    onBatchComplete(map);
  }
}

export function clearIptvParserCache(): void {
  playlistCache.clear();
}

export const iptvParser = {
  getMasterIptvUrl,
  parseIptvM3u,
  fetchAndParseIptvM3u,
  fetchMasterChannels: (forceRefresh = false) =>
    fetchAndParseIptvM3u({
      url: getMasterIptvUrl(),
      playlistId: 'iptv-org-master',
      playlistName: 'iptv-org Master Index',
      forceRefresh,
    }),
  probeChannelPlayableInBrowser,
  probeChannelsBatch,
  clearCache: clearIptvParserCache,
};
