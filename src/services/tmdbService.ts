import {
  CURATED_MOVIES,
  CURATED_SERIES,
  FALLBACK_ART,
  TMDB_GENRES,
  getCuratedDetails,
  getCuratedSeasonDetails,
} from '../data/curatedCatalog';
import {
  CastMember,
  Genre,
  MediaDetails,
  MediaItem,
  MediaType,
  MultiSearchResults,
  PersonSearchResult,
  SeasonDetails,
} from '../types/media';
import { storageService } from './storageService';

const getBaseUrl = () =>
  window.__KINO_API_CONFIG__?.tmdbBaseUrl || 'https://api.themoviedb.org/3';

const getImageBase = () =>
  window.__KINO_API_CONFIG__?.tmdbImageBase || 'https://image.tmdb.org/t/p';

export function getTmdbImageUrl(
  path: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    // TMDB paths start with '/' like '/abc123.jpg', whereas local bundled assets start with '/src/assets' or '/assets' or 'data:'
    if (path.startsWith('/src/') || path.startsWith('/assets/') || path.startsWith('http')) {
      return path;
    }
    // TMDB CDN returns 404 for .svg files under resized endpoints (like /w500/); SVGs must use /original
    const effectiveSize = path.toLowerCase().endsWith('.svg') ? 'original' : size;
    return `${getImageBase()}/${effectiveSize}${path}`;
  }
  return path;
}

interface TmdbRawMedia {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  genres?: Genre[];
  original_language?: string;
  popularity?: number;
}

function mapRawMedia(raw: TmdbRawMedia, forcedType?: MediaType): MediaItem {
  const mediaType: MediaType =
    forcedType || (raw.media_type === 'tv' ? 'tv' : 'movie');

  const fallbackPool = [
    FALLBACK_ART.posterCrimsonVelvet,
    FALLBACK_ART.posterAlpineApex,
    FALLBACK_ART.heroNeonHorizon,
    FALLBACK_ART.heroOrbitalDrift,
    FALLBACK_ART.heroSilentFjord,
  ];
  const fallbackIdx = Math.abs(raw.id) % fallbackPool.length;

  return {
    id: raw.id,
    mediaType,
    title: raw.title || raw.name || 'Untitled',
    overview: raw.overview || '',
    posterPath: raw.poster_path || null,
    backdropPath: raw.backdrop_path || null,
    releaseDate: raw.release_date || raw.first_air_date || '',
    voteAverage: Number((raw.vote_average || 0).toFixed(1)),
    genreIds: raw.genre_ids || raw.genres?.map((g) => g.id) || [],
    originalLanguage: raw.original_language,
    popularity: raw.popularity,
    sourceTag: 'TMDB',
    fallbackPoster: fallbackPool[fallbackIdx],
    fallbackBackdrop: FALLBACK_ART.heroNeonHorizon,
  };
}

