import { FALLBACK_ART } from '../data/curatedCatalog';
import {
  CastMember,
  Genre,
  MediaDetails,
  MediaItem,
  MediaType,
  StreamResolutionResult,
  StreamSource,
} from '../types/media';
import { storageService } from './storageService';

interface DejavuListItem {
  id?: string;
  title?: string;
  img?: string;
  detail?: {
    rating?: string;
    quality?: string;
    year?: string;
    recent?: string;
    category?: string;
  };
}

interface DejavuListResponse {
  currentPage?: number;
  hasNextPage?: boolean;
  results?: DejavuListItem[];
  length?: number;
  total?: number;
  error?: string;
}

interface DejavuDetailsBlock {
  category?: string;
  released?: string;
  genere?: string[];
  genre?: string[];
  casts?: string[];
  duration?: string[] | string;
  country?: string[];
  production?: string[];
}

interface DejavuDetailsResponse {
  result?: {
    id?: string;
    title?: string;
    img?: string;
    description?: string;
    details?: DejavuDetailsBlock;
    detail?: DejavuDetailsBlock;
  };
  error?: string;
}

const dejavuWatchSupportCache = new Map<string, boolean>();

function getBaseUrl(): string {
  return storageService.getDejavuApiUrl();
}

function buildRoute(pathTemplate: string, replacements: Record<string, string> = {}): string {
  const base = getBaseUrl();
  if (!base) return '';
  let path = pathTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    path = path.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function hashStringToId(input: string, seedOffset = 0): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return 900000 + (Math.abs(hash + seedOffset) % 9000000);
}

function parseRating(rawRating?: string): number {
  if (!rawRating) return 7.4;
  const cleaned = rawRating.replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(10, parsed) : 7.4;
}

function inferMediaType(item: DejavuListItem, forcedType?: MediaType): MediaType {
  if (forcedType) return forcedType;
  const cat = String(item.detail?.category || '').toLowerCase();
  const idLower = String(item.id || '').toLowerCase();
  if (cat.includes('tv') || cat.includes('series') || cat.includes('show')) return 'tv';
  if (item.detail?.recent && !item.detail?.year) return 'tv';
  if (idLower.startsWith('tv-') || idLower.includes('/tv/')) return 'tv';
  return 'movie';
}

function mapDejavuListItem(item: DejavuListItem, idx: number, forcedType?: MediaType): MediaItem | null {
  const rawId = String(item.id || '').trim();
  const title = (item.title || '').trim();
  if (!rawId || !title) return null;

  const mediaType = inferMediaType(item, forcedType);
  const posterUrl = item.img && item.img.trim() ? item.img.trim() : null;
  const fallbackPool = [
    FALLBACK_ART.posterCrimsonVelvet,
    FALLBACK_ART.posterAlpineApex,
    FALLBACK_ART.heroNeonHorizon,
    FALLBACK_ART.heroOrbitalDrift,
    FALLBACK_ART.heroSilentFjord,
  ];
  const fallbackPoster = fallbackPool[idx % fallbackPool.length];

  const releaseDate = String(item.detail?.year ?? item.detail?.recent ?? '').trim();

  return {
    id: hashStringToId(`${mediaType}:${rawId}`, idx),
    dejavuId: rawId,
    mediaType,
    title,
    overview: '',
    posterPath: posterUrl,
    backdropPath: posterUrl,
    fallbackPoster,
    fallbackBackdrop: FALLBACK_ART.heroNeonHorizon,
    releaseDate,
    voteAverage: parseRating(item.detail?.rating),
    genreIds: [],
    popularity: Math.max(10, 100 - idx),
  };
}

function parseDurationMinutes(duration?: string[] | string): number | null {
  if (!duration) return null;
  const joined = Array.isArray(duration) ? duration.join(' ') : duration;
  const match = joined.match(/(\d+)\s*m/i) || joined.match(/\b(\d{2,3})\b/);
  if (!match) return null;
  const mins = Number.parseInt(match[1], 10);
  return Number.isFinite(mins) && mins > 0 ? mins : null;
}

async function fetchListEndpoint(
  routePath: string,
  forcedType?: MediaType
): Promise<MediaItem[]> {
  if (!getBaseUrl()) return [];
  const endpoint = buildRoute(routePath);
  if (!endpoint) return [];

  try {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const json = (await res.json()) as DejavuListResponse;
    if (json.error || !Array.isArray(json.results)) return [];

    return json.results
      .map((item, idx) => mapDejavuListItem(item, idx, forcedType))
      .filter((item): item is MediaItem => Boolean(item));
  } catch {
    return [];
  }
}

