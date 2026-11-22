import { Episode, MediaItem, SeasonDetails, StreamSource } from '../types/media';

export interface BengaliCatalogPayload {
  zeeBanglaDaily: MediaItem[];
  bengaliCartoons: MediaItem[];
  updatedAt: number;
}

export interface BengaliEpisodeItem extends Episode {
  fallbackStill?: string;
  videoId?: string;
  dmId?: string;
}

const KNOWN_BENGALI_TITLES_REGEX =
  /\b(gopal\s*bhar|bantul|nonte\s*fonte|hada\s*bhoda|kusum|parineeta|kamala\s*nibas|dulari|tare\s*dhori|saat\s*pake\s*bandha|jowar\s*bhanta|phulki|jagaddhatri|neem\s*phooler|kon\s*gopone|mithai|jamuna\s*dhaki|sohag\s*chand|sashuri\s*boumar|didi\s*no\s*1|zee\s*bangla|sony\s*aath)\b/i;

let catalogCache: { fetchedAt: number; data: BengaliCatalogPayload } | null = null;
const CATALOG_TTL_MS = 3 * 60_000;

export const bengaliSerialService = {
  isBengaliSerialOrCartoon(params: {
    title?: string;
    originalLanguage?: string;
    bengaliSerialSlug?: string;
  }): boolean {
    if (params.bengaliSerialSlug) return true;
    if ((params.originalLanguage || '').toLowerCase() === 'bn') return true;
    if (params.title && KNOWN_BENGALI_TITLES_REGEX.test(params.title)) return true;
    return false;
  },

  async getCatalog(forceRefresh = false): Promise<BengaliCatalogPayload> {
    if (!forceRefresh && catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) {
      return catalogCache.data;
    }
    try {
      const res = await fetch('/api/bengali/catalog');
      if (!res.ok) {
        return { zeeBanglaDaily: [], bengaliCartoons: [], updatedAt: Date.now() };
      }
      const data = (await res.json()) as BengaliCatalogPayload;
      catalogCache = { fetchedAt: Date.now(), data };
      return data;
    } catch {
      return { zeeBanglaDaily: [], bengaliCartoons: [], updatedAt: Date.now() };
    }
  },

  async search(query: string): Promise<MediaItem[]> {
    const clean = query.trim();
    if (!clean) return [];
    try {
      const res = await fetch(`/api/bengali/search?q=${encodeURIComponent(clean)}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { items?: MediaItem[] };
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  },

  async getEpisodes(
    title: string,
    seasonNumber = 1
  ): Promise<SeasonDetails & { episodes: BengaliEpisodeItem[] }> {
    try {
      const res = await fetch(
        `/api/bengali/episodes?title=${encodeURIComponent(title)}&season=${seasonNumber}`
      );
      if (!res.ok) {
        return { seasonNumber, name: 'Daily Episodes', episodes: [] };
      }
      const data = (await res.json()) as SeasonDetails & { episodes?: BengaliEpisodeItem[] };
      return {
        seasonNumber: data.seasonNumber || seasonNumber,
        name: data.name || 'Daily Episodes',
        episodes: Array.isArray(data.episodes) ? data.episodes : [],
      };
    } catch {
      return { seasonNumber, name: 'Daily Episodes', episodes: [] };
    }
  },

  async resolveStreams(params: {
    title: string;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeTitle?: string;
    preferredVideoId?: string;
  }): Promise<StreamSource[]> {
    try {
      const qs = new URLSearchParams({ title: params.title });
      if (params.seasonNumber) qs.set('season', String(params.seasonNumber));
      if (params.episodeNumber) qs.set('episode', String(params.episodeNumber));
      if (params.episodeTitle) qs.set('episodeTitle', params.episodeTitle);
      if (params.preferredVideoId) qs.set('videoId', params.preferredVideoId);

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 14000);
      try {
        const res = await fetch(`/api/bengali/streams?${qs.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { sources?: StreamSource[] };
        return Array.isArray(data.sources) ? data.sources : [];
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      return [];
    }
  },
};