function tagCuratedFallback(items: MediaItem[]): MediaItem[] {
  return items.map((item) => ({ ...item, sourceTag: 'Curated Fallback' }));
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const apiKey = storageService.getTmdbApiKey();
  const isBearerToken = Boolean(apiKey && apiKey.length > 45 && apiKey.includes('.'));

  if (apiKey) {
    try {
      const url = new URL(`${getBaseUrl()}${endpoint}`);
      if (!isBearerToken) {
        url.searchParams.set('api_key', apiKey);
      }
      url.searchParams.set('language', 'en-US');

      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }

      const response = await fetch(url.toString(), {
        headers: isBearerToken
          ? {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            }
          : { Accept: 'application/json' },
      });

      if (response.ok) {
        return response.json() as Promise<T>;
      }
    } catch {
      // Network/ISP block on api.themoviedb.org — fall back to server proxy below
    }
  }

  // Server-side /api/tmdb proxy fallback
  const proxyUrl = new URL(`/api/tmdb${endpoint}`, window.location.origin);
  proxyUrl.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    proxyUrl.searchParams.set(key, String(value));
  }
  if (apiKey && !isBearerToken) {
    proxyUrl.searchParams.set('api_key', apiKey);
  }
  const proxyRes = await fetch(proxyUrl.toString(), {
    headers: isBearerToken && apiKey
      ? { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      : { Accept: 'application/json' },
  });
  if (!proxyRes.ok) {
    throw new Error(apiKey ? `TMDB_HTTP_${proxyRes.status}` : 'TMDB_KEY_MISSING');
  }
  return proxyRes.json() as Promise<T>;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const mediaDetailsCache = new Map<string, { fetchedAt: number; data: MediaDetails }>();
const seasonDetailsCache = new Map<string, { fetchedAt: number; data: SeasonDetails }>();
const imdbIdCache = new Map<string, { fetchedAt: number; data: string | undefined }>();
const mediaLogoCache = new Map<string, { fetchedAt: number; data: string | null }>();

export const tmdbService = {
  hasApiKey(): boolean {
    return Boolean(storageService.getTmdbApiKey());
  },

  async validateApiKey(candidateKey: string): Promise<{ valid: boolean; message: string }> {
    const clean = candidateKey.trim();
    if (!clean) {
      return { valid: false, message: 'Please enter a TMDB v3 API key or Read Access Token.' };
    }
    const isBearer = clean.length > 45 && clean.includes('.');
    const url = new URL(`${getBaseUrl()}/configuration`);
    if (!isBearer) {
      url.searchParams.set('api_key', clean);
    }

    try {
      const res = await fetch(url.toString(), {
        headers: isBearer ? { Authorization: `Bearer ${clean}` } : undefined,
      });
      if (res.ok) {
        return { valid: true, message: 'TMDB connection verified. Live catalog active.' };
      }
      return { valid: false, message: `TMDB rejected the key (HTTP ${res.status}).` };
    } catch {
      return { valid: false, message: 'Network error while reaching api.themoviedb.org.' };
    }
  },

  async getTrendingMovies(): Promise<{ items: MediaItem[]; isLive: boolean }> {
    try {
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/trending/movie/week');
      return {
        items: data.results.map((r) => mapRawMedia(r, 'movie')),
        isLive: true,
      };
    } catch {
      return { items: tagCuratedFallback(CURATED_MOVIES), isLive: false };
    }
  },

  async getPopularTvSeries(): Promise<{ items: MediaItem[]; isLive: boolean }> {
    try {
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/tv/popular');
      return {
        items: data.results.map((r) => mapRawMedia(r, 'tv')),
        isLive: true,
      };
    } catch {
      return { items: tagCuratedFallback(CURATED_SERIES), isLive: false };
    }
  },

  async getTopRated(): Promise<{ items: MediaItem[]; isLive: boolean }> {
    try {
      const [movies, tv] = await Promise.all([
        tmdbFetch<{ results: TmdbRawMedia[] }>('/movie/top_rated'),
        tmdbFetch<{ results: TmdbRawMedia[] }>('/tv/top_rated'),
      ]);
      const combined = [
        ...movies.results.slice(0, 8).map((r) => mapRawMedia(r, 'movie')),
        ...tv.results.slice(0, 8).map((r) => mapRawMedia(r, 'tv')),
      ].sort((a, b) => b.voteAverage - a.voteAverage);
      return { items: combined, isLive: true };
    } catch {
      const sorted = tagCuratedFallback([...CURATED_MOVIES, ...CURATED_SERIES]).sort(
        (a, b) => b.voteAverage - a.voteAverage
      );
      return { items: sorted, isLive: false };
    }
  },

  async getGenres(): Promise<Genre[]> {
    try {
      const [movieGenres, tvGenres] = await Promise.all([
        tmdbFetch<{ genres: Genre[] }>('/genre/movie/list'),
        tmdbFetch<{ genres: Genre[] }>('/genre/tv/list'),
      ]);
      const map = new Map<number, Genre>();
      for (const g of [...movieGenres.genres, ...tvGenres.genres]) {
        map.set(g.id, g);
      }
      return Array.from(map.values()).slice(0, 14);
    } catch {
      return TMDB_GENRES;
    }
  },

  async getByGenre(genreId: number): Promise<MediaItem[]> {
    try {
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
      });
      return data.results.map((r) => mapRawMedia(r, 'movie'));
    } catch {
      return tagCuratedFallback(
        [...CURATED_MOVIES, ...CURATED_SERIES].filter((item) =>
          item.genreIds.includes(genreId)
        )
      );
    }
  },

  async getTrendingToday(): Promise<MediaItem[]> {
    try {
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/trending/all/day');
      const items = data.results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r) => mapRawMedia(r, r.media_type === 'tv' ? 'tv' : 'movie'));
      if (items.length > 0) return items;
    } catch {
      // Fallback to curated catalog
    }
    return tagCuratedFallback([...CURATED_MOVIES.slice(0, 6), ...CURATED_SERIES.slice(0, 6)]);
  },

  async discoverFiltered(options: {
    type: 'all' | 'movie' | 'tv';
    genreId?: number | null;
    year?: string | null;
  }): Promise<MediaItem[]> {
    const { type, genreId, year } = options;
    const baseMovieParams: Record<string, string | number> = {
      sort_by: 'popularity.desc',
    };
    const baseTvParams: Record<string, string | number> = {
      sort_by: 'popularity.desc',
    };

    if (genreId) {
      baseMovieParams.with_genres = genreId;
      baseTvParams.with_genres = genreId;
    }

    if (year) {
      if (year === '2010s') {
        baseMovieParams['primary_release_date.gte'] = '2010-01-01';
        baseMovieParams['primary_release_date.lte'] = '2019-12-31';
        baseTvParams['first_air_date.gte'] = '2010-01-01';
        baseTvParams['first_air_date.lte'] = '2019-12-31';
      } else if (year === '2000s') {
        baseMovieParams['primary_release_date.gte'] = '2000-01-01';
        baseMovieParams['primary_release_date.lte'] = '2009-12-31';
        baseTvParams['first_air_date.gte'] = '2000-01-01';
        baseTvParams['first_air_date.lte'] = '2009-12-31';
      } else if (year === 'Classic') {
        baseMovieParams['primary_release_date.lte'] = '1999-12-31';
        baseTvParams['first_air_date.lte'] = '1999-12-31';
      } else {
        baseMovieParams.primary_release_year = year;
        baseTvParams.first_air_date_year = year;
      }
    }

    try {
      if (type === 'movie') {
        const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/movie', baseMovieParams);
        return data.results.map((r) => mapRawMedia(r, 'movie'));
      }
      if (type === 'tv') {
        const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/tv', baseTvParams);
        return data.results.map((r) => mapRawMedia(r, 'tv'));
      }
      const [moviesData, tvData] = await Promise.all([
        tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/movie', baseMovieParams),
        tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/tv', baseTvParams),
      ]);
      const combined = [
        ...moviesData.results.slice(0, 10).map((r) => mapRawMedia(r, 'movie')),
        ...tvData.results.slice(0, 10).map((r) => mapRawMedia(r, 'tv')),
      ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      return combined;
    } catch {
      return tagCuratedFallback(
        [...CURATED_MOVIES, ...CURATED_SERIES].filter((item) => {
          if (type !== 'all' && item.mediaType !== type) return false;
          if (genreId && !item.genreIds.includes(genreId)) return false;
          if (year) {
            const y = parseInt((item.releaseDate || '').slice(0, 4), 10);
            if (year === '2010s') return y >= 2010 && y <= 2019;
            if (year === '2000s') return y >= 2000 && y <= 2009;
            if (year === 'Classic') return y > 0 && y < 2000;
            return String(y) === year;
          }
          return true;
        })
      );
    }
  },

  async getMoviesByLanguage(languageCode: string, mode: 'original' | 'spoken' = 'original'): Promise<MediaItem[]> {
    try {
      const params: Record<string, string | number> = {
        sort_by: 'popularity.desc',
      };
      if (mode === 'spoken') {
        params.with_spoken_languages = languageCode;
      } else {
        params.with_original_language = languageCode;
      }
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/movie', params);
      return data.results.map((r) => mapRawMedia(r, 'movie'));
    } catch {
      return [];
    }
  },

  async getTvByLanguage(languageCode: string, mode: 'original' | 'spoken' = 'original'): Promise<MediaItem[]> {
    try {
      const params: Record<string, string | number> = {
        sort_by: 'popularity.desc',
      };
      if (mode === 'spoken') {
        params.with_spoken_languages = languageCode;
      } else {
        params.with_original_language = languageCode;
      }
      const data = await tmdbFetch<{ results: TmdbRawMedia[] }>('/discover/tv', params);
      return data.results.map((r) => mapRawMedia(r, 'tv'));
    } catch {
      return [];
    }
  },

  async getMediaDetails(id: number, mediaType: MediaType): Promise<MediaDetails | null> {
    const cacheKey = `${mediaType}:${id}`;
    const cached = mediaDetailsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }
    try {
      const raw = await tmdbFetch<
        TmdbRawMedia & {
          runtime?: number;
          episode_run_time?: number[];
          tagline?: string;
          status?: string;
          number_of_seasons?: number;
          number_of_episodes?: number;
          external_ids?: { imdb_id?: string };
          credits?: {
            cast?: Array<{
              id: number;
              name: string;
              character: string;
              profile_path: string | null;
            }>;
          };
          similar?: { results?: TmdbRawMedia[] };
          seasons?: Array<{
            id: number;
            season_number: number;
            name: string;
            episode_count: number;
            poster_path: string | null;
            air_date?: string;
          }>;
          images?: {
            logos?: Array<{
              file_path: string;
              iso_639_1?: string | null;
              vote_average?: number;
              width?: number;
            }>;
          };
        }
      >(`/${mediaType}/${id}`, {
        append_to_response: 'credits,similar,external_ids,images',
        include_image_language: 'en,hi,bn,ja,ko,fr,es,ta,te,de,it,null',
      });

      const base = mapRawMedia(raw, mediaType);
      const logos = [...(raw.images?.logos || [])].filter((l) => Boolean(l.file_path));
      const origLang = (raw.original_language || '').toLowerCase();
      logos.sort((a, b) => {
        const scoreLogo = (item: (typeof logos)[number]) => {
          let s = 0;
          const lang = (item.iso_639_1 || '').toLowerCase();
          if (lang === 'en') s += 1000;
          else if (origLang && lang === origLang) s += 700;
          else if (lang === 'hi' || lang === 'bn') s += 500;
          else if (!lang) s += 300;
          if (!item.file_path.toLowerCase().endsWith('.svg')) s += 200;
          s += (item.vote_average || 0) * 10;
          if ((item.width || 0) >= 300) s += 15;
          return s;
        };
        return scoreLogo(b) - scoreLogo(a);
      });
      const logoPaths = Array.from(new Set(logos.map((l) => l.file_path))).slice(0, 6);
      const logoPath = logoPaths[0] || null;

      const cast: CastMember[] = (raw.credits?.cast || []).slice(0, 16).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      }));

      const similar: MediaItem[] = (raw.similar?.results || [])
        .slice(0, 12)
        .map((s) => mapRawMedia(s, mediaType));

      const seasons = raw.seasons
        ?.filter((s) => s.season_number > 0)
        .map((s) => ({
          id: s.id,
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          posterPath: s.poster_path,
          airDate: s.air_date,
        }));

      const result: MediaDetails = {
        ...base,
        imdbId: raw.external_ids?.imdb_id,
        logoPath,
        logoPaths,
        runtime:
          raw.runtime ??
          (raw.episode_run_time && raw.episode_run_time.length > 0
            ? raw.episode_run_time[0]
            : null),
        tagline: raw.tagline,
        status: raw.status,
        genres: raw.genres || [],
        cast,
        similar,
        seasons,
        numberOfSeasons: raw.number_of_seasons,
        numberOfEpisodes: raw.number_of_episodes,
      };
      mediaDetailsCache.set(cacheKey, { fetchedAt: Date.now(), data: result });
      return result;
    } catch {
      return getCuratedDetails(id, mediaType);
    }
  },

  async getSeasonDetails(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
    const cacheKey = `${tvId}:${seasonNumber}`;
    const cached = seasonDetailsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }
    try {
      const raw = await tmdbFetch<{
        season_number: number;
        name: string;
        episodes: Array<{
          id: number;
          episode_number: number;
          season_number: number;
          name: string;
          overview: string;
          still_path: string | null;
          air_date: string;
          runtime: number | null;
        }>;
      }>(`/tv/${tvId}/season/${seasonNumber}`);

      const seasonResult: SeasonDetails = {
        seasonNumber: raw.season_number,
        name: raw.name,
        episodes: raw.episodes.map((ep) => ({
          id: ep.id,
          episodeNumber: ep.episode_number,
          seasonNumber: ep.season_number,
          name: ep.name,
          overview: ep.overview || 'Episode synopsis unavailable.',
          stillPath: ep.still_path,
          airDate: ep.air_date || '',
          runtime: ep.runtime,
        })),
      };
      seasonDetailsCache.set(cacheKey, { fetchedAt: Date.now(), data: seasonResult });
      return seasonResult;
    } catch {
      return getCuratedSeasonDetails(tvId, seasonNumber);
    }
  },

  async searchMulti(query: string): Promise<MultiSearchResults> {
    const clean = query.trim();
    if (!clean) {
      return { moviesAndShows: [], people: [], isFallback: false };
    }

    try {
      const data = await tmdbFetch<{
        results: Array<
          TmdbRawMedia & {
            known_for_department?: string;
            profile_path?: string | null;
            known_for?: TmdbRawMedia[];
          }
        >;
      }>('/search/multi', { query: clean, include_adult: 'false' });

      const moviesAndShows: MediaItem[] = [];
      const people: PersonSearchResult[] = [];

      for (const item of data.results) {
        if (item.media_type === 'movie' || item.media_type === 'tv') {
          moviesAndShows.push(mapRawMedia(item, item.media_type));
        } else if (item.media_type === 'person') {
          people.push({
            id: item.id,
            name: item.name || 'Unknown',
            knownForDepartment: item.known_for_department || 'Acting',
            profilePath: item.profile_path || null,
            knownForTitles: (item.known_for || [])
              .map((k) => k.title || k.name || '')
              .filter(Boolean)
              .slice(0, 3),
          });
        }
      }

      return { moviesAndShows, people, isFallback: false };
    } catch {
      const q = clean.toLowerCase();
      const moviesAndShows = tagCuratedFallback(
        [...CURATED_MOVIES, ...CURATED_SERIES].filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            m.overview.toLowerCase().includes(q)
        )
      );
      return { moviesAndShows, people: [], isFallback: true };
    }
  },

  async getMediaVideos(
    id: number,
    mediaType: MediaType
  ): Promise<
    Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
    }>
  > {
    try {
      const data = await tmdbFetch<{
        results?: Array<{
          id: string;
          key: string;
          name: string;
          site: string;
          type: string;
          official: boolean;
        }>;
      }>(`/${mediaType}/${id}/videos`);
      return data.results || [];
    } catch {
      return [];
    }
  },

  async getImdbId(id: number, mediaType: MediaType): Promise<string | undefined> {
    if (!id || (id >= 880001 && id <= 899999)) return undefined;
    const cacheKey = `${mediaType}:${id}`;
    const cached = imdbIdCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data) {
      return cached.data;
    }
    try {
      const data = await tmdbFetch<{
        imdb_id?: string;
        external_ids?: { imdb_id?: string };
      }>(`/${mediaType}/${id}/external_ids`);
      const imdbId = data.imdb_id || data.external_ids?.imdb_id;
      if (imdbId) {
        imdbIdCache.set(cacheKey, { fetchedAt: Date.now(), data: imdbId });
        return imdbId;
      }
    } catch {
      // Fall through to /api/resolve-imdb
    }
    try {
      const res = await fetch(
        `/api/resolve-imdb?tmdbId=${encodeURIComponent(String(id))}&mediaType=${mediaType}`
      );
      if (res.ok) {
        const json = (await res.json()) as { imdbId?: string | null };
        if (json?.imdbId) {
          imdbIdCache.set(cacheKey, { fetchedAt: Date.now(), data: json.imdbId });
          return json.imdbId;
        }
      }
    } catch {
      // Ignore network errors
    }
    return undefined;
  },

  async getMediaLogoCandidates(
    id: number,
    mediaType: MediaType,
    imdbId?: string,
    existingLogoPath?: string | null,
    existingLogoPaths?: string[]
  ): Promise<string[]> {
    const candidates: string[] = [];
    const pushUnique = (url: string | null | undefined) => {
      if (url && !candidates.includes(url)) candidates.push(url);
    };

    const resolveUrl = (pathOrUrl?: string | null): string | null => {
      if (!pathOrUrl) return null;
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
      return getTmdbImageUrl(pathOrUrl, pathOrUrl.toLowerCase().endsWith('.svg') ? 'original' : 'w500');
    };

    pushUnique(resolveUrl(existingLogoPath));
    for (const p of existingLogoPaths || []) {
      pushUnique(resolveUrl(p));
    }

    if (id && !(id >= 880001 && id <= 899999)) {
      const cacheKey = `${mediaType}:${id}:list`;
      const cached = mediaLogoCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data) {
        for (const u of cached.data.split('|').filter(Boolean)) {
          pushUnique(u);
        }
      } else {
        try {
          const data = await tmdbFetch<{
            logos?: Array<{
              file_path?: string;
              iso_639_1?: string | null;
              vote_average?: number;
            }>;
          }>(`/${mediaType}/${id}/images`, {
            include_image_language: 'en,hi,bn,ja,ko,null',
          });
          const rawLogos = (data.logos || []).filter((l) => Boolean(l.file_path));
          const langRank = (iso?: string | null) => {
            if (iso === 'en') return 0;
            if (!iso) return 1;
            if (iso === 'hi') return 2;
            if (iso === 'bn') return 3;
            return 4;
          };
          const sorted = [...rawLogos].sort((a, b) => {
            const diff = langRank(a.iso_639_1) - langRank(b.iso_639_1);
            if (diff !== 0) return diff;
            return (b.vote_average || 0) - (a.vote_average || 0);
          });
          const resolvedUrls = sorted
            .map((l) => resolveUrl(l.file_path))
            .filter((u): u is string => Boolean(u));
          if (resolvedUrls.length > 0) {
            mediaLogoCache.set(cacheKey, {
              fetchedAt: Date.now(),
              data: resolvedUrls.slice(0, 6).join('|'),
            });
            for (const u of resolvedUrls) pushUnique(u);
          }
        } catch {
          // Do not poison cache on transient network errors
        }
      }
    }

    // Fallback to Metahub IMDb clearlogo when TMDB yields nothing or fails
    let resolvedImdb = imdbId;
    if (!resolvedImdb && id && !(id >= 880001 && id <= 899999)) {
      resolvedImdb = await this.getImdbId(id, mediaType);
    }
    if (resolvedImdb) {
      pushUnique(`https://images.metahub.space/logo/medium/${resolvedImdb}/img`);
      pushUnique(`https://live.metahub.space/logo/medium/${resolvedImdb}/img`);
    }

    if (candidates[0] && id) {
      mediaLogoCache.set(`${mediaType}:${id}`, {
        fetchedAt: Date.now(),
        data: candidates[0],
      });
    }

    return candidates;
  },

  async getMediaLogo(id: number, mediaType: MediaType, imdbId?: string): Promise<string | null> {
    if (!id || (id >= 880001 && id <= 899999)) {
      if (imdbId) return `https://images.metahub.space/logo/medium/${imdbId}/img`;
      return null;
    }
    const cacheKey = `${mediaType}:${id}`;
    const cached = mediaLogoCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data) {
      return cached.data;
    }
    const candidates = await this.getMediaLogoCandidates(id, mediaType, imdbId);
    return candidates[0] || null;
  },
};
