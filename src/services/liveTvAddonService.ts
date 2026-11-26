import {
  STREMIO_ADDONS_NET_DIRECTORY,
  StremioNetDirectoryAddon,
} from '../data/nuvioAndStremioCatalog';
import {
  LiveChannel,
  StremioAddonConfig,
  StremioManifest,
} from '../types/media';
import { normalizeStremioUrlKey, stremioAddonService } from './stremioAddonService';

export type UnifiedLiveSourceKind = 'stremio-live';
export type LiveProbeStatus = 'idle' | 'checking' | 'online' | 'degraded' | 'offline';
export type LiveInputMode = 'stremio';

export interface UnifiedLiveSource {
  key: string;
  id: string;
  kind: UnifiedLiveSourceKind;
  name: string;
  url: string;
  enabled: boolean;
  isBuiltIn: boolean;
  description?: string;
  channelCount?: number;
  lastSyncedAt?: string;
  version?: string;
  logo?: string;
  stremioAddon?: StremioAddonConfig;
}

export interface LiveSourceProbeResult {
  sourceKey: string;
  status: LiveProbeStatus;
  latencyMs?: number;
  channelCount?: number;
  detail: string;
  checkedAt: number;
}

const LIVE_TV_DIRECTORY_MANIFESTS = new Set(
  STREMIO_ADDONS_NET_DIRECTORY.filter((a) => a.category === 'Live TV & Sports').map((a) =>
    normalizeStremioUrlKey(a.manifestUrl)
  )
);

const LIVE_TV_DIRECTORY_IDS = new Set(
  STREMIO_ADDONS_NET_DIRECTORY.filter((a) => a.category === 'Live TV & Sports').map((a) => a.id)
);

const BUILTIN_OPEN_LIVE_CHANNELS: LiveChannel[] = [
  {
    id: 'builtin-dd-sports',
    name: 'DD Sports HD',
    group: 'Sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/DD_Sports_2023_logo.svg/320px-DD_Sports_2023_logo.svg.png',
    streamUrl: 'https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8',
    playlistId: 'builtin-live-sports',
    playlistName: 'Built-in Sports & Live TV',
    isLive: true,
    country: 'IN',
  },
  {
    id: 'builtin-m-sports',
    name: 'M Sports HD',
    group: 'Sports',
    logo: 'https://msports.pk/wp-content/uploads/2026/02/m-sports-300.png',
    streamUrl: 'https://cdn.rabta.stream/M-Sports/index.m3u8',
    playlistId: 'builtin-live-sports',
    playlistName: 'Built-in Sports & Live TV',
    isLive: true,
    country: 'PK',
  },
  {
    id: 'builtin-star-sports-2-telugu',
    name: 'Star Sports 2 Telugu HD',
    group: 'Sports',
    logo: 'https://lo1.in/ind/starsp2.png',
    streamUrl: 'https://real-vk.proxy.nellaiiptv.com/SDMEDIA/index.m3u8',
    playlistId: 'builtin-live-sports',
    playlistName: 'Built-in Sports & Live TV',
    isLive: true,
    country: 'IN',
  },
  {
    id: 'builtin-nasa-tv',
    name: 'NASA TV Public Live',
    group: 'Entertainment',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    playlistId: 'builtin-live-open',
    playlistName: 'Built-in Open Broadcast',
    isLive: true,
  },
  {
    id: 'builtin-redbull-tv',
    name: 'Red Bull TV Live',
    group: 'Sports',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    playlistId: 'builtin-live-open',
    playlistName: 'Built-in Open Broadcast',
    isLive: true,
  },
];

export function isLiveTvStremioAddon(
  addon: Pick<StremioAddonConfig, 'id' | 'name' | 'manifestUrl' | 'description'>
): boolean {
  const norm = normalizeStremioUrlKey(addon.manifestUrl || '');
  if (LIVE_TV_DIRECTORY_MANIFESTS.has(norm) || LIVE_TV_DIRECTORY_IDS.has(addon.id)) {
    return true;
  }
  const haystack = `${addon.name || ''} ${addon.description || ''} ${addon.manifestUrl || ''}`;
  return /\b(live\s*tv|sports|usa\s*tv|uk\s*tv|india\s*tv|argentina\s*tv|daddylive|pluto\s*tv|plex\s*live|samsung\s*tv|udptv|moveonjoy)\b/i.test(
    haystack
  );
}