export const dejavuApiService = {
  isConfigured(): boolean {
    return Boolean(getBaseUrl());
  },

  getBaseUrl,

  async testConnection(candidateUrl: string): Promise<{ valid: boolean; message: string }> {
    const clean = candidateUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      return {
        valid: false,
        message: 'Enter your Dejavu-API base URL (e.g. https://your-dejavu.vercel.app or http://localhost:3000).',
      };
    }

    try {
      const rootRes = await fetch(`${clean}/`, {
        headers: { Accept: 'application/json' },
      });
      if (rootRes.ok) {
        const text = await rootRes.text();
        if (text.toLowerCase().includes('dejavu') || text.includes('trending-movies')) {
          return {
            valid: true,
            message: 'Connected to Dejavu-API. Trending, Latest, Search & Details endpoints are active.',
          };
        }
      }

      const fallbackRes = await fetch(`${clean}/trending-movies`, {
        headers: { Accept: 'application/json' },
      });
      if (fallbackRes.ok) {
        return {
          valid: true,
          message: 'Connected to Dejavu-API (/trending-movies verified).',
        };
      }

      return {
        valid: false,
        message: `Dejavu-API responded with HTTP ${fallbackRes.status}. Verify the deployment URL and its upstream URL env var.`,
      };
    } catch {
      return {
        valid: false,
        message:
          'Unable to reach Dejavu-API URL. Check that the Express server is running with HTTPS & CORS enabled.',
      };
    }
  },

  async getTrendingMovies(): Promise<MediaItem[]> {
    const path =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.trendingMovies || '/trending-movies';
    return fetchListEndpoint(path, 'movie');
  },

  async getTrendingTvShows(): Promise<MediaItem[]> {
    const path =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.trendingTvShows || '/trending-tv-shows';
    return fetchListEndpoint(path, 'tv');
  },

  async getLatestMovies(): Promise<MediaItem[]> {
    const path =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.latestMovies || '/latest-movies';
    return fetchListEndpoint(path, 'movie');
  },

  async getLatestTvShows(): Promise<MediaItem[]> {
    const path =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.latestTvShows || '/latest-tv-shows';
    return fetchListEndpoint(path, 'tv');
  },

  async getComingSoon(): Promise<MediaItem[]> {
    const path =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.comingSoon || '/comming-soon';
    return fetchListEndpoint(path);
  },

  async search(query: string, page = 1): Promise<MediaItem[]> {
    const clean = query.trim();
    if (!clean || !this.isConfigured()) return [];

    const template =
      window.__KINO_API_CONFIG__?.dejavuApi?.routes?.search || '/search/{query}';
    const endpoint = buildRoute(template, { query: clean });
    const url = new URL(endpoint);
    if (page > 1) {
      url.searchParams.set('page', String(page));
    }

    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as DejavuListResponse;
      if (json.error || !Array.isArray(json.results)) return [];

      return json.results
        .map((item, idx) => mapDejavuListItem(item, idx))
        .filter((item): item is MediaItem => Boolean(item));
    } catch {
      return [];
    }
  },

  async getDetails(
    dejavuId: string,
    mediaType: MediaType,
    seedItem?: MediaItem
  ): Promise<MediaDetails | null> {
    if (!dejavuId || !this.isConfigured()) return null;

    const template =
      mediaType === 'tv'
        ? window.__KINO_API_CONFIG__?.dejavuApi?.routes?.tvDetails || '/details/tv/{id}'
        : window.__KINO_API_CONFIG__?.dejavuApi?.routes?.movieDetails || '/details/movie/{id}';

    const endpoint = buildRoute(template, { id: dejavuId });
    if (!endpoint) return null;

    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const json = (await res.json()) as DejavuDetailsResponse;
      if (json.error || !json.result) return null;

      const r = json.result;
      const meta = r.details || r.detail || {};
      const rawGenres = meta.genere || meta.genre || [];
      const genres: Genre[] = rawGenres
        .filter(Boolean)
        .map((name, idx) => ({ id: 900 + idx, name: name.trim() }));

      const cast: CastMember[] = (meta.casts || [])
        .filter(Boolean)
        .slice(0, 16)
        .map((name, idx) => ({
          id: 7000 + idx,
          name: name.trim(),
          character: 'Cast',
          profilePath: null,
        }));

      const posterUrl = r.img?.trim() || seedItem?.posterPath || null;

      return {
        id: seedItem?.id ?? hashStringToId(`${mediaType}:${dejavuId}`),
        dejavuId,
        mediaType,
        title: r.title?.trim() || seedItem?.title || 'Untitled',
        overview: r.description?.trim() || seedItem?.overview || '',
        posterPath: posterUrl,
        backdropPath: posterUrl,
        fallbackPoster: seedItem?.fallbackPoster || FALLBACK_ART.posterCrimsonVelvet,
        fallbackBackdrop: seedItem?.fallbackBackdrop || FALLBACK_ART.heroNeonHorizon,
        releaseDate: meta.released?.trim() || seedItem?.releaseDate || '',
        voteAverage: seedItem?.voteAverage ?? 7.5,
        genreIds: [],
        runtime: parseDurationMinutes(meta.duration),
        tagline:
          meta.production && meta.production.length > 0
            ? meta.production.slice(0, 2).join(' · ')
            : undefined,
        genres,
        cast,
        similar: [],
        seasons: undefined,
        numberOfSeasons: undefined,
      };
    } catch {
      return null;
    }
  },

  /**
   * Checks if a custom Dejavu-API deployment exposes a working /watch/:id stream route via root capability inspection.
   * Upstream krishnenduroy52/Dejavu-API lists /watch/:id as unimplemented, so unsupported deployments short-circuit cleanly.
   */
  async supportsWatchCapability(): Promise<boolean> {
    const base = getBaseUrl();
    if (!base) return false;
    if (dejavuWatchSupportCache.has(base)) {
      return Boolean(dejavuWatchSupportCache.get(base));
    }
    const configuredRoutes = window.__KINO_API_CONFIG__?.dejavuApi?.routes as
      | Record<string, string | undefined>
      | undefined;
    if (configuredRoutes && Object.prototype.hasOwnProperty.call(configuredRoutes, 'watch') && configuredRoutes.watch) {
      dejavuWatchSupportCache.set(base, true);
      return true;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`${base}/`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        dejavuWatchSupportCache.set(base, false);
        return false;
      }
      const text = await res.text();
      const supported = /["'/]watch(?:\/|\b)/i.test(text);
      dejavuWatchSupportCache.set(base, supported);
      return supported;
    } catch {
      dejavuWatchSupportCache.set(base, false);
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async resolveStreamsForTitle(params: {
    dejavuId?: string;
    title: string;
    mediaType: MediaType;
  }): Promise<StreamResolutionResult> {
    if (!this.isConfigured() || !params.dejavuId) {
      return { sources: [], subtitles: [] };
    }

    const supportsWatch = await this.supportsWatchCapability();
    if (!supportsWatch) {
      return { sources: [], subtitles: [] };
    }

    const endpoint = buildRoute('/watch/{id}', { id: params.dejavuId });
    if (!endpoint) return { sources: [], subtitles: [] };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) return { sources: [], subtitles: [] };
      const data = (await res.json()) as {
        url?: string;
        hls_url?: string;
        sources?: Array<{ url?: string; quality?: string; format?: string; label?: string }>;
        streams?: Array<{ url?: string; quality?: string; format?: string; label?: string }>;
      };

      const sources: StreamSource[] = [];
      const list = data.sources || data.streams || [];
      list.forEach((s, idx) => {
        if (!s.url) return;
        const isHls = s.format === 'hls' || s.url.toLowerCase().includes('.m3u8');
        sources.push({
          id: `dejavu-${params.dejavuId}-${idx}`,
          providerName: 'Dejavu-API',
          label: s.label || `Dejavu Stream · ${s.quality || 'HD'}`,
          quality: s.quality || 'HD',
          url: s.url,
          format: isHls ? 'hls' : 'mp4',
          isDefault: idx === 0,
        });
      });

      const directUrl = data.hls_url || data.url;
      if (directUrl && sources.length === 0) {
        sources.push({
          id: `dejavu-${params.dejavuId}-direct`,
          providerName: 'Dejavu-API',
          label: 'Dejavu Direct Stream',
          quality: 'Auto',
          url: directUrl,
          format: directUrl.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4',
          isDefault: true,
        });
      }

      return { sources, subtitles: [] };
    } catch {
      return { sources: [], subtitles: [] };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};