export const liveTvAddonService = {
  getDirectoryLiveStremioAddons(): StremioNetDirectoryAddon[] {
    return STREMIO_ADDONS_NET_DIRECTORY.filter((item) => item.category === 'Live TV & Sports');
  },

  buildUnifiedLiveSources(stremioAddons: StremioAddonConfig[]): UnifiedLiveSource[] {
    return stremioAddons
      .filter((a) => isLiveTvStremioAddon(a))
      .map((addon) => ({
        key: `stremio-live:${addon.id}`,
        id: addon.id,
        kind: 'stremio-live',
        name: addon.name,
        url: addon.manifestUrl,
        enabled: addon.enabled,
        isBuiltIn: false,
        description: addon.description || addon.manifestUrl,
        version: addon.version,
        logo: addon.logo,
        stremioAddon: addon,
      }));
  },

  async loadChannelsFromBuiltInAndStremio(
    stremioAddons: StremioAddonConfig[]
  ): Promise<{ channels: LiveChannel[]; errors: Record<string, string> }> {
    const channels: LiveChannel[] = [];
    const seenUrls = new Set<string>();
    const errors: Record<string, string> = {};

    const configuredSports = (window.__KINO_API_CONFIG__?.sportsChannels || []).map((ch) => ({
      id: ch.id,
      name: ch.name,
      group: 'Sports',
      logo: ch.logo,
      streamUrl: ch.streamUrl,
      playlistId: 'builtin-sports-config',
      playlistName: 'Built-in Sports Feed',
      isLive: true,
      country: ch.country,
    }));

    for (const ch of [...configuredSports, ...BUILTIN_OPEN_LIVE_CHANNELS]) {
      if (!ch.streamUrl || seenUrls.has(ch.streamUrl)) continue;
      seenUrls.add(ch.streamUrl);
      channels.push(ch);
    }

    const enabledLiveAddons = stremioAddons.filter(
      (a) => a.enabled && isLiveTvStremioAddon(a) && a.manifestUrl
    );

    const fetchJson = async <T,>(url: string, timeoutMs = 6000): Promise<T | null> => {
      const tryOnce = async (target: string): Promise<T | null> => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(target, { signal: controller.signal });
          if (!res.ok) return null;
          const text = await res.text();
          return text.trim().startsWith('{') ? (JSON.parse(text) as T) : null;
        } catch {
          return null;
        } finally {
          window.clearTimeout(timer);
        }
      };
      return (await tryOnce(`/api/proxy?url=${encodeURIComponent(url)}`)) || (await tryOnce(url));
    };

    await Promise.allSettled(
      enabledLiveAddons.map(async (addon) => {
        try {
          const manifest = await fetchJson<StremioManifest>(addon.manifestUrl, 5500);
          if (!manifest) return;
          const [rawBase, queryPart] = addon.manifestUrl.split('?');
          const cleanBase = rawBase.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
          const qSuffix = queryPart ? `?${queryPart}` : '';

          const rawCatalogs = manifest.catalogs || [];
          const tvCatalogs = rawCatalogs.filter(
            (c) =>
              c.type === 'tv' ||
              c.type === 'channel' ||
              c.type === 'other' ||
              c.type === 'live' ||
              c.type === 'sports'
          );
          const targetCatalogs = (tvCatalogs.length > 0 ? tvCatalogs : rawCatalogs).slice(0, 4);

          for (const cat of targetCatalogs) {
            const catType = cat.type || 'tv';
            const catUrl = `${cleanBase}/catalog/${catType}/${encodeURIComponent(cat.id)}.json${qSuffix}`;
            const catData = await fetchJson<{
              metas?: Array<{
                id?: string;
                name?: string;
                poster?: string;
                logo?: string;
                genres?: string[];
                country?: string;
                behaviorHints?: { videoOriginalUrl?: string };
                streamUrl?: string;
                url?: string;
                streams?: Array<{ url?: string }>;
              }>;
            }>(catUrl, 6000);
            const metas = (catData?.metas || []).slice(0, 40);
            await Promise.allSettled(
              metas.map(async (meta) => {
                if (!meta.id || !meta.name) return;
                let streamUrl =
                  meta.behaviorHints?.videoOriginalUrl ||
                  meta.streamUrl ||
                  meta.url ||
                  meta.streams?.[0]?.url;

                if (!streamUrl) {
                  const streamEndpoint = `${cleanBase}/stream/${catType}/${encodeURIComponent(meta.id)}.json${qSuffix}`;
                  const streamData = await fetchJson<{
                    streams?: Array<{ url?: string }>;
                  }>(streamEndpoint, 4500);
                  streamUrl = streamData?.streams?.find((s) => s.url?.startsWith('http'))?.url;
                }

                if (!streamUrl || seenUrls.has(streamUrl)) return;
                seenUrls.add(streamUrl);
                channels.push({
                  id: `stremio-${addon.id}-${meta.id}`,
                  name: meta.name,
                  group: meta.genres?.[0] || cat.name || 'Live TV',
                  logo: meta.logo || meta.poster,
                  streamUrl,
                  playlistId: addon.id,
                  playlistName: addon.name,
                  isLive: true,
                  country: meta.country,
                });
              })
            );
          }
        } catch (err) {
          errors[addon.id] = err instanceof Error ? err.message : `Failed to load ${addon.name}`;
        }
      })
    );

    return { channels, errors };
  },

  async addLiveSource(params: {
    name?: string;
    input: string;
    mode?: LiveInputMode;
  }): Promise<{
    kind: UnifiedLiveSourceKind;
    message: string;
    stremioAddons: StremioAddonConfig[];
  }> {
    const trimmedInput = params.input.trim();
    if (!trimmedInput) {
      throw new Error('Enter a Stremio Live TV manifest.json or stremio:// URL.');
    }

    const addon = await stremioAddonService.fetchManifest(trimmedInput, params.name?.trim());
    const { storageService } = await import('./storageService');
    const updated = storageService.addStremioAddon(addon);
    return {
      kind: 'stremio-live',
      message: `Added Live TV add-on "${addon.name}".`,
      stremioAddons: updated,
    };
  },

  async probeLiveSource(source: UnifiedLiveSource): Promise<LiveSourceProbeResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    try {
      const target = `/api/proxy?url=${encodeURIComponent(source.url)}`;
      const res = await fetch(target, { signal: controller.signal });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          sourceKey: source.key,
          status: 'offline',
          latencyMs,
          detail: `HTTP ${res.status}`,
          checkedAt: Date.now(),
        };
      }
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        return {
          sourceKey: source.key,
          status: 'degraded',
          latencyMs,
          detail: 'Unexpected manifest response',
          checkedAt: Date.now(),
        };
      }
      const manifest = JSON.parse(text) as StremioManifest;
      if (!manifest?.id || !manifest?.name) {
        return {
          sourceKey: source.key,
          status: 'degraded',
          latencyMs,
          detail: 'Incomplete manifest',
          checkedAt: Date.now(),
        };
      }
      const catalogCount = Array.isArray(manifest.catalogs) ? manifest.catalogs.length : 0;
      return {
        sourceKey: source.key,
        status: latencyMs >= 3000 ? 'degraded' : 'online',
        latencyMs,
        detail: `${catalogCount > 0 ? `${catalogCount} catalogs` : `v${manifest.version || '1.0.0'}`} · ${latencyMs}ms`,
        checkedAt: Date.now(),
      };
    } catch {
      return {
        sourceKey: source.key,
        status: 'offline',
        latencyMs: Date.now() - start,
        detail: 'Unreachable or timed out',
        checkedAt: Date.now(),
      };
    } finally {
      window.clearTimeout(timer);
    }
  },

  async probeAllLiveSources(
    sources: UnifiedLiveSource[],
    onProgress?: (result: LiveSourceProbeResult) => void
  ): Promise<Record<string, LiveSourceProbeResult>> {
    const out: Record<string, LiveSourceProbeResult> = {};
    const CONCURRENCY = 5;
    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      const batch = sources.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (src) => {
          const result = await this.probeLiveSource(src);
          out[src.key] = result;
          onProgress?.(result);
        })
      );
    }
    return out;
  },
};
