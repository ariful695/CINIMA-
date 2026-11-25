import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

const serverRequire = createRequire(import.meta.url);
interface TorrentFileLike {
  name: string;
  length: number;
  offset?: number;
  select: () => void;
  deselect?: () => void;
  createReadStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream;
}
interface TorrentEngineLike {
  files: TorrentFileLike[];
  torrent?: {
    pieceLength: number;
    length: number;
    pieces: unknown[];
  };
  bitfield?: {
    get: (index: number) => boolean;
  };
  selection?: unknown[];
  select?: (from: number, to: number, priority?: number | boolean, notify?: () => void) => void;
  deselect?: (from: number, to: number, priority?: number | boolean, notify?: () => void) => void;
  critical?: (piece: number, width?: number) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  once: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  swarm?: {
    wires?: Array<{ peerChoking?: boolean; peerInterested?: boolean }>;
    downloadSpeed?: () => number;
    downloaded?: number;
  };
  destroy: (cb?: () => void) => void;
}
const torrentStreamFactory = serverRequire('torrent-stream') as (
  magnet: string,
  opts?: { tmp?: string; path?: string; trackers?: string[]; connections?: number }
) => TorrentEngineLike;

const DEFAULT_NUVIO_MANIFEST =
  'https://raw.githubusercontent.com/NuvioPlugin/All-in-One-Nuvio/refs/heads/main/manifest.json';

const CB_PROVIDERS_MANIFEST =
  'https://raw.githubusercontent.com/SA7ANI/cb-providers/main/manifest.json';

const CB_HINDI_SCRAPER_IDS = new Set([
  'netmirror', 'castle', 'moviebox', 'desiflix', 'vegamovies', 'multimovies',
  'moviesdrive', '4khdhub', 'hdhub4u', 'playimdb', 'moviesmod', 'einthusan',
  'toonstream', 'puretoons', 'animeworld', 'animesalt', 'cinecity', 'allmovieland',
  'movieblast', 'streamflix', 'nuvio-vegamovies', 'cinemacity', 'flixindia',
  'hdmovie2', 'movies4u', 'hindmoviez', 'uhdmovies', 'zinkmovies', 'xdmovies',
  'dooflix', 'ctgmovies', 'moonflix', 'peachify', 'gramcinema', 'hdghartv',
  'fibwatch', 'xpass', '1shows', 'toonhub', 'animelok'
]);

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

interface NuvioScraperMeta {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  supportedTypes?: string[];
  filename: string;
  enabled?: boolean;
  formats?: string[];
  logo?: string;
  contentLanguage?: string[];
  _baseUrl?: string;
}

interface NuvioManifest {
  name: string;
  version: string;
  scrapers: NuvioScraperMeta[];
  providers?: NuvioScraperMeta[];
}

interface NuvioRawStream {
  name?: string;
  title?: string;
  description?: string;
  size?: string;
  url?: string;
  quality?: string;
  language?: string;
  headers?: Record<string, string>;
  subtitles?: Array<{
    url?: string;
    file?: string;
    label?: string;
    lang?: string;
    language?: string;
  }>;
  provider?: string;
}

const DEFAULT_TMDB_KEY = '7ba2b8ccdcabf66f03d2c5ed45d4e2e6';

const ANIME_CARTOON_SCRAPER_IDS = new Set([
  'topcartoons',
  'animeworld',
  'animesalt',
  'allanime',
  'animepahe',
  'animedekho',
  'animetsu',
  'hianime',
  'reanime',
  'animekai',
  'animezey',
  'anime-sama',
  'anizone',
  'anidb',
  'vidnest-anime',
  'kurage',
  'anikage',
  'anizen',
  'puretoons',
  'toonstream',
  'allwish',
  'anime',
]);

const ASIAN_DRAMA_SCRAPER_IDS = new Set(['onlykdrama', 'kisskh']);

const TITLE_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'is',
  'are',
  'with',
  'from',
  'by',
  'part',
  'chapter',
  'volume',
  'season',
  'episode',
  'movie',
  'film',
  'hindi',
  'english',
  'bengali',
  'tamil',
  'telugu',
  'malayalam',
  'kannada',
  'hin',
  'eng',
  'ben',
  'tam',
  'tel',
  'mal',
  'kan',
  'dual',
  'audio',
  'multi',
  'dub',
  'dubbed',
  'sub',
  'subbed',
  'esub',
  'esubs',
  '1080p',
  '720p',
  '480p',
  '360p',
  '2160p',
  '4k',
  'uhd',
  'fhd',
  'hd',
  'hq',
  'web',
  'webdl',
  'dl',
  'bluray',
  'brrip',
  'bdrip',
  'dvdrip',
  'hdrip',
  'webrip',
  'cam',
  'hdcam',
  'hdts',
  'remux',
  'repack',
  'proper',
  'extended',
  'unrated',
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'avc',
  'xvid',
  '10bit',
  '8bit',
  'aac',
  'ac3',
  'ddp',
  'ddp5',
  'dts',
  'truehd',
  'atmos',
  'hdr',
  'hdr10',
  'mkv',
  'mp4',
  'avi',
  'hls',
  'm3u8',
  'ost',
  's01e01',
  'nf',
  'amzn',
  'dsnp',
  'hbo',
  'atvp',
  'hulu',
]);

interface TmdbTitleMeta {
  title: string;
  originalTitle: string;
  year: number | null;
  lastAirYear: number | null;
  episodeAirYear: number | null;
  runtimeMinutes: number | null;
  episodeRuntimeMinutes: number | null;
  genreIds: number[];
  originalLanguage: string;
}

const tmdbMetaCache = new Map<string, { fetchedAt: number; data: TmdbTitleMeta | null }>();
const imdbResolveCache = new Map<string, { fetchedAt: number; imdbId?: string }>();
const streamsResultCache = new Map<string, { fetchedAt: number; payload: unknown }>();

async function fetchTmdbTitleMeta(
  tmdbId: string,
  mediaType: 'movie' | 'tv',
  apiKey?: string,
  season?: number,
  episode?: number
): Promise<TmdbTitleMeta | null> {
  const key =
    mediaType === 'tv' && season && episode
      ? `${mediaType}:${tmdbId}:s${season}:e${episode}`
      : `${mediaType}:${tmdbId}`;
  const cached = tmdbMetaCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
    return cached.data;
  }

  const effectiveKey = (apiKey || DEFAULT_TMDB_KEY).trim();
  if (!effectiveKey) return null;

  try {
    const isBearer = effectiveKey.length > 45 && effectiveKey.includes('.');
    const headers: Record<string, string> = isBearer
      ? { Authorization: `Bearer ${effectiveKey}`, Accept: 'application/json' }
      : { Accept: 'application/json' };

    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`);
    if (!isBearer) url.searchParams.set('api_key', effectiveKey);

    const epPromise =
      mediaType === 'tv' && season && episode
        ? (() => {
            const epUrl = new URL(
              `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}`
            );
            if (!isBearer) epUrl.searchParams.set('api_key', effectiveKey);
            return fetch(epUrl.toString(), {
              headers,
              signal: AbortSignal.timeout(3500),
            })
              .then((r) => (r.ok ? (r.json() as Promise<{ runtime?: number; air_date?: string }>) : null))
              .catch(() => null);
          })()
        : Promise.resolve(null);

    const [res, epJson] = await Promise.all([
      fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(4000),
      }),
      epPromise,
    ]);

    if (!res.ok) {
      tmdbMetaCache.set(key, { fetchedAt: Date.now(), data: null });
      return null;
    }
    const json = (await res.json()) as {
      title?: string;
      name?: string;
      original_title?: string;
      original_name?: string;
      release_date?: string;
      first_air_date?: string;
      last_air_date?: string;
      runtime?: number;
      episode_run_time?: number[];
      genres?: Array<{ id: number }>;
      original_language?: string;
    };

    const dateStr = json.release_date || json.first_air_date || '';
    const yearMatch = dateStr.match(/^(\d{4})/);
    const lastAirMatch = (json.last_air_date || '').match(/^(\d{4})/);
    const epAirMatch = (epJson?.air_date || '').match(/^(\d{4})/);
    const baseRuntime =
      typeof json.runtime === 'number' && json.runtime > 0
        ? json.runtime
        : Array.isArray(json.episode_run_time) && json.episode_run_time[0] > 0
        ? json.episode_run_time[0]
        : null;
    const epRuntime =
      typeof epJson?.runtime === 'number' && epJson.runtime > 0 ? epJson.runtime : baseRuntime;

    const meta: TmdbTitleMeta = {
      title: (json.title || json.name || '').trim(),
      originalTitle: (json.original_title || json.original_name || '').trim(),
      year: yearMatch ? Number(yearMatch[1]) : null,
      lastAirYear: lastAirMatch ? Number(lastAirMatch[1]) : null,
      episodeAirYear: epAirMatch ? Number(epAirMatch[1]) : null,
      runtimeMinutes: epRuntime || baseRuntime,
      episodeRuntimeMinutes: epRuntime,
      genreIds: Array.isArray(json.genres) ? json.genres.map((g) => g.id) : [],
      originalLanguage: (json.original_language || '').toLowerCase(),
    };
    tmdbMetaCache.set(key, { fetchedAt: Date.now(), data: meta });
    return meta;
  } catch {
    return null;
  }
}

async function resolveImdbIdServerSide(
  tmdbId: string,
  mediaType: 'movie' | 'tv',
  apiKey?: string,
  fallbackTitle?: string,
  fallbackYear?: number
): Promise<string | undefined> {
  const cleanId = String(tmdbId || '').trim();
  if (!cleanId) return undefined;
  const cacheKey = `${mediaType}:${cleanId}`;
  const cached = imdbResolveCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000 && cached.imdbId) {
    return cached.imdbId;
  }

  const effectiveKey = (apiKey || DEFAULT_TMDB_KEY).trim();
  if (effectiveKey) {
    try {
      const isBearer = effectiveKey.length > 45 && effectiveKey.includes('.');
      const headers: Record<string, string> = isBearer
        ? { Authorization: `Bearer ${effectiveKey}`, Accept: 'application/json' }
        : { Accept: 'application/json' };
      const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${encodeURIComponent(cleanId)}/external_ids`);
      if (!isBearer) url.searchParams.set('api_key', effectiveKey);

      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const json = (await res.json()) as { imdb_id?: string };
        if (json?.imdb_id && /^tt\d+$/i.test(json.imdb_id)) {
          imdbResolveCache.set(cacheKey, { fetchedAt: Date.now(), imdbId: json.imdb_id });
          return json.imdb_id;
        }
      }
    } catch {
      // Continue to Cinemeta fallback
    }
  }

  // Fallback via Stremio Cinemeta catalog search if title is known
  let searchTitle = (fallbackTitle || '').trim();
  let searchYear = fallbackYear;
  if (!searchTitle) {
    const meta = await fetchTmdbTitleMeta(cleanId, mediaType, apiKey);
    if (meta?.title) {
      searchTitle = meta.title;
      if (!searchYear && meta.year) searchYear = meta.year;
    }
  }
  if (searchTitle) {
    try {
      const cinemetaType = mediaType === 'tv' ? 'series' : 'movie';
      const cUrl = `https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(searchTitle)}.json`;
      const cRes = await fetch(cUrl, {
        headers: { 'User-Agent': DEFAULT_UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
      });
      if (cRes.ok) {
        const cJson = (await cRes.json()) as {
          metas?: Array<{ id?: string; imdb_id?: string; name?: string; releaseInfo?: string }>;
        };
        const targetNorm = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = (cJson.metas || []).find((m) => {
          const mId = m.imdb_id || m.id || '';
          if (!/^tt\d+$/i.test(mId)) return false;
          const mNorm = (m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!mNorm) return false;
          const nameMatches = mNorm === targetNorm || mNorm.includes(targetNorm) || targetNorm.includes(mNorm);
          if (!nameMatches) return false;
          if (searchYear && m.releaseInfo) {
            const yr = parseInt(String(m.releaseInfo).slice(0, 4), 10);
            if (Number.isFinite(yr) && Math.abs(yr - searchYear) > 1) return false;
          }
          return true;
        });
        const resolved = match?.imdb_id || match?.id;
        if (resolved && /^tt\d+$/i.test(resolved)) {
          imdbResolveCache.set(cacheKey, { fetchedAt: Date.now(), imdbId: resolved });
          return resolved;
        }
      }
    } catch {
      // Cinemeta fallback failed
    }
  }

  return undefined;
}

function tokenizeTitle(str: string): string[] {
  const normStr = str
    .replace(/(?<=\b[a-zA-Z])\.(?=[a-zA-Z]\b)/g, '')
    .replace(/\b([a-zA-Z])\.(?=\s|$)/g, '$1');
  return normStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 1 && !TITLE_STOP_WORDS.has(w) && !/^\d{4}$/.test(w));
}

function isStreamTitleRelevant(
  rawText: string,
  streamUrl: string,
  meta: TmdbTitleMeta | null,
  scraperId: string,
  mediaType?: 'movie' | 'tv',
  season?: number,
  episode?: number
): boolean {
  // Always reject obvious trailers, samples, teasers, clips, or shorts
  if (/\b(trailer|teaser|sample|promo|preview|clip|sneakpeek|short|featurette|bts)\b/i.test(rawText)) {
    return false;
  }
  if (/\/(trailer|sample|promo|clip|teaser)\b/i.test(streamUrl)) {
    return false;
  }

  // For Hindi original series, reject exclusive foreign audio languages unless dual audio or multi
  if (meta?.originalLanguage === 'hi') {
    const hasForeignOnly = /\b(french|français|japanese|jap|spanish|german|russian|italian|portuguese)\b/i.test(rawText);
    const hasMultiOrHindi = /\b(hindi|bengali|bangla|dual|multi|audio|dub|dubbed)\b/i.test(rawText);
    if (hasForeignOnly && !hasMultiOrHindi) {
      return false;
    }
  }

  // Enforce episode matching on TV series when SxxExx or 1x01 is present in stream label
  let hasMatchingEpisodeTag = false;
  if (mediaType === 'tv' && season && episode) {
    const epMatch =
      rawText.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i) ||
      rawText.match(/\b(\d{1,2})x(\d{2})\b/i) ||
      rawText.match(/\bSeason\s*(\d{1,2})\b[\s,._-]*Episode\s*(\d{1,2})\b/i);
    if (epMatch) {
      const sNum = parseInt(epMatch[1], 10);
      const eNum = parseInt(epMatch[2], 10);
      if (sNum !== season || eNum !== episode) {
        return false;
      }
      hasMatchingEpisodeTag = true;
    }
  }

  if (!meta || !meta.title) return true;

  // Check if a filename/url leaks an obviously wrong title (like SpongeBob for Fight Club)
  let urlSlug = '';
  try {
    const parsedUrl = new URL(streamUrl);
    const seg = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
    // Only inspect meaningful filenames (not opaque hashes)
    if (seg.includes('-') || seg.includes('_') || /\.[a-z0-9]{2,4}$/i.test(seg)) {
      urlSlug = seg.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_.]+/g, ' ');
    }
  } catch {
    // Ignore URL parsing errors
  }

  const expectedTokens = Array.from(
    new Set([...tokenizeTitle(meta.title), ...tokenizeTitle(meta.originalTitle)])
  );

  // If scraper gave an explicit title (not generic like "TopCartoons" or "HD Stream")
  const combinedCandidate = `${rawText} ${urlSlug}`.trim();
  const candidateTokens = tokenizeTitle(combinedCandidate);

  // Reject if a release year in stream title or filename mismatches movie year or TV series span
  if (meta.year && combinedCandidate) {
    const yearMatches = Array.from(combinedCandidate.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) =>
      Number(m[1])
    );
    if (yearMatches.length > 0) {
      if (mediaType === 'tv') {
        const minYear = meta.year - 1;
        const maxYear = (meta.lastAirYear || meta.episodeAirYear || meta.year) + 1;
        const withinSeriesSpan = yearMatches.some((y) => y >= minYear && y <= maxYear);
        if (!withinSeriesSpan) {
          return false;
        }
        // If no episode tag and an explicit movie-remake year (e.g. 2023 on S01 aired in 2014) appears, reject
        if (!hasMatchingEpisodeTag && meta.episodeAirYear) {
          const matchesEpOrStart = yearMatches.some(
            (y) => Math.abs(y - meta.episodeAirYear!) <= 1 || Math.abs(y - meta.year!) <= 1
          );
          if (!matchesEpOrStart) {
            return false;
          }
        }
      } else if (!yearMatches.some((y) => Math.abs(y - meta.year!) <= 1)) {
        return false;
      }
    }
  }

  // If candidate includes a multi-word descriptive title/filename, verify strong overlap
  if (expectedTokens.length > 0 && candidateTokens.length >= 1) {
    const genericPrefixes = new Set([
      scraperId.toLowerCase(),
      'vidrock',
      'castle',
      'netmirror',
      'desiflix',
      'moviebox',
      'hdhub4u',
      '4khdhub',
      'vegamovies',
      'moviesdrive',
      'moviesmod',
      'purstream',
      'movix',
      'torrentio',
      'stream',
      'server',
      'direct',
      'mirror',
      'watch',
      'master',
      'index',
      'video',
      'playlist',
      'shared',
      'vip',
      'fast',
      'proxy',
      'cloud',
      'link',
      'play',
      'cdn',
    ]);
    const meaningfulCandidate = candidateTokens.filter(
      (t) => !genericPrefixes.has(t) && !/^\d{3,4}p?$/.test(t) && !/^s\d{1,2}e\d{1,2}$/i.test(t)
    );
    if (meaningfulCandidate.length >= 2) {
      const primaryExpected = tokenizeTitle(meta.title);
      const primaryList = primaryExpected.length > 0 ? primaryExpected : expectedTokens;
      const matchedPrimary = primaryList.filter((et) =>
        meaningfulCandidate.some((ct) => ct === et || ct.includes(et) || et.includes(ct))
      ).length;
      const matchedAny = expectedTokens.filter((et) =>
        meaningfulCandidate.some((ct) => ct === et || ct.includes(et) || et.includes(ct))
      ).length;

      // Require >= 1 token to match for high flexibility with transliterated or shorthand titles
      const minRequired = 1;
      if (matchedPrimary < minRequired && matchedAny < minRequired) {
        return false;
      }
    }
  }

  return true;
}

const SCRAPER_MATCH_GENERIC_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from',
  'season', 'series', 'complete', 'edition', 'version', 'extended', 'unrated', 'cut',
  'hindi', 'english', 'bengali', 'tamil', 'telugu', 'malayalam', 'kannada', 'dub', 'dubbed',
  'sub', 'subbed', 'dual', 'audio', 'multi', 'hd', 'fhd', 'uhd', '4k', 'shared', 'special',
  'full', 'movie', 'movies', 'film', 'films', 'new', 'all', 'episodes', 'episode', 'ep',
  'web', 'webdl', 'webrip', 'hdrip', 'bluray', '1080p', '720p', 'official', 'dubbing', 'hq',
  'anime', 'cartoon',
]);

function isStrictScraperMatchedTitle(
  matchedTitleRaw: string,
  meta: TmdbTitleMeta | null,
  mediaType?: 'movie' | 'tv'
): boolean {
  if (!matchedTitleRaw || !meta || !meta.title) return true;
  const cleaned = matchedTitleRaw
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\bS\d{1,2}\s*E\d{1,2}\b/gi, ' ')
    .replace(/\bS\d{1,2}\b/gi, ' ')
    .replace(/\bSeason\s*\d{1,2}\b/gi, ' ')
    .replace(/\bEpisode\s*\d{1,3}\b/gi, ' ')
    .trim();
  if (!cleaned) return true;

  // Reject year mismatches (e.g. 2025 sequel/remake for 2006 series)
  const years = Array.from(matchedTitleRaw.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) =>
    Number(m[1])
  );
  if (meta.year && years.length > 0) {
    if (mediaType === 'tv') {
      const minYear = meta.year - 1;
      const maxYear = (meta.lastAirYear || meta.episodeAirYear || meta.year) + 1;
      if (!years.some((y) => y >= minYear && y <= maxYear)) {
        return false;
      }
    } else if (!years.some((y) => Math.abs(y - meta.year!) <= 1)) {
      return false;
    }
  }

  const normalizeStrict = (str: string): string[] =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 1 && !SCRAPER_MATCH_GENERIC_WORDS.has(w) && !/^\d{4}$/.test(w));

  const candTokens = normalizeStrict(cleaned);
  const primaryTokens = normalizeStrict(meta.title);
  const originalTokens = normalizeStrict(meta.originalTitle);
  const references = [primaryTokens, originalTokens].filter((arr) => arr.length > 0);
  if (references.length === 0 || candTokens.length === 0) return true;

  // Matched title must contain expected tokens AND must not introduce unexpected spin-off/sequel tokens
  // (e.g., "Dexter: Resurrection" when searching "Dexter", or "Pokémon: The Movie 2000" for "The Mentalist")
  return references.some((refTokens) => {
    const matchedFromRef = refTokens.filter((rt) =>
      candTokens.some((ct) => ct === rt || (rt.length >= 4 && ct.includes(rt)))
    ).length;
    const minNeeded = refTokens.length >= 3 ? Math.ceil(refTokens.length * 0.75) : refTokens.length;
    if (matchedFromRef < minNeeded) return false;

    const extraTokens = candTokens.filter(
      (ct) => !refTokens.some((rt) => ct === rt || (rt.length >= 4 && ct.includes(rt)))
    );
    return extraTokens.length === 0;
  });
}

const manifestCache = new Map<string, { fetchedAt: number; data: NuvioManifest }>();
const scriptCache = new Map<string, { fetchedAt: number; code: string }>();

const nodeRequire = createRequire(import.meta.url);

const createAxiosShim = (
  defaults: { baseURL?: string; headers?: Record<string, string> } = {}
) => {
  const requestFn = async (
    configOrUrl: string | Record<string, unknown>,
    maybeConfig?: Record<string, unknown>
  ) => {
    const cfg =
      typeof configOrUrl === 'string'
        ? { url: configOrUrl, ...(maybeConfig || {}) }
        : configOrUrl || {};
    const method = String(cfg.method || 'GET').toUpperCase();
    let targetUrl = String(cfg.url || '');
    if (defaults.baseURL && targetUrl && !/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `${defaults.baseURL.replace(/\/+$/, '')}/${targetUrl.replace(/^\/+/, '')}`;
    }
    if (cfg.params && typeof cfg.params === 'object') {
      const u = new URL(targetUrl);
      for (const [k, v] of Object.entries(cfg.params as Record<string, unknown>)) {
        if (v !== undefined && v !== null) {
          u.searchParams.set(k, String(v));
        }
      }
      targetUrl = u.toString();
    }
    const hdrs: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      ...(defaults.headers || {}),
      ...((cfg.headers as Record<string, string>) || {}),
    };
    const timeoutMs =
      typeof cfg.timeout === 'number' && cfg.timeout > 0 ? Math.min(cfg.timeout, 8000) : 5500;
    const bodyData =
      cfg.data !== undefined
        ? typeof cfg.data === 'string'
          ? cfg.data
          : JSON.stringify(cfg.data)
        : undefined;
    if (bodyData && !Object.keys(hdrs).some((k) => k.toLowerCase() === 'content-type')) {
      hdrs['Content-Type'] = 'application/json';
    }
    const res = await fetch(targetUrl, {
      method,
      headers: hdrs,
      body: method !== 'GET' && method !== 'HEAD' ? bodyData : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data: unknown = text;
    if (cfg.responseType !== 'text') {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    if (!res.ok) {
      const err = new Error(`Request failed with status code ${res.status}`) as Error & {
        response?: unknown;
      };
      err.response = { status: res.status, data, headers: resHeaders };
      throw err;
    }
    return { data, status: res.status, headers: resHeaders };
  };

  return Object.assign(
    (configOrUrl: string | Record<string, unknown>, maybeConfig?: Record<string, unknown>) =>
      requestFn(configOrUrl, maybeConfig),
    {
      request: requestFn,
      get: (url: string, cfg?: Record<string, unknown>) =>
        requestFn({ ...(cfg || {}), url, method: 'GET' }),
      post: (url: string, data?: unknown, cfg?: Record<string, unknown>) =>
        requestFn({ ...(cfg || {}), url, data, method: 'POST' }),
      head: (url: string, cfg?: Record<string, unknown>) =>
        requestFn({ ...(cfg || {}), url, method: 'HEAD' }),
      create: (subDefaults?: { baseURL?: string; headers?: Record<string, string> }) =>
        createAxiosShim({
          baseURL: subDefaults?.baseURL || defaults.baseURL,
          headers: { ...(defaults.headers || {}), ...(subDefaults?.headers || {}) },
        }),
      defaults: { headers: { common: {} } },
    }
  );
};

const axiosShim = createAxiosShim();

const customRequire = (modName: string) => {
  const cleanName = modName.replace(/^node:/, '');
  if (cleanName === 'cheerio-without-node-native' || cleanName === 'cheerio') {
    return cheerio;
  }
  if (cleanName === 'crypto-js') {
    return CryptoJS;
  }
  if (cleanName === 'node-fetch' || cleanName === 'cross-fetch') {
    return fetch;
  }
  if (cleanName === 'axios') {
    return axiosShim;
  }
  if (cleanName === 'url') {
    return { URL, URLSearchParams };
  }
  return nodeRequire(modName);
};

async function fetchNuvioManifest(manifestUrl: string, forceRefresh = false): Promise<NuvioManifest> {
  if (!forceRefresh) {
    const cached = manifestCache.get(manifestUrl);
    if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
      return cached.data;
    }
  }
  const res = await fetch(manifestUrl, {
    headers: { 'User-Agent': DEFAULT_UA, 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Nuvio manifest: HTTP ${res.status}`);
  }
  const rawText = (await res.text()).replace(/^\uFEFF/, '').trim();
  const rawData = JSON.parse(rawText) as Partial<NuvioManifest>;
  const list = Array.isArray(rawData?.scrapers)
    ? rawData.scrapers
    : Array.isArray(rawData?.providers)
    ? rawData.providers
    : null;
  if (!rawData || !list) {
    throw new Error('Invalid Nuvio manifest format');
  }
  const normalized: NuvioManifest = {
    name: rawData.name || 'Nuvio Providers',
    version: rawData.version || '1.0.0',
    scrapers: list,
  };
  manifestCache.set(manifestUrl, { fetchedAt: Date.now(), data: normalized });
  return normalized;
}

async function fetchScraperCode(scriptUrl: string, timeoutMs = 8500, maxAttempts = 2): Promise<string> {
  const cached = scriptCache.get(scriptUrl);
  if (cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000) {
    return cached.code;
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch(scriptUrl, {
        headers: { 'User-Agent': DEFAULT_UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`Failed to load scraper script: HTTP ${res.status}`);
      }
      const code = await res.text();
      scriptCache.set(scriptUrl, { fetchedAt: Date.now(), code });
      return code;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to load scraper script');
}

function compileScraperModule(code: string, onLog?: (msg: string) => void) {
  const cleanCode = code.replace(/^#![^\r\n]*\r?\n/, '');
  const mod: { exports: Record<string, unknown> } = { exports: {} };

  // Ensure global CryptoJS and cheerio are available to scrapers referencing them as free identifiers
  (globalThis as unknown as Record<string, unknown>).CryptoJS = CryptoJS;
  (globalThis as unknown as Record<string, unknown>).cheerio = cheerio;

  const formatLogArgs = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  const silentConsole = {
    log: (...args: unknown[]) => {
      if (onLog) onLog(formatLogArgs(args));
    },
    warn: (...args: unknown[]) => {
      if (onLog) onLog(formatLogArgs(args));
    },
    error: () => {},
    info: (...args: unknown[]) => {
      if (onLog) onLog(formatLogArgs(args));
    },
    debug: () => {},
  };
  const wrappedFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
    fetch(input, {
      ...init,
      signal: init.signal || AbortSignal.timeout(5500),
    });

  const shimProcess = { env: {} as Record<string, string> };
  const shimGlobal: Record<string, unknown> = {
    CryptoJS,
    cheerio,
    fetch: wrappedFetch,
    URL,
    URLSearchParams,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    Headers,
    Request,
    Response,
    FormData,
    atob,
    btoa,
    TextEncoder,
    TextDecoder,
    crypto: globalThis.crypto,
    process: shimProcess,
  };

  // Pass CommonJS + environment root identifiers + CryptoJS as formal parameters
  const fn = new Function(
    'module',
    'exports',
    'require',
    'console',
    'window',
    'self',
    'global',
    'process',
    'CryptoJS',
    cleanCode
  );

  fn(
    mod,
    mod.exports,
    customRequire,
    silentConsole,
    shimGlobal,
    shimGlobal,
    shimGlobal,
    shimProcess,
    CryptoJS
  );

  return mod.exports;
}

function encodeHeadersParam(headers?: Record<string, string>): string {
  if (!headers || Object.keys(headers).length === 0) return '';
  return Buffer.from(JSON.stringify(headers), 'utf8').toString('base64url');
}

function decodeHeadersParam(hParam?: string): Record<string, string> {
  if (!hParam) return {};
  try {
    const json = Buffer.from(hParam, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildProxyUrl(
  targetUrl: string,
  headers?: Record<string, string>,
  options?: { remux?: boolean; hevc?: boolean; lang?: string; audioLang?: string }
): string {
  const h = encodeHeadersParam(headers);
  let url = `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`;
  if (h) url += `&h=${encodeURIComponent(h)}`;
  if (options?.remux) url += '&remux=1';
  if (options?.hevc) url += '&hevc=1';
  if (options?.lang) url += `&lang=${encodeURIComponent(options.lang)}`;
  if (options?.audioLang) url += `&audioLang=${encodeURIComponent(options.audioLang)}`;
  return url;
}

const LANG_CODE_MAP: Record<string, string> = {
  en: 'English',
  eng: 'English',
  hi: 'Hindi',
  hin: 'Hindi',
  fr: 'French',
  fre: 'French',
  fra: 'French',
  ja: 'Japanese',
  jpn: 'Japanese',
  jap: 'Japanese',
  ko: 'Korean',
  kor: 'Korean',
  ta: 'Tamil',
  tam: 'Tamil',
  te: 'Telugu',
  tel: 'Telugu',
  ml: 'Malayalam',
  mal: 'Malayalam',
  kn: 'Kannada',
  kan: 'Kannada',
  mr: 'Marathi',
  mar: 'Marathi',
  pa: 'Punjabi',
  pan: 'Punjabi',
  es: 'Spanish',
  esp: 'Spanish',
  spa: 'Spanish',
  it: 'Italian',
  ita: 'Italian',
  pt: 'Portuguese',
  por: 'Portuguese',
  de: 'German',
  ger: 'German',
  deu: 'German',
  ru: 'Russian',
  rus: 'Russian',
  uk: 'Ukrainian',
  ukr: 'Ukrainian',
  ar: 'Arabic',
  ara: 'Arabic',
  bn: 'Bengali',
  ben: 'Bengali',
  ba: 'Bengali',
  pe: 'Persian',
  fa: 'Persian',
  per: 'Persian',
  fas: 'Persian',
  th: 'Thai',
  tha: 'Thai',
  tr: 'Turkish',
  tur: 'Turkish',
  id: 'Indonesian',
  ind: 'Indonesian',
  ch: 'Chinese',
  zh: 'Chinese',
  chi: 'Chinese',
  zho: 'Chinese',
};

function normalizeSingleLangToken(rawTag?: string): string {
  const val = (rawTag || '').trim();
  if (!val) return '';
  const lower = val.toLowerCase();
  if (LANG_CODE_MAP[lower]) return LANG_CODE_MAP[lower];
  if (/\b(hindi|hin)\b/i.test(lower)) return 'Hindi';
  if (/\b(bengali|bangla|ben)\b/i.test(lower)) return 'Bengali';
  if (/\b(tamil|tam)\b/i.test(lower)) return 'Tamil';
  if (/\b(telugu|tel)\b/i.test(lower)) return 'Telugu';
  if (/\b(malayalam|mal)\b/i.test(lower)) return 'Malayalam';
  if (/\b(kannada|kan)\b/i.test(lower)) return 'Kannada';
  if (/\b(marathi|mar)\b/i.test(lower)) return 'Marathi';
  if (/\b(punjabi|pan)\b/i.test(lower)) return 'Punjabi';
  if (/\b(english|eng)\b/i.test(lower)) return 'English';
  if (/\b(french|français|francais|fre|fra)\b/i.test(lower)) return 'French';
  if (/\b(japanese|jpn|jap)\b/i.test(lower)) return 'Japanese';
  if (/\b(korean|kor)\b/i.test(lower)) return 'Korean';
  if (/\b(spanish|español|espanol|esp|spa|latino|castellano)\b/i.test(lower)) return 'Spanish';
  if (/\b(italian|italiano|ita)\b/i.test(lower)) return 'Italian';
  if (/\b(portuguese|português|por|dublado)\b/i.test(lower)) return 'Portuguese';
  if (/\b(german|deutsch|ger|deu)\b/i.test(lower)) return 'German';
  if (/\b(russian|rus)\b/i.test(lower)) return 'Russian';
  if (/\b(ukrainian|ukr)\b/i.test(lower)) return 'Ukrainian';
  if (/\b(arabic|ara)\b/i.test(lower)) return 'Arabic';
  if (/\b(persian|farsi|per|fas)\b/i.test(lower)) return 'Persian';
  if (/\b(turkish|tur)\b/i.test(lower)) return 'Turkish';
  if (/\b(indonesian|ind)\b/i.test(lower)) return 'Indonesian';
  if (/\b(thai|tha)\b/i.test(lower)) return 'Thai';
  if (/\b(chinese|mandarin|cantonese|chi|zho)\b/i.test(lower)) return 'Chinese';
  return '';
}

function detectAllLanguagesInText(text: string): string[] {
  const found: string[] = [];
  const add = (lang: string) => {
    if (lang && !found.includes(lang)) found.push(lang);
  };

  if (/\b(hindi|hin|hi|bolly|bollywood|hindustani)\b|\[hin(?:di)?\]|\(hin(?:di)?\)|hin[\s._+-]+eng|eng[\s._+-]+hin|🇮🇳/i.test(text)) add('Hindi');
  if (/\b(bengali|bangla|ben)\b|🇧🇩/i.test(text)) add('Bengali');
  if (/\b(tamil|tam)\b/i.test(text)) add('Tamil');
  if (/\b(telugu|tel)\b/i.test(text)) add('Telugu');
  if (/\b(malayalam|mal)\b/i.test(text)) add('Malayalam');
  if (/\b(kannada|kan)\b/i.test(text)) add('Kannada');
  if (/\b(marathi|mar)\b/i.test(text)) add('Marathi');
  if (/\b(punjabi|pan)\b/i.test(text)) add('Punjabi');
  if (/\b(english|eng)\b|🇬🇧|🇺🇸/i.test(text)) add('English');
  if (/\b(truefrench|french|français|francais|vostfr|vf)\b|🇫🇷/i.test(text)) add('French');
  if (/\b(japanese|jpn|jap)\b|🇯🇵/i.test(text)) add('Japanese');
  if (/\b(korean|kor)\b|🇰🇷/i.test(text)) add('Korean');
  if (/\b(spanish|esp|latino|castellano)\b|🇪🇸|🇲🇽/i.test(text)) add('Spanish');
  if (/\b(italian|ita)\b|🇮🇹/i.test(text)) add('Italian');
  if (/\b(portuguese|pt-br|dublado)\b|🇵🇹|🇧🇷/i.test(text)) add('Portuguese');
  if (/\b(german|deutsch)\b|🇩🇪/i.test(text)) add('German');
  if (/\b(russian|rus)\b|🇷🇺/i.test(text)) add('Russian');
  if (/\b(ukrainian|ukr)\b|🇺🇦/i.test(text)) add('Ukrainian');
  if (/\b(arabic|ara)\b|🇸🇦/i.test(text)) add('Arabic');
  if (/\b(persian|farsi)\b|🇮🇷/i.test(text)) add('Persian');
  if (/\b(thai)\b|🇹🇭/i.test(text)) add('Thai');
  if (/\b(turkish|tur)\b|🇹🇷/i.test(text)) add('Turkish');
  if (/\b(indonesian|indo)\b|🇮🇩/i.test(text)) add('Indonesian');
  if (/\b(chinese|mandarin|cantonese)\b|🇨🇳/i.test(text)) add('Chinese');
  // Fallback for standalone Indian flag when no regional word already matched
  if (found.length === 0 && /🇮🇳/.test(text)) add('Hindi');

  return found;
}

function extractAudioLanguages(raw: NuvioRawStream & { _serverKey?: string }, scraper: NuvioScraperMeta): string[] {
  const rawNameTitle = [raw.name, raw.title, raw.description].filter(Boolean).join(' ');
  const scraperNameLower = scraper.name.toLowerCase();
  const scraperIdLower = scraper.id.toLowerCase();

  // cb-providers' vidrock.js injects "🌐 🇮🇳 Hindi Dub" via formatCholeCard even when upstream VidRock streams are English/untagged.
  const isVidrock = scraperIdLower.includes('vidrock') || raw.provider === 'vidrock' || Boolean(raw._serverKey);
  const sanitizedRawText = isVidrock
    ? [
        raw.language || '',
        rawNameTitle
          .replace(/🌐\s*🇮🇳\s*Hindi\s*Dub/gi, '')
          .replace(/🇮🇳\s*Hindi\s*Dub/gi, '')
          .replace(/💎.*$/, ''),
      ]
        .filter(Boolean)
        .join(' ')
    : [raw.language, raw.name, raw.title, raw.description].filter(Boolean).join(' ');

  const lower = sanitizedRawText.toLowerCase();
  const hasMultiHint = /\bdual[\s_-]?audio\b|\bmulti[\s_-]?(audio|lang|language)?\b/i.test(sanitizedRawText);
  const detected = detectAllLanguagesInText(sanitizedRawText);

  // French scrapers often contain separate French & English tracks (e.g. Movix VF / Purstream master.m3u8)
  const isFrenchScraper = /\bvf\b|purstream|nakios|anime-sama/.test(scraperNameLower);
  if (isFrenchScraper && !detected.includes('Hindi') && !detected.includes('Bengali')) {
    if (/\bdual\b/i.test(sanitizedRawText) || (detected.includes('English') && detected.includes('French'))) {
      return ['French', 'English'];
    }
    if (detected.length > 0) return detected;
    return ['French'];
  }

  if (detected.length > 0) {
    return detected;
  }

  // Anime SUB vs DUB tags
  if (/\(\s*dub\s*\)|\bdubbed\b/i.test(lower)) return ['English'];
  if (/\(\s*sub\s*\)|\bsubbed\b/i.test(lower)) return ['Japanese'];

  // Explicit raw.language code if present
  if (raw.language) {
    const mapped = normalizeSingleLangToken(raw.language);
    if (mapped) return [mapped];
    return [raw.language.trim()];
  }

  // Scraper-level language inference (only when strictly Hindi-only; never blindly force Hindi on multi-language scrapers)
  const STRICT_HINDI_SCRAPERS = /desiflix|desicinemas|hindmoviez|bollywood|onlinemovieshindi|desiserials/i;
  if (
    !isVidrock &&
    (STRICT_HINDI_SCRAPERS.test(scraperNameLower) || STRICT_HINDI_SCRAPERS.test(scraperIdLower))
  ) {
    return hasMultiHint ? ['Hindi', 'English'] : ['Hindi'];
  }

  const langs = (scraper.contentLanguage || []).map((c) => c.toLowerCase());
  if (langs.length === 1 && LANG_CODE_MAP[langs[0]]) {
    return [LANG_CODE_MAP[langs[0]]];
  }
  if (!isVidrock && langs.length === 1 && (langs.includes('hi') || langs.includes('hin'))) {
    return hasMultiHint ? ['Hindi', 'English'] : ['Hindi'];
  }
  if (langs.length === 1 && (langs.includes('bn') || langs.includes('ba'))) {
    return ['Bengali'];
  }
  if (hasMultiHint) {
    return ['Original'];
  }
  if (langs.length > 0 && !langs.includes('hi') && !langs.includes('hin') && langs.includes('en')) {
    return ['English'];
  }

  return ['Original'];
}

function extractQuality(text: string): string {
  if (!text) return 'HD';
  const upper = text.toUpperCase();
  if (upper.includes('4K') || upper.includes('2160P') || upper.includes('UHD')) return '4K UHD';
  if (upper.includes('1080P') || upper.includes('FHD')) return '1080p FHD';
  if (upper.includes('720P')) return '720p HD';
  if (upper.includes('480P')) return '480p';
  if (upper.includes('360P')) return '360p';
  return 'HD';
}

function rewriteM3u8Playlist(playlistText: string, baseUrl: string, hParam: string): string {
  const lines = playlistText.split(/\r?\n/);
  const hQuery = hParam ? `&h=${encodeURIComponent(hParam)}` : '';

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." inside HLS tags (#EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.)
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/gi, (_match, rawUri: string) => {
          try {
            const abs = new URL(rawUri, baseUrl).toString();
            return `URI="/api/stream-proxy?url=${encodeURIComponent(abs)}${hQuery}"`;
          } catch {
            return `URI="${rawUri}"`;
          }
        });
      }

      // Rewrite segment or sub-playlist URL line (tag non-m3u8 media segments with &seg=1 for proper video/mp2t MIME, skip subtitles/keys)
      try {
        const abs = new URL(trimmed, baseUrl).toString();
        const cleanPath = abs.split('?')[0].toLowerCase();
        const isNonMediaSeg =
          cleanPath.endsWith('.m3u8') ||
          cleanPath.endsWith('.vtt') ||
          cleanPath.endsWith('.srt') ||
          cleanPath.endsWith('.webvtt') ||
          cleanPath.endsWith('.key');
        const segPart = isNonMediaSeg ? '' : '&seg=1';
        return `/api/stream-proxy?url=${encodeURIComponent(abs)}${hQuery}${segPart}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

const DEFAULT_TORRENT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'http://tracker.opentrackr.org:1337/announce',
  'https://tracker.tamersunion.org:443/announce',
  'https://tracker.gbitt.info:443/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'http://tracker.qu.ax:6969/announce',
  'http://tracker.dler.org:6969/announce',
];

const TORRENT_TMP_ROOT = '/tmp/kinostream-torrents';

interface PreparedTorrentFileState {
  fileIdx: number;
  fileName: string;
  fileLength: number;
  fileOffset: number;
  pieceLength: number;
  fileStartPiece: number;
  fileEndPiece: number;
  headEndPiece: number;
  tailStartPiece: number;
  preEndPiece: number;
  prebufferMb: number;
  targetBytes: number;
  activeSeekWindow?: { from: number; to: number };
}

interface ActiveTorrentEntry {
  infoHash: string;
  engine: TorrentEngineLike;
  ready: boolean;
  readyPromise?: Promise<TorrentEngineLike>;
  lastUsedAt: number;
  activeStreams: number;
  dirPath: string;
  preparedFiles: Map<number, PreparedTorrentFileState>;
}
const activeTorrents = new Map<string, ActiveTorrentEntry>();

function destroyTorrentEntry(hash: string) {
  const entry = activeTorrents.get(hash);
  if (!entry || entry.activeStreams > 0) return;
  activeTorrents.delete(hash);
  entry.preparedFiles.clear();

  const cleanupDir = () => {
    try {
      fs.rmSync(entry.dirPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failure
    }
  };

  try {
    (entry.engine as unknown as { removeAllListeners?: () => void }).removeAllListeners?.();
    const fallbackCleanup = setTimeout(cleanupDir, 1500);
    fallbackCleanup.unref?.();
    entry.engine.destroy(() => {
      clearTimeout(fallbackCleanup);
      cleanupDir();
    });
  } catch {
    cleanupDir();
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [hash, entry] of activeTorrents.entries()) {
    if (entry.activeStreams <= 0 && now - entry.lastUsedAt > 3 * 60 * 1000) {
      destroyTorrentEntry(hash);
    }
  }
}, 45000).unref();

async function getReadyTorrentEntry(infoHash: string, extraTrackers: string[]): Promise<ActiveTorrentEntry> {
  const hash = infoHash.toLowerCase().trim();
  const existing = activeTorrents.get(hash);
  if (existing) {
    existing.lastUsedAt = Date.now();
    if (existing.ready) return existing;
    if (existing.readyPromise) {
      await existing.readyPromise;
      return existing;
    }
  }

  // Keep max 5 active torrents so /tmp disk usage stays controlled while protecting in-flight streams
  while (activeTorrents.size >= 5) {
    const oldest = Array.from(activeTorrents.values())
      .filter((e) => e.activeStreams <= 0)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
    if (oldest) destroyTorrentEntry(oldest.infoHash);
    else break;
  }

  const dirPath = path.join(TORRENT_TMP_ROOT, hash);
  fs.mkdirSync(dirPath, { recursive: true });

  const trackers = Array.from(new Set([...extraTrackers, ...DEFAULT_TORRENT_TRACKERS])).slice(0, 16);
  const magnet =
    `magnet:?xt=urn:btih:${hash}&` +
    trackers.map((t) => `tr=${encodeURIComponent(t)}`).join('&');

  const engine = torrentStreamFactory(magnet, {
    tmp: TORRENT_TMP_ROOT,
    path: dirPath,
    trackers,
    connections: 60,
  });

  engine.on('error', () => {
    // Prevent unhandled peer/tracker socket errors from crashing Express
  });

  const entry: ActiveTorrentEntry = {
    infoHash: hash,
    engine,
    ready: false,
    lastUsedAt: Date.now(),
    activeStreams: 0,
    dirPath,
    preparedFiles: new Map(),
  };

  entry.readyPromise = new Promise<TorrentEngineLike>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!entry.ready) {
        destroyTorrentEntry(hash);
        reject(new Error('Torrent metadata timeout — no reachable peers/seeds yet'));
      }
    }, 35000);
    entry.engine.on('ready', () => {
      clearTimeout(timer);
      entry.ready = true;
      entry.lastUsedAt = Date.now();
      resolve(entry.engine);
    });
  });

  activeTorrents.set(hash, entry);
  await entry.readyPromise;
  return entry;
}

function findTargetTorrentFile(
  engine: TorrentEngineLike,
  fileIdxParam: number,
  seasonParam?: number,
  episodeParam?: number
): { file: TorrentFileLike; fileIdx: number } | null {
  const videoRegex = /\.(mp4|mkv|webm|mov|m4v|avi)$/i;
  const files = engine.files || [];

  const indexedVideos = files
    .map((file, idx) => ({ file, idx }))
    .filter(({ file }) => videoRegex.test(file.name));

  const nonSampleVideos = indexedVideos.filter(
    ({ file }) => !/\b(sample|trailer|featurette|bonus)\b/i.test(file.name)
  );
  const pool = nonSampleVideos.length > 0 ? nonSampleVideos : indexedVideos;

  if (fileIdxParam >= 0 && files[fileIdxParam] && videoRegex.test(files[fileIdxParam].name)) {
    const requestedFile = files[fileIdxParam];
    let pointsToWrongEpisode = false;
    if (seasonParam && episodeParam && seasonParam > 0 && episodeParam > 0 && pool.length > 1) {
      const epTag =
        requestedFile.name.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i) ||
        requestedFile.name.match(/\b(\d{1,2})x(\d{2})\b/i);
      if (epTag && (parseInt(epTag[1], 10) !== seasonParam || parseInt(epTag[2], 10) !== episodeParam)) {
        pointsToWrongEpisode = true;
      }
    }
    if (!pointsToWrongEpisode) {
      return { file: requestedFile, fileIdx: fileIdxParam };
    }
  }

  if (seasonParam && episodeParam && seasonParam > 0 && episodeParam > 0 && pool.length > 1) {
    const sPad = String(seasonParam).padStart(2, '0');
    const ePad = String(episodeParam).padStart(2, '0');
    const epRegex = new RegExp(
      `\\b(?:S0?${seasonParam}[._\\s-]*E0?${episodeParam}|${seasonParam}x${ePad}|S${sPad}E${ePad})\\b`,
      'i'
    );
    const epMatch = pool.find(({ file }) => epRegex.test(file.name));
    if (epMatch) {
      return { file: epMatch.file, fileIdx: epMatch.idx };
    }
  }

  if (pool.length > 0) {
    const sorted = [...pool].sort((a, b) => b.file.length - a.file.length);
    return { file: sorted[0].file, fileIdx: sorted[0].idx };
  }

  const fallback = files
    .map((file, idx) => ({ file, idx }))
    .sort((a, b) => b.file.length - a.file.length)[0];
  return fallback ? { file: fallback.file, fileIdx: fallback.idx } : null;
}

function prepareTorrentFile(
  entry: ActiveTorrentEntry,
  fileIdx: number,
  file: TorrentFileLike,
  isP2P: boolean,
  requestedPrebufferMb: number
): PreparedTorrentFileState {
  const prebufferMb = Math.max(2, Math.min(30, Math.round(requestedPrebufferMb || 5)));
  const existingState = entry.preparedFiles.get(fileIdx);
  if (existingState && existingState.prebufferMb >= prebufferMb) {
    return existingState;
  }

  const engine = entry.engine;
  const pieceLength = engine.torrent?.pieceLength || 1024 * 1024;
  const fileOffset = file.offset || 0;
  const fileLength = Math.max(0, file.length || 0);
  const fileStartPiece = Math.floor(fileOffset / pieceLength);
  const fileEndPiece = Math.max(
    fileStartPiece,
    Math.floor((fileOffset + Math.max(1, fileLength) - 1) / pieceLength)
  );

  // Header (~2 MB) + Tail (~1.5 MB for MP4 moov / MKV Cues) + Sequential Pre-buffer (5-30 MB)
  const headPieces = Math.max(1, Math.ceil((2 * 1024 * 1024) / pieceLength));
  const headEndPiece = Math.min(fileEndPiece, fileStartPiece + headPieces - 1);

  const tailPieces = Math.max(1, Math.ceil((1.5 * 1024 * 1024) / pieceLength));
  const tailStartPiece = Math.max(fileStartPiece, fileEndPiece - tailPieces + 1);

  const rawPrebufferBytes = prebufferMb * 1024 * 1024;
  const targetBytes = Math.min(fileLength, rawPrebufferBytes);
  const prePieces = Math.max(1, Math.ceil(targetBytes / pieceLength));
  const preEndPiece = Math.min(fileEndPiece, fileStartPiece + prePieces - 1);

  if (typeof engine.select === 'function') {
    if (isP2P) {
      // Deselect any leftover low-priority whole-file selections on first setup so torrent-stream doesn't grab end-of-file random pieces first
      if (!existingState && typeof file.deselect === 'function') {
        try {
          file.deselect();
        } catch {}
      }
      // 1. Critical header & end pieces first (MP4 moov atom & MKV Cues)
      engine.critical?.(fileStartPiece, Math.min(3, headPieces));
      engine.select(fileStartPiece, headEndPiece, 10);
      if (tailStartPiece > headEndPiece) {
        engine.critical?.(tailStartPiece, Math.min(2, tailPieces));
        engine.select(tailStartPiece, fileEndPiece, 8);
      }
      // 2. Sequential pre-buffer window (focus 100% of bandwidth on initial playback pieces)
      engine.select(fileStartPiece, preEndPiece, 5);
      // Background remainder is deferred until stream connection starts to maximize prebuffer speed
    } else {
      file.select();
    }
  } else {
    file.select();
  }

  const state: PreparedTorrentFileState = {
    fileIdx,
    fileName: file.name,
    fileLength,
    fileOffset,
    pieceLength,
    fileStartPiece,
    fileEndPiece,
    headEndPiece,
    tailStartPiece,
    preEndPiece,
    prebufferMb,
    targetBytes,
    activeSeekWindow: existingState?.activeSeekWindow,
  };
  entry.preparedFiles.set(fileIdx, state);
  return state;
}

function getTorrentPrebufferStatus(entry: ActiveTorrentEntry, state: PreparedTorrentFileState) {
  const bitfield = entry.engine.bitfield;
  const totalPrePieces = Math.max(1, state.preEndPiece - state.fileStartPiece + 1);
  let completedPrePieces = 0;

  if (bitfield) {
    for (let p = state.fileStartPiece; p <= state.preEndPiece; p += 1) {
      if (bitfield.get(p)) completedPrePieces += 1;
    }
  }

  const headReady = Boolean(bitfield?.get(state.fileStartPiece));
  const tailReady =
    state.fileLength <= 3 * 1024 * 1024
      ? headReady
      : Boolean(bitfield?.get(state.fileEndPiece) || bitfield?.get(state.tailStartPiece));

  const downloadedBytesRaw = completedPrePieces * state.pieceLength;
  const prebufferedBytes = Math.min(state.targetBytes, downloadedBytesRaw);
  const progressPct =
    state.targetBytes > 0
      ? Math.min(100, Math.round((prebufferedBytes / state.targetBytes) * 100))
      : 100;

  const wires = entry.engine.swarm?.wires || [];
  const peers = wires.length;
  const seeders = wires.filter(
    (w: any) =>
      w &&
      (w.isSeeder ||
        w.peerChoking === false ||
        (w.peerPieces && typeof w.peerPieces.count === 'function' && w.peerPieces.count() > 0))
  ).length;
  let speedBps = 0;
  try {
    speedBps = entry.engine.swarm?.downloadSpeed?.() || 0;
  } catch {
    speedBps = 0;
  }
  const speedKbps = Math.round((speedBps / 1024) * 10) / 10;

  // Fast startup: allow playback as soon as 1.0 MB + header piece are buffered
  const minRequiredBytes = Math.min(state.targetBytes, 1.0 * 1024 * 1024);
  const readyToPlay =
    headReady &&
    (prebufferedBytes >= minRequiredBytes || completedPrePieces >= totalPrePieces);

  return {
    infoHash: entry.infoHash,
    fileIdx: state.fileIdx,
    fileName: state.fileName,
    fileLength: state.fileLength,
    fileSize: state.fileLength,
    peers,
    seeders,
    speedKbps,
    prebufferMb: state.prebufferMb,
    prebufferedBytes,
    targetBytes: state.targetBytes,
    completedPrePieces,
    totalPrePieces,
    headReady,
    tailReady,
    progressPct,
    readyToPlay,
  };
}

function prioritizeTorrentSeek(
  entry: ActiveTorrentEntry,
  state: PreparedTorrentFileState,
  seekByteOffset: number
) {
  const engine = entry.engine;
  if (typeof engine.select !== 'function') return;

  const seekPiece = Math.max(
    state.fileStartPiece,
    Math.min(
      state.fileEndPiece,
      Math.floor((state.fileOffset + Math.max(0, seekByteOffset)) / state.pieceLength)
    )
  );
  const aheadCount = Math.max(2, Math.ceil((12 * 1024 * 1024) / state.pieceLength));
  const seekEnd = Math.min(state.fileEndPiece, seekPiece + aheadCount - 1);

  if (
    state.activeSeekWindow &&
    (state.activeSeekWindow.from !== seekPiece || state.activeSeekWindow.to !== seekEnd)
  ) {
    try {
      engine.deselect?.(state.activeSeekWindow.from, state.activeSeekWindow.to, 12);
    } catch {}
  }

  engine.critical?.(seekPiece, 2);
  engine.select(seekPiece, seekEnd, 12);
  state.activeSeekWindow = { from: seekPiece, to: seekEnd };
}

interface ProbedAudioTrack {
  index: number;
  langCode: string;
  title: string;
  displayLang: string;
}

interface ProbedContainerInfo {
  videoIndex: number;
  isHevc: boolean;
  durationSeconds?: number;
  audioTracks: ProbedAudioTrack[];
}

const containerProbeCache = new Map<string, ProbedContainerInfo>();

function runFfprobeAsync(args: string[], stdinBuffer?: Buffer, timeoutMs = 5500): Promise<ProbedContainerInfo | null> {
  return new Promise((resolve) => {
    const ff = spawn('ffprobe', args, {
      stdio: [stdinBuffer ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (val: ProbedContainerInfo | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const timer = setTimeout(() => {
      try { ff.kill('SIGKILL'); } catch {}
      finish(null);
    }, timeoutMs);

    ff.stdout?.on('data', (c: Buffer) => chunks.push(c));
    ff.on('error', () => finish(null));
    ff.on('close', (code) => {
      if (code !== 0) return finish(null);
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          format?: { duration?: string | number };
          streams?: Array<{
            index: number;
            codec_type: string;
            codec_name?: string;
            tags?: { language?: string; title?: string };
          }>;
        };
        const streams = json?.streams || [];
        const videoStreams = streams.filter(
          (s) => s.codec_type === 'video' && s.codec_name !== 'png' && s.codec_name !== 'mjpeg'
        );
        const audioStreams = streams.filter((s) => s.codec_type === 'audio');
        if (audioStreams.length === 0) return finish(null);

        const rawDur = json?.format?.duration ? Number(json.format.duration) : NaN;
        const durationSeconds = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : undefined;

        const videoIndex = videoStreams[0]?.index ?? 0;
        const isHevc = videoStreams.some((v) => v.codec_name === 'hevc' || v.codec_name === 'h265');
        const audioTracks: ProbedAudioTrack[] = audioStreams.map((s) => {
          const langCode = (s.tags?.language || '').trim().toLowerCase();
          const title = (s.tags?.title || '').trim();
          const displayLang =
            normalizeSingleLangToken(langCode) ||
            normalizeSingleLangToken(title) ||
            (langCode && langCode !== 'und' ? langCode.toUpperCase() : '');
          return { index: s.index, langCode, title, displayLang };
        });

        finish({ videoIndex, isHevc, durationSeconds, audioTracks });
      } catch {
        finish(null);
      }
    });

    if (stdinBuffer && ff.stdin) {
      ff.stdin.on('error', () => {});
      ff.stdin.end(stdinBuffer);
    }
  });
}

async function probeContainerInfoAsync(
  sourceUrl: string,
  customHeaders?: Record<string, string>,
  timeoutMs = 5500
): Promise<ProbedContainerInfo | null> {
  const cached = containerProbeCache.get(sourceUrl);
  if (cached) return cached;

  const args = [
    '-v', 'error',
    '-show_entries', 'stream=index,codec_type,codec_name:stream_tags=language,title:format=duration',
    '-of', 'json',
    '-probesize', '2500000',
    '-analyzeduration', '2500000',
  ];
  const mergedHeaders: Record<string, string> = {
    'User-Agent': customHeaders?.['User-Agent'] || customHeaders?.['user-agent'] || DEFAULT_UA,
    ...(customHeaders || {}),
  };
  const headerStr = Object.entries(mergedHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n') + '\r\n';
  args.push('-headers', headerStr, sourceUrl);

  const info = await runFfprobeAsync(args, undefined, timeoutMs);
  if (info) {
    containerProbeCache.set(sourceUrl, info);
  }
  return info;
}

const LANG_MATCH_RULES: Array<{ test: RegExp; codes: string[]; names: RegExp }> = [
  { test: /\b(hindi|hin)\b/i, codes: ['hin', 'hi'], names: /\b(hindi|hin)\b/i },
  { test: /\b(bengali|bangla|ben)\b/i, codes: ['ben', 'bn'], names: /\b(bengali|bangla|ben)\b/i },
  { test: /\b(tamil|tam)\b/i, codes: ['tam', 'ta'], names: /\b(tamil|tam)\b/i },
  { test: /\b(telugu|tel)\b/i, codes: ['tel', 'te'], names: /\b(telugu|tel)\b/i },
  { test: /\b(malayalam|mal)\b/i, codes: ['mal', 'ml'], names: /\b(malayalam|mal)\b/i },
  { test: /\b(kannada|kan)\b/i, codes: ['kan', 'kn'], names: /\b(kannada|kan)\b/i },
  { test: /\b(marathi|mar)\b/i, codes: ['mar', 'mr'], names: /\b(marathi|mar)\b/i },
  { test: /\b(punjabi|pan)\b/i, codes: ['pan', 'pa'], names: /\b(punjabi|pan)\b/i },
  { test: /\b(english|eng)\b/i, codes: ['eng', 'en'], names: /\b(english|eng)\b/i },
  { test: /\b(french|fre|fra)\b/i, codes: ['fre', 'fra', 'fr'], names: /\b(french|français|francais|fre|fra)\b/i },
  { test: /\b(spanish|spa|esp)\b/i, codes: ['spa', 'esp', 'es'], names: /\b(spanish|español|espanol|spa|esp|latino)\b/i },
  { test: /\b(italian|ita)\b/i, codes: ['ita', 'it'], names: /\b(italian|italiano|ita)\b/i },
  { test: /\b(portuguese|por)\b/i, codes: ['por', 'pt'], names: /\b(portuguese|português|por|dublado)\b/i },
  { test: /\b(german|ger|deu)\b/i, codes: ['ger', 'deu', 'de'], names: /\b(german|deutsch|ger|deu)\b/i },
  { test: /\b(russian|rus)\b/i, codes: ['rus', 'ru'], names: /\b(russian|rus)\b/i },
  { test: /\b(ukrainian|ukr)\b/i, codes: ['ukr', 'uk'], names: /\b(ukrainian|ukr)\b/i },
  { test: /\b(japanese|jpn|jap)\b/i, codes: ['jpn', 'ja', 'jap'], names: /\b(japanese|jpn|jap)\b/i },
  { test: /\b(korean|kor)\b/i, codes: ['kor', 'ko'], names: /\b(korean|kor)\b/i },
  { test: /\b(arabic|ara)\b/i, codes: ['ara', 'ar'], names: /\b(arabic|ara)\b/i },
  { test: /\b(turkish|tur)\b/i, codes: ['tur', 'tr'], names: /\b(turkish|tur)\b/i },
  { test: /\b(chinese|chi|zho)\b/i, codes: ['zho', 'chi', 'zh'], names: /\b(chinese|mandarin|chi|zho)\b/i },
];

function selectAudioTrackIndex(info: ProbedContainerInfo, preferredLang?: string): number {
  if (!preferredLang || info.audioTracks.length <= 1) {
    return info.audioTracks[0]?.index ?? 1;
  }

  // Support multi-language labels like "Hindi + Tamil + Telugu + English" -> try each token in priority order
  const segments = preferredLang
    .split(/[+/|,]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim().toLowerCase())
    .filter(Boolean);

  for (const seg of segments) {
    if (seg.includes('multi') || seg.includes('dual') || seg === 'original') continue;
    const rule = LANG_MATCH_RULES.find((r) => r.test.test(seg));
    const matched = info.audioTracks.find((t) => {
      const dl = t.displayLang.toLowerCase();
      if (rule) {
        return rule.codes.includes(t.langCode) || rule.names.test(t.title) || rule.test.test(dl);
      }
      return t.langCode.includes(seg) || t.title.toLowerCase().includes(seg) || dl.includes(seg);
    });
    if (matched) return matched.index;
  }

  return info.audioTracks[0].index;
}

function resolveFfmpegLangCodes(preferredLang?: string): string[] {
  const segments = (preferredLang || '')
    .split(/[+/|,]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim().toLowerCase())
    .filter(Boolean);
  for (const seg of segments) {
    const rule = LANG_MATCH_RULES.find((r) => r.test.test(seg));
    if (rule) return rule.codes;
  }
  return [];
}

async function probeContainerViaNodeFetch(
  sourceUrl: string,
  customHeaders?: Record<string, string>
): Promise<ProbedContainerInfo | null> {
  try {
    const mergedHeaders: Record<string, string> = {
      'User-Agent': customHeaders?.['User-Agent'] || customHeaders?.['user-agent'] || DEFAULT_UA,
      ...(customHeaders || {}),
      Range: 'bytes=0-1572863',
    };
    const r = await fetch(sourceUrl, {
      headers: mergedHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(2600),
    });
    if (!r.ok) {
      void r.body?.cancel();
      return null;
    }
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json')) {
      void r.body?.cancel();
      return null;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 4096) return null;
    const headTxt = buf.subarray(0, 128).toString('utf8').trimStart().toLowerCase();
    if (headTxt.startsWith('<!doctype') || headTxt.startsWith('<html') || headTxt.startsWith('{"error')) {
      return null;
    }
    const info = await runFfprobeAsync(
      [
        '-v', 'error',
        '-show_entries', 'stream=index,codec_type,codec_name:stream_tags=language,title:format=duration',
        '-of', 'json',
        '-probesize', '1500000',
        '-analyzeduration', '1500000',
        '-',
      ],
      buf,
      2200
    );
    if (info) {
      containerProbeCache.set(sourceUrl, info);
    }
    return info;
  } catch {
    return null;
  }
}

async function pipeStreamThroughFfmpegRemux(
  inputSource: string | NodeJS.ReadableStream,
  res: express.Response,
  isHevc: boolean,
  customHeaders?: Record<string, string>,
  preferredLang?: string,
  seekSeconds?: number,
  preProbedInfo?: ProbedContainerInfo | null
) {
  let probed: ProbedContainerInfo | null =
    preProbedInfo || (typeof inputSource === 'string' ? containerProbeCache.get(inputSource) || null : null);
  const mergedHeaders: Record<string, string> = {
    'User-Agent': customHeaders?.['User-Agent'] || customHeaders?.['user-agent'] || DEFAULT_UA,
    ...(customHeaders || {}),
  };

  // Only perform a single fast 1MB node probe if cache missed AND multi-language selection is explicitly requested
  const wantsSpecificMultiLang = Boolean(
    preferredLang &&
      !/^(original|multi|dual)$/i.test(preferredLang.trim()) &&
      typeof inputSource === 'string'
  );
  if (typeof inputSource === 'string' && !probed && wantsSpecificMultiLang) {
    try {
      const r = await fetch(inputSource, {
        headers: { ...mergedHeaders, Range: 'bytes=0-1048575' },
        redirect: 'follow',
        signal: AbortSignal.timeout(1500),
      });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (
        (r.status >= 400 && r.status !== 416 && r.status !== 405 && r.status !== 501) ||
        ct.includes('text/html') ||
        ct.includes('application/json')
      ) {
        void r.body?.cancel();
        if (!res.headersSent && !res.writableEnded) {
          res.status(502).json({ error: `Upstream remux source invalid (HTTP ${r.status})` });
        }
        return;
      }
      if (r.ok && r.body) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length >= 4096) {
          probed = await runFfprobeAsync(
            [
              '-v', 'error',
              '-show_entries', 'stream=index,codec_type,codec_name:stream_tags=language,title:format=duration',
              '-of', 'json',
              '-probesize', '1000000',
              '-analyzeduration', '1000000',
              '-',
            ],
            buf,
            1200
          );
          if (probed) containerProbeCache.set(inputSource, probed);
        }
      } else {
        void r.body?.cancel();
      }
    } catch {
      // Proceed immediately to ffmpeg without blocking startup
    }
  }

  let ffmpegDetectedDurationSec: number | undefined = probed?.durationSeconds;

  const runAttempt = (mode: 'url' | 'pipe-fetch', pipeStream?: Readable): Promise<'sent' | 'empty' | 'aborted'> =>
    new Promise((resolve) => {
      if (res.destroyed || res.writableEnded) {
        pipeStream?.destroy();
        return resolve('aborted');
      }

      const useStdinPipe = mode === 'pipe-fetch' || typeof inputSource !== 'string';
      const args: string[] = [
        '-hide_banner',
        '-loglevel', 'info',
        '-fflags', '+genpts+discardcorrupt',
        '-avoid_negative_ts', 'make_zero',
        '-probesize', '1500000',
        '-analyzeduration', '1500000',
      ];
      if (!useStdinPipe && seekSeconds && seekSeconds > 0) {
        args.push('-ss', String(seekSeconds));
      }
      if (!useStdinPipe && typeof inputSource === 'string') {
        const isLocalUrl =
          inputSource.startsWith('http://127.0.0.1') || inputSource.startsWith('http://localhost');
        if (!isLocalUrl) {
          args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2');
          const headerStr =
            Object.entries(mergedHeaders)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\r\n') + '\r\n';
          args.push('-headers', headerStr);
        }
        args.push('-i', inputSource);
      } else {
        args.push('-i', 'pipe:0');
        if (seekSeconds && seekSeconds > 0) {
          args.push('-ss', String(seekSeconds));
        }
      }

      if (probed) {
        const audioIdx = selectAudioTrackIndex(probed, preferredLang);
        args.push('-map', `0:${probed.videoIndex}`, '-map', `0:${audioIdx}`);
      } else {
        args.push('-map', '0:V:0?');
        const langCodes = resolveFfmpegLangCodes(preferredLang);
        if (langCodes.length > 0) {
          for (const code of langCodes.slice(0, 3)) {
            args.push('-map', `0:m:language:${code}?`);
          }
        }
        args.push('-map', '0:a:0?');
      }

      // Only transcode video to H.264 if probed HEVC or explicitly tagged HEVC AND not explicitly x264
      const shouldTranscodeVideo = probed ? probed.isHevc : isHevc;
      args.push(
        ...(shouldTranscodeVideo
          ? [
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-tune', 'zerolatency',
              '-crf', '24',
              '-vf', "scale='trunc(min(1280,iw)/2)*2':-2",
              '-pix_fmt', 'yuv420p',
              '-g', '48',
              '-threads', '0',
            ]
          : ['-c:v', 'copy']),
        '-af', 'aresample=async=1:first_pts=0',
        '-c:a', 'aac',
        '-ac', '2',
        '-b:a', '192k',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1'
      );

      const ff = spawn('ffmpeg', args, { stdio: [useStdinPipe ? 'pipe' : 'ignore', 'pipe', 'pipe'] });

      let sentAnyBytes = false;
      let finished = false;
      const done = (outcome: 'sent' | 'empty' | 'aborted') => {
        if (finished) return;
        finished = true;
        clearTimeout(startupTimer);
        resolve(outcome);
      };

      const startupTimer = setTimeout(() => {
        if (!sentAnyBytes) {
          try { ff.kill('SIGKILL'); } catch {}
          pipeStream?.destroy();
          done('empty');
        }
      }, mode === 'url' ? 3500 : 5500);

      let stderrTail = '';
      ff.stderr?.on('data', (d: Buffer) => {
        if (ffmpegDetectedDurationSec || stderrTail.length > 4096) return;
        stderrTail += d.toString('utf8');
        const durMatch = stderrTail.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        if (durMatch) {
          const hrs = Number(durMatch[1]);
          const mins = Number(durMatch[2]);
          const secs = Number(durMatch[3]);
          const total = hrs * 3600 + mins * 60 + secs;
          if (Number.isFinite(total) && total > 0) {
            ffmpegDetectedDurationSec = total;
          }
        }
      });

      const srcStream = mode === 'pipe-fetch' ? pipeStream : typeof inputSource !== 'string' ? inputSource : undefined;
      if (srcStream && ff.stdin) {
        srcStream.on('error', () => {
          try { ff.kill('SIGKILL'); } catch {}
        });
        ff.stdin.on('error', () => {});
        srcStream.pipe(ff.stdin);
      }

      ff.stdout?.on('data', (chunk: Buffer) => {
        if (!chunk || chunk.length === 0 || res.destroyed || res.writableEnded) return;
        if (!sentAnyBytes) {
          sentAnyBytes = true;
          clearTimeout(startupTimer);
          if (!res.headersSent) {
            res.status(200);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            const finalDur = ffmpegDetectedDurationSec || probed?.durationSeconds;
            if (finalDur && Number.isFinite(finalDur) && finalDur > 0) {
              res.setHeader('X-Content-Duration', String(Math.round(finalDur)));
              res.setHeader(
                'Access-Control-Expose-Headers',
                'X-Content-Duration, Accept-Ranges, Content-Length, Content-Range, Content-Type'
              );
            }
          }
        }
        if (!res.write(chunk)) {
          ff.stdout?.pause();
        }
      });

      const onDrain = () => {
        if (ff.stdout && !ff.stdout.destroyed) ff.stdout.resume();
      };
      res.on('drain', onDrain);

      ff.on('error', () => {
        res.off('drain', onDrain);
        pipeStream?.destroy();
        done(sentAnyBytes ? 'sent' : 'empty');
      });

      ff.on('close', () => {
        res.off('drain', onDrain);
        if (sentAnyBytes) {
          if (!res.writableEnded) res.end();
          done('sent');
        } else {
          pipeStream?.destroy();
          done('empty');
        }
      });

      res.on('close', () => {
        clearTimeout(startupTimer);
        res.off('drain', onDrain);
        if (srcStream && 'destroy' in srcStream && typeof srcStream.destroy === 'function') {
          try { (srcStream as Readable).destroy(); } catch {}
        }
        try { ff.kill('SIGKILL'); } catch {}
        done('aborted');
      });
    });

  if (typeof inputSource !== 'string') {
    const outcome = await runAttempt('pipe-fetch');
    if (outcome === 'empty' && !res.headersSent && !res.writableEnded) {
      res.status(502).json({ error: 'Remux stream failed to produce video output' });
    }
    return;
  }

  // Try direct ffmpeg -i URL first (handles Range requests, moov-at-EOF, fast -ss seeks, and fast startup)
  let outcome = await runAttempt('url');

  const isLocalInput =
    inputSource.startsWith('http://127.0.0.1') || inputSource.startsWith('http://localhost');

  // If ffmpeg libavformat rejected CDN TLS/Referer and output zero bytes, fall back to Node fetch() -> pipe:0
  if (outcome === 'empty' && !isLocalInput && !res.destroyed && !res.writableEnded) {
    try {
      const fetchRes = await fetch(inputSource, {
        headers: mergedHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(6500),
      });
      const ct = (fetchRes.headers.get('content-type') || '').toLowerCase();
      if (fetchRes.ok && fetchRes.body && !ct.includes('text/html') && !ct.includes('application/json')) {
        const nodeStream = Readable.fromWeb(fetchRes.body as unknown as NodeReadableStream);
        outcome = await runAttempt('pipe-fetch', nodeStream);
      } else {
        void fetchRes.body?.cancel();
      }
    } catch {
      // Return 502 below if fallback also failed
    }
  }

  if (outcome === 'empty' && !res.headersSent && !res.writableEnded) {
    res.status(502).json({ error: 'Upstream stream could not be remuxed or returned 403/empty' });
  }
}

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection prevented crash:', err instanceof Error ? err.message : err);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception prevented crash:', err instanceof Error ? err.message : err);
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  });

  // Server-side IMDb resolver (protects Stremio/Torrentio/Meteor resolution when browser cannot reach TMDB directly)
  app.get('/api/resolve-imdb', async (req, res) => {
    const tmdbId = String(req.query.tmdbId || '').trim();
    const mediaType = req.query.mediaType === 'tv' ? 'tv' : 'movie';
    const title = typeof req.query.title === 'string' ? req.query.title : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const headerKey = typeof req.headers['x-tmdb-key'] === 'string' ? req.headers['x-tmdb-key'] : undefined;
    if (!tmdbId) {
      return res.status(400).json({ error: 'Missing tmdbId', imdbId: null });
    }
    const imdbId = await resolveImdbIdServerSide(tmdbId, mediaType, headerKey, title, year);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ imdbId: imdbId || null });
  });

  // Server-side TMDB v3 proxy fallback when client network blocks api.themoviedb.org
  app.get('/api/tmdb/*', async (req, res) => {
    const subPath = String((req.params as Record<string, unknown>)[0] || '').replace(/^\/+/, '');
    if (!subPath || subPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid TMDB path' });
    }
    try {
      const targetUrl = new URL(`https://api.themoviedb.org/3/${subPath}`);
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') targetUrl.searchParams.set(k, v);
      }
      const clientAuth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      const hasQueryKey = targetUrl.searchParams.has('api_key');
      const headers: Record<string, string> = {
        'User-Agent': DEFAULT_UA,
        Accept: 'application/json',
      };
      if (clientAuth) {
        headers['Authorization'] = clientAuth;
      } else if (!hasQueryKey) {
        const effectiveKey = DEFAULT_TMDB_KEY;
        if (effectiveKey.length > 45 && effectiveKey.includes('.')) {
          headers['Authorization'] = `Bearer ${effectiveKey}`;
        } else {
          targetUrl.searchParams.set('api_key', effectiveKey);
        }
      }
      const upstream = await fetch(targetUrl.toString(), {
        headers,
        signal: AbortSignal.timeout(9000),
      });
      const text = await upstream.text();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      res.status(upstream.status).send(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TMDB proxy error';
      res.status(502).json({ error: msg });
    }
  });

  function isPrivateOrReservedIpv4(ipv4: string): boolean {
    const parts = ipv4.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 169 && b === 254) return true; // Link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  function isPrivateOrReservedIp(rawIp: string): boolean {
    const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
    if (!ip) return true;
    const ipVersion = net.isIP(ip);
    if (ipVersion === 4) {
      return isPrivateOrReservedIpv4(ip);
    }
    if (ipVersion === 6) {
      if (ip === '::' || ip === '::1') return true;
      if (ip.startsWith('::ffff:')) {
        const mapped = ip.slice('::ffff:'.length);
        if (net.isIP(mapped) === 4) {
          return isPrivateOrReservedIpv4(mapped);
        }
        const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hexMatch) {
          const hi = parseInt(hexMatch[1], 16);
          const lo = parseInt(hexMatch[2], 16);
          const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
          return isPrivateOrReservedIpv4(v4);
        }
        return true;
      }
      if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^fc/i.test(ip) || /^fd/i.test(ip)) return true;
      if (/^fe[89ab][0-9a-f]:/i.test(ip) || /^fe80:/i.test(ip)) return true;
      if (/^ff/i.test(ip)) return true;
      return false;
    }
    return true;
  }

  function isSafeRemoteProxyUrl(raw: string): boolean {
    if (!raw || raw.length > 4096) return false;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      if (u.username || u.password) return false;
      const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (!host) return false;
      if (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host === 'metadata.google.internal' ||
        host.endsWith('.local') ||
        host.endsWith('.internal')
      ) {
        return false;
      }
      if (net.isIP(host) !== 0) {
        return !isPrivateOrReservedIp(host);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function assertPublicHostnameResolvesSafely(raw: string): Promise<boolean> {
    if (!isSafeRemoteProxyUrl(raw)) return false;
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (net.isIP(host) !== 0) {
        return !isPrivateOrReservedIp(host);
      }
      const records = await Promise.race([
        dns.lookup(host, { all: true }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('DNS lookup timeout')), 3000)
        ),
      ]);
      if (!Array.isArray(records) || records.length === 0) return false;
      return records.every((rec) => !isPrivateOrReservedIp(rec.address));
    } catch {
      return false;
    }
  }

  async function fetchWithSafeRedirects(
    initialUrl: string,
    init: RequestInit,
    maxRedirects = 5
  ): Promise<{ response: globalThis.Response; blockedBySsrf?: boolean }> {
    let currentUrl = initialUrl;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const safeHost = await assertPublicHostnameResolvesSafely(currentUrl);
      if (!safeHost) {
        return { response: new Response(null, { status: 400 }), blockedBySsrf: true };
      }
      const response = await fetch(currentUrl, {
        ...init,
        redirect: 'manual',
      });
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        const location = response.headers.get('location')!;
        void response.body?.cancel().catch(() => {});
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return { response };
    }
    throw new Error('Too many redirects from upstream target');
  }

  // Generic CORS proxy for HTML/JSON/Range media endpoints
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = String(req.query.url || '');
    if (!(await assertPublicHostnameResolvesSafely(targetUrl))) {
      return res.status(400).json({ error: 'Invalid or disallowed target url parameter' });
    }
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 15000);
    req.on('close', () => {
      clearTimeout(requestTimeout);
      if (!res.writableEnded) {
        controller.abort();
      }
    });
    try {
      const proxyHeaders: Record<string, string> = {
        'User-Agent': DEFAULT_UA,
        Accept: 'application/json, text/html, text/plain, */*',
      };
      if (req.query.referer) {
        proxyHeaders['Referer'] = String(req.query.referer);
      }
      if (req.query.origin) {
        proxyHeaders['Origin'] = String(req.query.origin);
      }
      if (typeof req.headers.range === 'string' && req.headers.range.trim()) {
        proxyHeaders['Range'] = req.headers.range.trim();
      }

      const { response, blockedBySsrf } = await fetchWithSafeRedirects(targetUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: proxyHeaders,
        signal: controller.signal,
      });
      clearTimeout(requestTimeout);

      if (blockedBySsrf) {
        return res.status(400).json({ error: 'Redirect target disallowed' });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentRange = response.headers.get('content-range');
      const acceptRanges =
        response.headers.get('accept-ranges') || (response.status === 206 ? 'bytes' : null);
      const contentLength = response.headers.get('content-length');

      res.setHeader('Content-Type', contentType);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Range, Accept-Ranges, Content-Length, Content-Type'
      );

      if (req.method === 'HEAD' || !response.body) {
        void response.body?.cancel().catch(() => {});
        return res.status(response.status).end();
      }

      res.status(response.status);
      const nodeStream = Readable.fromWeb(response.body as unknown as NodeReadableStream);
      req.on('close', () => {
        if (!nodeStream.destroyed) nodeStream.destroy();
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Upstream stream read error' });
        } else if (!res.writableEnded) {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (err) {
      clearTimeout(requestTimeout);
      const msg = err instanceof Error ? err.message : 'Server proxy fetch failed';
      if (!res.headersSent) {
        res.status(502).json({ error: msg });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Streaming HLS/MP4/VTT proxy with custom Referer/Origin/User-Agent headers, Range seeking, m3u8 rewriting & MKV remux
  app.get('/api/stream-proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    const hParam = (req.query.h as string) || '';
    const shouldRemux = req.query.remux === '1';
    const isHevc = req.query.hevc === '1';
    const isSegment = req.query.seg === '1';
    const preferredLang = (req.query.lang as string) || '';
    const seekSec = req.query.ss ? Number(req.query.ss) : req.query.t ? Number(req.query.t) : 0;
    if (!(await assertPublicHostnameResolvesSafely(targetUrl))) {
      return res.status(400).json({ error: 'Invalid or disallowed target stream url' });
    }

    const customHeaders = decodeHeadersParam(hParam);
    const forwardHeaders: Record<string, string> = {
      'User-Agent': customHeaders['User-Agent'] || customHeaders['user-agent'] || DEFAULT_UA,
      ...customHeaders,
    };

    if (shouldRemux) {
      if (req.method === 'HEAD') {
        let probed = containerProbeCache.get(targetUrl) || null;
        if (!probed) {
          probed = await probeContainerInfoAsync(targetUrl, forwardHeaders, 1800);
          if (!probed) {
            probed = await probeContainerViaNodeFetch(targetUrl, forwardHeaders);
          }
        }
        if (!probed) {
          // Verify upstream is at least reachable binary video rather than a dead 503/HTML page
          try {
            const checkRes = await fetch(targetUrl, {
              headers: { ...forwardHeaders, Range: 'bytes=0-511' },
              redirect: 'follow',
              signal: AbortSignal.timeout(2000),
            });
            const checkCt = (checkRes.headers.get('content-type') || '').toLowerCase();
            void checkRes.body?.cancel();
            if (checkRes.status >= 400 || checkCt.includes('text/html') || checkCt.includes('application/json')) {
              return res.status(502).json({ error: `Upstream remux target returned HTTP ${checkRes.status}` });
            }
          } catch {
            return res.status(502).json({ error: 'Upstream remux target unreachable' });
          }
        }
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
          'Access-Control-Expose-Headers',
          'X-Content-Duration, Accept-Ranges, Content-Length, Content-Range, Content-Type'
        );
        if (probed?.durationSeconds && Number.isFinite(probed.durationSeconds)) {
          res.setHeader('X-Content-Duration', String(Math.round(probed.durationSeconds)));
        }
        return res.status(200).end();
      }
      await pipeStreamThroughFfmpegRemux(targetUrl, res, isHevc, forwardHeaders, preferredLang, seekSec);
      return;
    }

    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range;
    }

    const controller = new AbortController();
    const connectTimeout = setTimeout(() => controller.abort(), 15000);
    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
      clearTimeout(connectTimeout);
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    try {
      let response = await fetch(targetUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: forwardHeaders,
        redirect: 'follow',
        signal: controller.signal,
      });
      if (req.method === 'HEAD' && (response.status === 405 || response.status === 501)) {
        void response.body?.cancel();
        response = await fetch(targetUrl, {
          method: 'GET',
          headers: { ...forwardHeaders, Range: forwardHeaders.Range || 'bytes=0-511' },
          redirect: 'follow',
          signal: controller.signal,
        });
      }
      clearTimeout(connectTimeout);
      if (clientClosed) {
        void response.body?.cancel();
        return;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const urlPath = targetUrl.split('?')[0].toLowerCase();
      let isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        urlPath.endsWith('.m3u8');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-Content-Duration, Content-Length, Content-Range, Accept-Ranges, Content-Type'
      );

      if (req.method === 'HEAD') {
        let peekText = '';
        if (!isM3u8 && response.body && response.ok) {
          try {
            const reader = response.body.getReader();
            const first = await reader.read();
            if (first.value && first.value.length > 0) {
              peekText = Buffer.from(first.value.subarray(0, 512)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
            }
            await reader.cancel();
          } catch {
            void response.body?.cancel();
          }
        } else {
          void response.body?.cancel();
        }
        if (peekText.startsWith('#EXTM3U')) {
          isM3u8 = true;
        }
        if (
          response.status >= 400 ||
          contentType.includes('text/html') ||
          contentType.includes('application/json') ||
          /^<!doctype|^<html|^<head|^<body|^\{"error"/i.test(peekText)
        ) {
          return res
            .status(response.status >= 400 ? response.status : 502)
            .json({ error: `Upstream returned invalid media (HTTP ${response.status})` });
        }
        if (isM3u8) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          return res.status(200).end();
        }
        if (contentType) res.setHeader('Content-Type', contentType);
        const headLen = response.headers.get('content-length');
        const headRange = response.headers.get('content-range');
        const headAccept = response.headers.get('accept-ranges');
        if (headRange) res.setHeader('Content-Range', headRange);
        if (headAccept) res.setHeader('Accept-Ranges', headAccept);
        if (headLen && response.status === 200) res.setHeader('Content-Length', headLen);
        return res.status(response.status === 206 ? 200 : response.status).end();
      }

      if (isM3u8) {
        const text = await response.text();
        if (response.status >= 400 || !text.includes('#EXTM3U')) {
          return res
            .status(response.status >= 400 ? response.status : 502)
            .json({ error: 'Upstream returned an invalid HLS playlist' });
        }
        const finalUrl = response.url || targetUrl;
        const rewritten = rewriteM3u8Playlist(text, finalUrl, hParam);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(response.status).send(rewritten);
      }

      if (response.status >= 400 && (contentType.includes('text/html') || contentType.includes('application/json') || isSegment)) {
        void response.body?.cancel();
        return res.status(response.status).json({ error: `Upstream media returned HTTP ${response.status}` });
      }

      const isCaptionPath = urlPath.endsWith('.vtt') || urlPath.endsWith('.srt') || urlPath.endsWith('.webvtt');
      const disguisedSegment =
        isSegment &&
        !isCaptionPath &&
        !contentType.includes('vtt') &&
        (contentType.startsWith('image/') ||
          contentType.includes('text/plain') ||
          contentType.includes('octet-stream') ||
          !contentType);

      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      if (!response.body) {
        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        return res.status(response.status).end();
      }

      const nodeStream = Readable.fromWeb(response.body as unknown as NodeReadableStream);
      const shouldInspectHead =
        !isCaptionPath &&
        !(response.status === 206 && !isSegment) &&
        (disguisedSegment ||
          !contentType ||
          contentType.startsWith('image/') ||
          contentType.startsWith('text/') ||
          contentType.includes('octet-stream') ||
          contentType.includes('application/json'));

      if (!shouldInspectHead) {
        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.status(response.status);
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(502);
          if (!res.writableEnded) res.end();
        });
        res.on('close', () => {
          nodeStream.destroy();
        });
        nodeStream.pipe(res);
        return;
      }

      // Peek initial bytes to catch disguised HLS child playlists (e.g. playlist.jpg), HTML error pages, fMP4 init/media segments, or MPEG-TS fake-image headers
      const headChunks: Buffer[] = [];
      let headBytes = 0;
      let firstChunkHandled = false;
      let headersFlushed = false;
      let collectingDisguisedPlaylist = false;

      const sendRawBufferedError = (statusCode: number, message: string) => {
        firstChunkHandled = true;
        nodeStream.destroy();
        if (!res.headersSent && !res.writableEnded) {
          res.status(statusCode).json({ error: message });
        }
      };

      const flushInitialChunks = () => {
        if (firstChunkHandled) return;
        let combined = headChunks.length === 1 ? headChunks[0] : Buffer.concat(headChunks);
        const headUtf8 = combined.subarray(0, 512).toString('utf8').replace(/^\uFEFF/, '').trimStart();

        // 1. Disguised HLS playlist (e.g. playlist.jpg served with Content-Type: image/jpeg containing #EXTM3U)
        if (headUtf8.startsWith('#EXTM3U')) {
          collectingDisguisedPlaylist = true;
          return;
        }

        // 2. HTML/JSON error disguised as HTTP 200
        if (/^<!doctype|^<html|^<head|^<body|^\{"error"/i.test(headUtf8)) {
          sendRawBufferedError(502, 'Upstream returned HTML or JSON error instead of video stream');
          return;
        }

        firstChunkHandled = true;
        headChunks.length = 0;

        // 3. ISO-BMFF / fMP4 segment (ftyp / styp / moof / sidx / emsg at bytes 4..7)
        const isIsoBmff =
          combined.length >= 8 &&
          ['ftyp', 'styp', 'moof', 'sidx', 'emsg'].includes(combined.subarray(4, 8).toString('ascii'));

        let strippedOffset = 0;
        if (disguisedSegment && !isIsoBmff && combined.length > 0 && combined[0] !== 0x47) {
          const limit = Math.min(combined.length - 189, 4096);
          for (let i = 1; i <= limit; i += 1) {
            if (combined[i] === 0x47 && combined[i + 188] === 0x47) {
              strippedOffset = i;
              break;
            }
          }
          if (strippedOffset > 0) {
            combined = combined.subarray(strippedOffset);
          }
        }

        if (!headersFlushed) {
          headersFlushed = true;
          if (isIsoBmff) {
            res.setHeader('Content-Type', 'video/mp4');
          } else if (disguisedSegment) {
            res.setHeader('Content-Type', 'video/mp2t');
          } else if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          if (contentLength && strippedOffset === 0) {
            res.setHeader('Content-Length', contentLength);
          } else if (contentLength && strippedOffset > 0) {
            const adjusted = Math.max(0, Number(contentLength) - strippedOffset);
            if (Number.isFinite(adjusted) && adjusted > 0) {
              res.setHeader('Content-Length', String(adjusted));
            }
          }
          res.status(response.status);
        }

        if (combined.length > 0 && !res.writableEnded) {
          if (!res.write(combined)) {
            nodeStream.pause();
          }
        }
      };

      nodeStream.on('data', (rawChunk: Buffer | Uint8Array) => {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        if (collectingDisguisedPlaylist) {
          headChunks.push(chunk);
          headBytes += chunk.length;
          if (headBytes > 4 * 1024 * 1024) {
            sendRawBufferedError(502, 'Disguised playlist exceeded maximum size');
          }
          return;
        }
        if (!firstChunkHandled) {
          headChunks.push(chunk);
          headBytes += chunk.length;
          const probeBuf = headChunks.length === 1 ? chunk : Buffer.concat(headChunks);
          const probeUtf8 = probeBuf.subarray(0, 64).toString('utf8').replace(/^\uFEFF/, '').trimStart();
          if (probeUtf8.startsWith('#EXTM3U')) {
            collectingDisguisedPlaylist = true;
            return;
          }
          if (/^<!doctype|^<html|^<head|^<body|^\{"error"/i.test(probeUtf8)) {
            sendRawBufferedError(502, 'Upstream returned HTML or JSON error instead of video stream');
            return;
          }
          const isIsoBmff =
            probeBuf.length >= 8 &&
            ['ftyp', 'styp', 'moof', 'sidx', 'emsg'].includes(probeBuf.subarray(4, 8).toString('ascii'));
          if (isIsoBmff || !disguisedSegment) {
            if (probeBuf.length >= 32) {
              flushInitialChunks();
            }
            return;
          }
          let hasSync = probeBuf.length > 0 && probeBuf[0] === 0x47;
          if (!hasSync && probeBuf.length >= 189) {
            const scanLimit = Math.min(probeBuf.length - 189, 4096);
            for (let i = 1; i <= scanLimit; i += 1) {
              if (probeBuf[i] === 0x47 && probeBuf[i + 188] === 0x47) {
                hasSync = true;
                break;
              }
            }
          }
          if (hasSync || headBytes >= 4096) {
            flushInitialChunks();
          }
          return;
        }
        if (!res.writableEnded) {
          if (!res.write(chunk)) {
            nodeStream.pause();
          }
        }
      });

      res.on('drain', () => {
        if (!nodeStream.destroyed) nodeStream.resume();
      });
      nodeStream.on('end', () => {
        if (collectingDisguisedPlaylist) {
          const fullText = Buffer.concat(headChunks).toString('utf8').replace(/^\uFEFF/, '');
          headChunks.length = 0;
          if (!fullText.includes('#EXTM3U')) {
            if (!res.headersSent && !res.writableEnded) {
              res.status(502).json({ error: 'Upstream returned an invalid disguised HLS playlist' });
            }
            return;
          }
          const finalUrl = response.url || targetUrl;
          const rewritten = rewriteM3u8Playlist(fullText, finalUrl, hParam);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          if (!res.writableEnded) {
            res.status(response.status).send(rewritten);
          }
          return;
        }
        if (!firstChunkHandled) {
          flushInitialChunks();
        }
        if (!headersFlushed && !res.headersSent) {
          headersFlushed = true;
          if (disguisedSegment) res.setHeader('Content-Type', 'video/mp2t');
          else if (contentType) res.setHeader('Content-Type', contentType);
          res.status(response.status);
        }
        if (!res.writableEnded) res.end();
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        if (!res.writableEnded) res.end();
      });
      res.on('close', () => {
        nodeStream.destroy();
      });
    } catch (err) {
      clearTimeout(connectTimeout);
      if (!res.headersSent && !clientClosed) {
        const msg = err instanceof Error ? err.message : 'Stream proxy error';
        res.status(502).json({ error: msg });
      }
    }
  });

  // Initialize P2P swarm, discover peers/seeds, prioritize header+tail & start sequential pre-buffering
  app.all('/api/torrent/prepare', async (req, res) => {
    const infoHash = String(req.query.infoHash || (req.body as Record<string, unknown>)?.infoHash || '').trim();
    const fileIdxRaw = req.query.fileIdx ?? (req.body as Record<string, unknown>)?.fileIdx;
    const fileIdxParam = fileIdxRaw !== undefined && fileIdxRaw !== '' ? Number(fileIdxRaw) : -1;
    const seasonParam = req.query.season ? Number(req.query.season) : undefined;
    const episodeParam = req.query.episode ? Number(req.query.episode) : undefined;
    const trParam = String(req.query.tr || (req.body as Record<string, unknown>)?.tr || '');
    const isP2P = req.query.p2p !== '0';
    const prebufferMb = Number(req.query.prebufferMb || 10);

    if (!/^[a-fA-F0-9]{40}$/.test(infoHash)) {
      return res.status(400).json({ error: 'Invalid infoHash' });
    }

    try {
      const extraTrackers = trParam
        ? trParam.split(',').map((t) => t.trim()).filter((t) => t.startsWith('udp://') || t.startsWith('http'))
        : [];
      const entry = await getReadyTorrentEntry(infoHash, extraTrackers);
      const found = findTargetTorrentFile(entry.engine, fileIdxParam, seasonParam, episodeParam);
      if (!found) {
        return res.status(404).json({ error: 'No playable video file found in torrent' });
      }
      const state = prepareTorrentFile(entry, found.fileIdx, found.file, isP2P, prebufferMb);
      res.json({ ready: true, ...getTorrentPrebufferStatus(entry, state) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to prepare torrent';
      res.status(504).json({ error: msg });
    }
  });

  // Return real-time P2P swarm peers, seeders, pre-buffer progress & speed
  app.get('/api/torrent/status', (req, res) => {
    const infoHash = String(req.query.infoHash || '').trim().toLowerCase();
    const fileIdxParam = req.query.fileIdx !== undefined && req.query.fileIdx !== '' ? Number(req.query.fileIdx) : -1;
    const seasonParam = req.query.season ? Number(req.query.season) : undefined;
    const episodeParam = req.query.episode ? Number(req.query.episode) : undefined;
    const prebufferMb = Number(req.query.prebufferMb || 10);

    const entry = activeTorrents.get(infoHash);
    if (!entry) {
      return res.status(404).json({ error: 'Torrent session not active' });
    }
    entry.lastUsedAt = Date.now();
    if (!entry.ready) {
      const wires = entry.engine.swarm?.wires?.length || 0;
      return res.json({
        infoHash,
        ready: false,
        peers: wires,
        seeders: 0,
        speedKbps: 0,
        prebufferMb,
        prebufferedBytes: 0,
        targetBytes: Math.max(5, Math.min(30, prebufferMb)) * 1024 * 1024,
        headReady: false,
        tailReady: false,
        progressPct: 0,
        readyToPlay: false,
      });
    }

    const found = findTargetTorrentFile(entry.engine, fileIdxParam, seasonParam, episodeParam);
    if (!found) {
      return res.status(404).json({ error: 'No video file in torrent' });
    }
    const state =
      entry.preparedFiles.get(found.fileIdx) ||
      prepareTorrentFile(entry, found.fileIdx, found.file, req.query.p2p !== '0', prebufferMb);
    res.json({ ready: true, ...getTorrentPrebufferStatus(entry, state) });
  });

  // Stream BitTorrent (Torrentio & P2P addons) directly over HTTP 206 with persistent pre-buffering, seek re-prioritization & MKV remux
  app.get('/api/torrent/stream', async (req, res) => {
    const infoHash = String(req.query.infoHash || '').trim();
    const fileIdxParam = req.query.fileIdx !== undefined && req.query.fileIdx !== '' ? Number(req.query.fileIdx) : -1;
    const seasonParam = req.query.season ? Number(req.query.season) : undefined;
    const episodeParam = req.query.episode ? Number(req.query.episode) : undefined;
    const trParam = String(req.query.tr || '');
    const remuxParam = req.query.remux === '1';
    const rawParam = req.query.raw === '1';
    const isHevc = req.query.hevc === '1';
    const langParam = String(req.query.lang || '').trim();
    const seekSec = req.query.ss ? Number(req.query.ss) : req.query.t ? Number(req.query.t) : 0;
    const isP2P = req.query.p2p !== '0';
    const prebufferMb = Number(req.query.prebufferMb || 10);

    if (!/^[a-fA-F0-9]{40}$/.test(infoHash)) {
      return res.status(400).json({ error: 'Invalid infoHash' });
    }

    let activeEntryRef: ActiveTorrentEntry | null = null;
    let streamDecremented = false;
    const releaseActiveStream = () => {
      if (!streamDecremented && activeEntryRef) {
        streamDecremented = true;
        activeEntryRef.activeStreams = Math.max(0, activeEntryRef.activeStreams - 1);
        activeEntryRef.lastUsedAt = Date.now();
      }
    };

    try {
      const extraTrackers = trParam
        ? trParam.split(',').map((t) => t.trim()).filter((t) => t.startsWith('udp://') || t.startsWith('http'))
        : [];
      const entry = await getReadyTorrentEntry(infoHash, extraTrackers);
      activeEntryRef = entry;
      entry.activeStreams += 1;
      res.on('close', releaseActiveStream);
      res.on('finish', releaseActiveStream);

      const found = findTargetTorrentFile(entry.engine, fileIdxParam, seasonParam, episodeParam);
      if (!found) {
        releaseActiveStream();
        return res.status(404).json({ error: 'No playable video file found in torrent' });
      }

      const targetFile = found.file;
      const state = prepareTorrentFile(entry, found.fileIdx, targetFile, isP2P, prebufferMb);

      const needsRemux = !rawParam && (remuxParam || /\.(mkv|avi)$/i.test(targetFile.name));
      if (needsRemux) {
        const localRawUrl = `http://127.0.0.1:${PORT}/api/torrent/stream?infoHash=${encodeURIComponent(infoHash)}&fileIdx=${found.fileIdx}&raw=1&p2p=${isP2P ? '1' : '0'}&prebufferMb=${state.prebufferMb}`;
        if (req.method === 'HEAD') {
          let probed = containerProbeCache.get(localRawUrl) || null;
          if (!probed && entry.engine.bitfield?.get(state.fileStartPiece)) {
            probed = await probeContainerInfoAsync(localRawUrl, undefined, 2500);
          }
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'X-Content-Duration, Accept-Ranges, Content-Length, Content-Range, Content-Type'
          );
          if (probed?.durationSeconds && Number.isFinite(probed.durationSeconds)) {
            res.setHeader('X-Content-Duration', String(Math.round(probed.durationSeconds)));
          }
          releaseActiveStream();
          return res.status(200).end();
        }
        // Cap pre-FFmpeg piece wait at 3000ms so remux never stalls when header piece arrives
        if (!entry.engine.bitfield?.get(state.fileStartPiece)) {
          await new Promise<void>((resolve) => {
            const maxWait = setTimeout(() => {
              entry.engine.off?.('verify', onVerify);
              resolve();
            }, 3000);
            const onVerify = (pieceIdx: unknown) => {
              if (pieceIdx === state.fileStartPiece) {
                clearTimeout(maxWait);
                entry.engine.off?.('verify', onVerify);
                resolve();
              }
            };
            entry.engine.on('verify', onVerify);
          });
        }
        return pipeStreamThroughFfmpegRemux(localRawUrl, res, isHevc, undefined, langParam, seekSec);
      }

      // Trigger background pieces download now that stream playback has begun
      if (isP2P && state.preEndPiece < state.fileEndPiece) {
        try {
          entry.engine.select?.(state.preEndPiece + 1, state.fileEndPiece, 1);
        } catch {}
      }

      const fileSize = targetFile.length;
      const rangeHeader = req.headers.range;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Content-Duration'
      );
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Content-Type', targetFile.name.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4');

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', String(fileSize));
        releaseActiveStream();
        return res.status(200).end();
      }

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? Math.min(fileSize - 1, parseInt(match[2], 10)) : fileSize - 1;
          if (start >= fileSize || start > end) {
            res.setHeader('Content-Range', `bytes */${fileSize}`);
            releaseActiveStream();
            return res.status(416).end();
          }

          // Re-prioritize pieces immediately on seek / tail moov read
          if (isP2P) {
            prioritizeTorrentSeek(entry, state, start);
          }

          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.setHeader('Content-Length', String(end - start + 1));

          const rs = targetFile.createReadStream({ start, end });
          rs.on('error', () => {
            if (!res.writableEnded) res.end();
          });
          res.on('close', () => {
            if ('destroy' in rs && typeof rs.destroy === 'function') {
              try { (rs as Readable).destroy(); } catch {}
            }
          });
          return rs.pipe(res);
        }
      }

      if (isP2P) {
        prioritizeTorrentSeek(entry, state, 0);
      }

      res.status(200);
      res.setHeader('Content-Length', String(fileSize));
      const rs = targetFile.createReadStream({ start: 0, end: fileSize - 1 });
      rs.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      res.on('close', () => {
        if ('destroy' in rs && typeof rs.destroy === 'function') {
          try { (rs as Readable).destroy(); } catch {}
        }
      });
      rs.pipe(res);
    } catch (err) {
      releaseActiveStream();
      const msg = err instanceof Error ? err.message : 'Torrent stream error';
      if (!res.headersSent) res.status(504).json({ error: msg });
    }
  });

  // Clear server-side Nuvio manifest/script/stream caches when add-ons are installed or updated
  app.all('/api/nuvio/cache/clear', (req, res) => {
    const manifestUrl = typeof req.query.manifestUrl === 'string' ? req.query.manifestUrl.trim() : '';
    if (manifestUrl) {
      manifestCache.delete(manifestUrl);
      const base = manifestUrl.replace(/\/manifest\.json.*$/, '');
      for (const key of Array.from(scriptCache.keys())) {
        if (key.startsWith(base)) scriptCache.delete(key);
      }
      for (const key of Array.from(streamsResultCache.keys())) {
        if (key.includes(`::${manifestUrl}::`)) streamsResultCache.delete(key);
      }
    } else {
      manifestCache.clear();
      scriptCache.clear();
      streamsResultCache.clear();
    }
    res.json({ ok: true });
  });

  // Fetch Nuvio repository manifest
  app.get('/api/nuvio/manifest', async (req, res) => {
    const manifestUrl = (req.query.url as string) || DEFAULT_NUVIO_MANIFEST;
    const refresh = req.query.refresh === '1';
    try {
      if (refresh) {
        const base = manifestUrl.replace(/\/manifest\.json.*$/, '');
        for (const key of Array.from(scriptCache.keys())) {
          if (key.startsWith(base)) scriptCache.delete(key);
        }
        for (const key of Array.from(streamsResultCache.keys())) {
          if (key.includes(`::${manifestUrl}::`)) streamsResultCache.delete(key);
        }
      }
      const manifest = await fetchNuvioManifest(manifestUrl, refresh);
      res.json({
        manifestUrl,
        baseUrl: manifestUrl.replace(/\/manifest\.json.*$/, ''),
        name: manifest.name,
        version: manifest.version,
        scrapers: manifest.scrapers,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load Nuvio manifest';
      res.status(500).json({ error: msg });
    }
  });

  // Execute enabled Nuvio scrapers and return directly playable proxied streams + subtitles
  app.get('/api/nuvio/streams', async (req, res) => {
    const tmdbId = String(req.query.tmdbId || '');
    const mediaType = req.query.mediaType === 'tv' ? 'tv' : 'movie';
    const season = req.query.season ? Number(req.query.season) : 1;
    const episode = req.query.episode ? Number(req.query.episode) : 1;
    const manifestUrl = (req.query.manifestUrl as string) || DEFAULT_NUVIO_MANIFEST;
    const refresh = req.query.refresh === '1';
    const isFastLane = req.query.lane === 'fast';
    const excludeFast = !isFastLane && req.query.excludeFast === '1';
    const skipCb = req.query.skipCb === '1';
    const idsParam = (req.query.ids as string) || '';
    const requestedIds = idsParam
      ? new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))
      : null;
    const disabledIdsParam = (req.query.disabledIds as string) || '';
    const disabledIdsSet = disabledIdsParam
      ? new Set(disabledIdsParam.split(',').map((s) => s.trim()).filter(Boolean))
      : null;

    if (!tmdbId || Number.isNaN(Number(tmdbId))) {
      return res.json({ sources: [], subtitles: [], scraperResults: [] });
    }

    const cacheKey = `v9::${isFastLane ? 'fast' : excludeFast ? 'rest' : 'full'}::${skipCb ? 'nocb' : 'cb'}::${manifestUrl}::${tmdbId}::${mediaType}::${season}::${episode}::${idsParam}::${disabledIdsParam}`;
    if (!refresh) {
      const cachedStreamRes = streamsResultCache.get(cacheKey);
      if (cachedStreamRes && Date.now() - cachedStreamRes.fetchedAt < 4 * 60 * 1000) {
        return res.json(cachedStreamRes.payload);
      }
    }

    const fallbackTitle = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const fallbackYear = req.query.year ? Number(req.query.year) : null;
    try {
      const repoTag = Buffer.from(manifestUrl)
        .toString('base64url')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6) || 'def';
      const shouldFetchCb = !requestedIds && !skipCb && manifestUrl === DEFAULT_NUVIO_MANIFEST;
      const [manifest, fetchedTmdbMeta, cbManifest] = await Promise.all([
        fetchNuvioManifest(manifestUrl),
        fetchTmdbTitleMeta(tmdbId, mediaType, undefined, season, episode),
        shouldFetchCb ? fetchNuvioManifest(CB_PROVIDERS_MANIFEST).catch(() => null) : Promise.resolve(null),
      ]);
      const tmdbMeta: TmdbTitleMeta | null =
        fetchedTmdbMeta ||
        (fallbackTitle
          ? {
              title: fallbackTitle,
              originalTitle: fallbackTitle,
              year: Number.isFinite(fallbackYear) ? fallbackYear : null,
              lastAirYear: null,
              episodeAirYear: null,
              runtimeMinutes: null,
              episodeRuntimeMinutes: null,
              genreIds: [],
              originalLanguage: '',
            }
          : null);
      const baseUrl = manifestUrl.replace(/\/manifest\.json.*$/, '');

      const isAnimationOrAnime = Boolean(
        !tmdbMeta ||
          tmdbMeta.genreIds.includes(16) ||
          tmdbMeta.originalLanguage === 'ja'
      );
      const isAsianDrama = Boolean(
        !tmdbMeta ||
          ['ko', 'zh', 'th', 'ja'].includes(tmdbMeta.originalLanguage)
      );

      const primaryScrapers: NuvioScraperMeta[] = manifest.scrapers
        .filter((s) => {
          if (s.enabled === false) return false;
          if (disabledIdsSet && disabledIdsSet.has(s.id)) return false;
          if (requestedIds && !requestedIds.has(s.id)) return false;
          const sIdLower = s.id.toLowerCase();
          if (tmdbMeta?.originalLanguage === 'hi' && (sIdLower.includes('purstream') || sIdLower.includes('movix'))) {
            return false;
          }
          if (!requestedIds) {
            if (!isAnimationOrAnime && ANIME_CARTOON_SCRAPER_IDS.has(s.id)) return false;
            if (!isAsianDrama && ASIAN_DRAMA_SCRAPER_IDS.has(s.id)) return false;
          }
          if (s.supportedTypes && s.supportedTypes.length > 0) {
            const supportsType =
              s.supportedTypes.includes(mediaType) ||
              (isAnimationOrAnime && s.supportedTypes.includes('anime'));
            if (!supportsType) return false;
          }
          return true;
        })
        .map((s) => ({ ...s, _baseUrl: baseUrl }));

      let extraCbScrapers: NuvioScraperMeta[] = [];
      if (cbManifest) {
        const cbBase = CB_PROVIDERS_MANIFEST.replace(/\/manifest\.json.*$/, '');
        extraCbScrapers = cbManifest.scrapers
          .filter((s) => CB_HINDI_SCRAPER_IDS.has(s.id))
          .map((s) => ({
            ...s,
            id: `cb-${s.id}`,
            name: s.name,
            _baseUrl: cbBase,
          }));
      }

      const FAST_LANE_SCRAPER_IDS = new Set([
        'castle',
        'cb-castle',
        'desiflix',
        'cb-desiflix',
        'netmirror',
        'cb-netmirror',
        'einthusan',
        'cb-einthusan',
        'hindmoviez',
        'cb-hindmoviez',
        'moviesdrive',
        'cb-moviesdrive',
        '4khdhub',
        'cb-4khdhub',
        'hdhub4u',
        'cb-hdhub4u',
        'vegamovies',
        'cb-vegamovies',
        'nuvio-vegamovies',
        'multimovies',
        'cb-multimovies',
        'moviesmod',
        'cb-moviesmod',
        'playimdb',
        'cb-playimdb',
        'moviebox',
        'cb-moviebox',
        'movieblast',
        'cb-movieblast',
        'movies4u',
        'allmovieland',
        'cb-allmovieland',
        'cinemacity',
        'cinestream',
        'flixindia',
        'hdmovie2',
        'streamflix',
        'cb-streamflix',
        'uhdmovies',
        'cb-uhdmovies',
        'toonstream',
        'cb-toonstream',
        'puretoons',
        'cb-puretoons',
        'toonhub',
        'animelok',
        'animeworld',
        'cb-animeworld',
        'animesalt',
        'cb-animesalt',
        'animedekho',
        'zinkmovies',
        'xdmovies',
        'dooflix',
        'ctgmovies',
        'cb-ctgmovies',
        'moonflix',
        'peachify',
        'cb-peachify',
        'gramcinema',
        'cb-gramcinema',
        'hdghartv',
        'cb-hdghartv',
        'fibwatch',
        'cb-fibwatch',
        'xpass',
        '1shows',
        'vidrock',
        'dahmermovies',
        'dahmermovies-tv',
        'redflix',
        'vidlink',
        'vixsrc',
        'vidfast',
        'videasy',
        'movix',
        'movix-vf',
        'purstream',
      ]);

      const combinedScrapers = [...primaryScrapers, ...extraCbScrapers];
      const scrapersToRun = isFastLane
        ? combinedScrapers.filter((s) => FAST_LANE_SCRAPER_IDS.has(s.id.toLowerCase()))
        : excludeFast
        ? combinedScrapers.filter((s) => !FAST_LANE_SCRAPER_IDS.has(s.id.toLowerCase()))
        : combinedScrapers;

      interface CandidateSource {
        id: string;
        providerName: string;
        label: string;
        quality: string;
        url: string;
        format: 'hls' | 'mp4';
        audioLanguage: string;
        note: string;
        isDirectPlayable: boolean;
        _cleanName: string;
        _rawUrl: string;
        _rawHeaders?: Record<string, string>;
        _isMkv?: boolean;
        _isHevc?: boolean;
        _detectedLangs: string[];
        _probedAudioCount?: number;
        _firstAudioLang?: string;
        _subtitles?: Array<{
          id: string;
          label: string;
          language: string;
          url: string;
          format: 'vtt' | 'srt';
        }>;
      }

      const candidates: CandidateSource[] = [];
      const globalSeenRawUrls = new Set<string>();

      const allSubtitles: Array<{
        id: string;
        label: string;
        language: string;
        url: string;
        format: 'vtt' | 'srt';
      }> = [];

      const scraperResults: Array<{
        id: string;
        name: string;
        status: 'ok' | 'empty' | 'error';
        count: number;
      }> = [];

      const scraperFetchTimeout = isFastLane ? 2800 : 3500;
      const scraperExecTimeout = isFastLane ? 5200 : 8000;

      await Promise.allSettled(
        scrapersToRun.map(async (scraper) => {
          try {
            const scriptUrl = `${scraper._baseUrl || baseUrl}/${scraper.filename}`;
            const code = await fetchScraperCode(scriptUrl, scraperFetchTimeout, 1);
            const scraperLogs: string[] = [];
            const exportsObj = compileScraperModule(code, (msg) => {
              if (scraperLogs.length < 40) scraperLogs.push(msg);
            });
            const getStreams = exportsObj.getStreams as
              | ((
                  id: string,
                  type: string,
                  season?: number,
                  episode?: number
                ) => Promise<NuvioRawStream[]>)
              | undefined;

            if (typeof getStreams !== 'function') {
              scraperResults.push({ id: scraper.id, name: scraper.name, status: 'error', count: 0 });
              return;
            }

            const rawStreams = await Promise.race([
              getStreams(tmdbId, mediaType, season, episode),
              new Promise<NuvioRawStream[]>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), scraperExecTimeout)
              ),
            ]);

            if (!Array.isArray(rawStreams) || rawStreams.length === 0) {
              scraperResults.push({ id: scraper.id, name: scraper.name, status: 'empty', count: 0 });
              return;
            }

            // Reject search-based scrapers (e.g. Castle) that fell back to an unrelated rows[0] result
            // like "Pokémon: The Movie 2000" or matched a spin-off/sequel (e.g. "Dexter: Resurrection" for "Dexter")
            const usedBlindFirstFallback = scraperLogs.some((line) =>
              /\b(using first result|fallback to first|using default result)\b/i.test(line)
            );
            if (usedBlindFirstFallback) {
              scraperResults.push({ id: scraper.id, name: scraper.name, status: 'empty', count: 0 });
              return;
            }
            for (const logLine of scraperLogs) {
              const matchCapture = logLine.match(
                /(?:found match|matched title|matched media|selected(?:\s+match|\s+result)?|using result)\s*:\s*(.+)$/i
              );
              if (matchCapture?.[1]) {
                const rawMatchedTitle = matchCapture[1].replace(/\s*\(id:\s*[^)]+\)\s*$/i, '').trim();
                if (!isStrictScraperMatchedTitle(rawMatchedTitle, tmdbMeta, mediaType)) {
                  scraperResults.push({ id: scraper.id, name: scraper.name, status: 'empty', count: 0 });
                  return;
                }
              }
            }

            let playableCount = 0;
            const seenUrls = new Set<string>();
            const MAX_PER_SCRAPER = 10;

            rawStreams.forEach((raw, idx) => {
              if (playableCount >= MAX_PER_SCRAPER) return;
              const streamUrl = raw?.url?.trim();
              if (
                !streamUrl ||
                (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) ||
                seenUrls.has(streamUrl) ||
                globalSeenRawUrls.has(streamUrl)
              ) {
                return;
              }
              // Filter out Purstream/Movix wrong TMDB ID fallbacks
              if (streamUrl.includes('free.finepulfe.xyz')) {
                const idMatch = streamUrl.match(/free\.finepulfe\.xyz\/(?:movies|tv)\/(\d+)-/i);
                if (idMatch && idMatch[1] && idMatch[1] !== tmdbId) {
                  return;
                }
              }

              const rawText = [raw.name, raw.title, raw.description, raw.quality]
                .filter(Boolean)
                .join(' ');

              if (!isStreamTitleRelevant(rawText, streamUrl, tmdbMeta, scraper.id, mediaType, season, episode)) {
                return;
              }

              seenUrls.add(streamUrl);
              globalSeenRawUrls.add(streamUrl);

              playableCount += 1;
              const quality = extractQuality(raw.quality || rawText);
              let detectedLangs = extractAudioLanguages(raw, scraper);
              if (
                tmdbMeta?.originalLanguage === 'hi' &&
                !scraper.id.toLowerCase().includes('vidrock') &&
                detectedLangs.length === 1 &&
                detectedLangs[0] === 'Original'
              ) {
                detectedLangs = ['Hindi'];
              }
              const primaryLang = detectedLangs[0] || 'Original';
              const cleanName = scraper.name.replace(/[^\p{L}\p{N}\s.\-_]/gu, '').trim() || scraper.name;
              let firstLine = (raw.title || raw.name || `${cleanName} Stream`)
                .split('\n')[0]
                .replace(/[^\p{L}\p{N}\s.\-_|()[\]:/]/gu, '')
                .trim();
              if (mediaType === 'movie') {
                firstLine = firstLine.replace(/\bS0?1\s*E0?1\b/gi, '').replace(/\s{2,}/g, ' ').trim();
              }
              firstLine = firstLine.slice(0, 90);

              const isHls =
                streamUrl.toLowerCase().includes('.m3u8') ||
                rawText.toUpperCase().includes('HLS') ||
                rawText.toUpperCase().includes('M3U8');

              const isLikelyMkvOrUnsupportedCodec =
                !isHls &&
                (streamUrl.toLowerCase().includes('.mkv') ||
                  /\b(\.mkv|x265|hevc|10bit|dts|truehd|ddp|eac3|remux)\b/i.test(rawText));
              const isHevc = /\b(x265|hevc|10bit)\b/i.test(rawText);

              const proxiedUrl = buildProxyUrl(streamUrl, raw.headers, {
                remux: isLikelyMkvOrUnsupportedCodec,
                hevc: isHevc,
                lang: primaryLang,
              });

              const candSubtitles: Array<{
                id: string;
                label: string;
                language: string;
                url: string;
                format: 'vtt' | 'srt';
              }> = [];
              if (Array.isArray(raw.subtitles)) {
                raw.subtitles.forEach((sub, subIdx) => {
                  const subUrl = sub.url || sub.file;
                  if (!subUrl || (!subUrl.startsWith('http://') && !subUrl.startsWith('https://'))) {
                    return;
                  }
                  const fmt = subUrl.toLowerCase().includes('.srt') ? 'srt' : 'vtt';
                  candSubtitles.push({
                    id: `nuvio-sub-${repoTag}-${scraper.id}-${idx}-${subIdx}`,
                    label: sub.label || sub.language || sub.lang || 'Subtitle',
                    language: sub.lang || sub.language || 'en',
                    url: buildProxyUrl(subUrl, raw.headers),
                    format: fmt,
                  });
                });
              }

              candidates.push({
                id: `nuvio-${repoTag}-${scraper.id}-${idx}`,
                providerName: `${cleanName} (Nuvio)`,
                label: firstLine || `${cleanName} · ${quality}`,
                quality,
                url: proxiedUrl,
                format: isHls ? 'hls' : 'mp4',
                audioLanguage: primaryLang,
                note: `Nuvio Scraper · ${cleanName} · ${primaryLang} · ${quality}`,
                isDirectPlayable: !isLikelyMkvOrUnsupportedCodec,
                _cleanName: cleanName,
                _rawUrl: streamUrl,
                _rawHeaders: raw.headers,
                _isMkv: isLikelyMkvOrUnsupportedCodec,
                _isHevc: isHevc,
                _detectedLangs: detectedLangs,
                _subtitles: candSubtitles,
              });
            });

            scraperResults.push({
              id: scraper.id,
              name: scraper.name,
              status: playableCount > 0 ? 'ok' : 'empty',
              count: playableCount,
            });
          } catch {
            scraperResults.push({ id: scraper.id, name: scraper.name, status: 'error', count: 0 });
          }
        })
      );

      const languagePriority = (lang: string): number => {
        const l = lang.toLowerCase();
        if (l.includes('hindi') || l.includes('bengali') || l.includes('tamil') || l.includes('telugu')) return 0;
        if (l.includes('dual') || l.includes('multi')) return 1;
        if (l === 'english' || l === 'english (dub)') return 2;
        if (l === 'original') return 3;
        return 4;
      };

      candidates.sort((a, b) => {
        const langDiff = languagePriority(a.audioLanguage) - languagePriority(b.audioLanguage);
        if (langDiff !== 0) return langDiff;
        const aMkv = a._isMkv ? 1 : 0;
        const bMkv = b._isMkv ? 1 : 0;
        if (aMkv !== bMkv) return aMkv - bMkv;
        return (a.format === 'hls' ? 0 : 1) - (b.format === 'hls' ? 0 : 1);
      });

      // Round-robin select candidates across all scrapers so one verbose scraper never starves other providers
      // Prioritize Hindi candidate sources when present
      const isHindiSource = (c: CandidateSource) =>
        /\b(hindi|hin)\b|🇮🇳/i.test(`${c.audioLanguage || ''} ${c.label}`);

      const hindiCandidates = candidates.filter(isHindiSource);
      const otherCandidates = candidates.filter((c) => !isHindiSource(c));

      const byScraper = new Map<string, CandidateSource[]>();
      // First populate Hindi candidates per scraper, then remaining candidates
      for (const c of [...hindiCandidates, ...otherCandidates]) {
        const list = byScraper.get(c._cleanName) || [];
        list.push(c);
        byScraper.set(c._cleanName, list);
      }
      const roundRobinCap = isFastLane ? 45 : 80;
      const roundRobinPool: CandidateSource[] = [];
      let roundIdx = 0;
      while (roundRobinPool.length < Math.min(candidates.length, roundRobinCap)) {
        let addedAny = false;
        for (const list of byScraper.values()) {
          if (roundIdx < list.length) {
            roundRobinPool.push(list[roundIdx]);
            addedAny = true;
            if (roundRobinPool.length >= roundRobinCap) break;
          }
        }
        if (!addedAny) break;
        roundIdx += 1;
      }

      // Probe candidates in parallel batches so dead/502 mirrors, HTML error pages, and wrong-type movie/TV leaks never reach UI
      const probedOk = new Set<string>();
      const rejectedUrls = new Set<string>();
      const expectedRuntimeMins =
        mediaType === 'tv'
          ? tmdbMeta?.episodeRuntimeMinutes || tmdbMeta?.runtimeMinutes || 45
          : tmdbMeta?.runtimeMinutes || null;

      const minExpectedSeconds =
        mediaType === 'movie'
          ? expectedRuntimeMins && expectedRuntimeMins < 45
            ? Math.max(4 * 60, Math.round(expectedRuntimeMins * 0.55 * 60))
            : expectedRuntimeMins
            ? Math.max(32 * 60, Math.round(expectedRuntimeMins * 0.65 * 60))
            : 28 * 60
          : expectedRuntimeMins && expectedRuntimeMins < 18
          ? Math.max(3 * 60, Math.round(expectedRuntimeMins * 0.5 * 60))
          : expectedRuntimeMins
          ? Math.max(12 * 60, Math.round(expectedRuntimeMins * 0.52 * 60))
          : 15 * 60;

      const maxExpectedTvSeconds =
        mediaType === 'tv'
          ? expectedRuntimeMins
            ? Math.max(90 * 60, Math.round(expectedRuntimeMins * 2.5 * 60))
            : 100 * 60
          : 0;

      const isDurationMismatched = (totalSec: number): boolean => {
        if (!totalSec || totalSec <= 0) return false;
        if (minExpectedSeconds > 0 && totalSec < minExpectedSeconds) return true;
        if (mediaType === 'tv' && maxExpectedTvSeconds > 0 && totalSec > maxExpectedTvSeconds) {
          return true;
        }
        if (mediaType === 'movie' && tmdbMeta?.runtimeMinutes && tmdbMeta.runtimeMinutes >= 45) {
          const streamMins = totalSec / 60;
          const maxDelta = Math.max(22, tmdbMeta.runtimeMinutes * 0.28);
          if (Math.abs(streamMins - tmdbMeta.runtimeMinutes) > maxDelta) {
            return true;
          }
        }
        return false;
      };

      const probeStartTime = Date.now();
      const probeCandidate = async (cand: CandidateSource) => {
        try {
          const headers: Record<string, string> = {
            'User-Agent': DEFAULT_UA,
            ...(cand._rawHeaders || {}),
          };
          if (cand.format !== 'hls') {
            headers['Range'] = 'bytes=0-1023';
          }

          let probeRes = await fetch(cand._rawUrl, {
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(isFastLane ? 2000 : 2600),
          });

          // Some CDNs reject tiny Range headers with 416/405 — retry once without Range
          if ((probeRes.status === 416 || probeRes.status === 405) && headers['Range']) {
            const noRangeHeaders = { ...headers };
            delete noRangeHeaders['Range'];
            probeRes = await fetch(cand._rawUrl, {
              method: 'HEAD',
              headers: noRangeHeaders,
              redirect: 'follow',
              signal: AbortSignal.timeout(1800),
            });
          }

          const ct = (probeRes.headers.get('content-type') || '').toLowerCase();
          if (probeRes.status >= 400 || ct.includes('text/html') || ct.includes('application/json')) {
            void probeRes.body?.cancel();
            rejectedUrls.add(cand.id);
            return;
          }

          // Inspect Content-Disposition filename for episode leaks or wrong movies
          const disp = probeRes.headers.get('content-disposition') || '';
          const dispMatch = disp.match(/filename="?([^";]+)"?/i);
          if (dispMatch) {
            const dispFilename = dispMatch[1].trim();
            if (
              mediaType === 'movie' &&
              /\b(s\d{1,2}e\d{1,2}|episode\s*\d+|s\d{1,2}\s*ep?\s*\d+)\b/i.test(dispFilename)
            ) {
              void probeRes.body?.cancel();
              rejectedUrls.add(cand.id);
              return;
            }
            if (!isStreamTitleRelevant(dispFilename, probeRes.url || cand._rawUrl, tmdbMeta, cand.id, mediaType, season, episode)) {
              void probeRes.body?.cancel();
              rejectedUrls.add(cand.id);
              return;
            }
          }

          if (ct.includes('matroska') || ct.includes('x-matroska')) {
            cand._isMkv = true;
            cand.isDirectPlayable = false;
          }
          if (ct.includes('mpegurl') || ct.includes('m3u8')) {
            if (cand.format !== 'hls' && headers['Range']) {
              void probeRes.body?.cancel();
              const fullHeaders = { ...headers };
              delete fullHeaders['Range'];
              probeRes = await fetch(cand._rawUrl, {
                headers: fullHeaders,
                redirect: 'follow',
                signal: AbortSignal.timeout(isFastLane ? 2000 : 2500),
              });
              if (probeRes.status >= 400) {
                void probeRes.body?.cancel();
                rejectedUrls.add(cand.id);
                return;
              }
            }
            cand.format = 'hls';
          } else if (cand.format !== 'hls') {
            // Confirm first bytes are not an HTML error page AND inspect Matroska EBML magic bytes (1A 45 DF A3)
            const buf = Buffer.from(await probeRes.arrayBuffer());
            const headText = buf.subarray(0, 160).toString('utf8').trimStart().toLowerCase();
            if (
              buf.length === 0 ||
              headText.startsWith('<!doctype') ||
              headText.startsWith('<html') ||
              headText.startsWith('{"error') ||
              headText.includes('access denied') ||
              headText.includes('403 forbidden')
            ) {
              rejectedUrls.add(cand.id);
              return;
            }
            if (
              buf.length >= 4 &&
              buf[0] === 0x1a &&
              buf[1] === 0x45 &&
              buf[2] === 0xdf &&
              buf[3] === 0xa3
            ) {
              cand._isMkv = true;
              cand.isDirectPlayable = false;
            }
          }

          // Verify HLS playlist is valid #EXTM3U, resolve variant playlist, probe first media segment, inspect real audio tracks, and check runtime
          if (cand.format === 'hls') {
            const m3u8Text = await probeRes.text();
            if (!m3u8Text.includes('#EXTM3U')) {
              rejectedUrls.add(cand.id);
              return;
            }

            // Inspect real #EXT-X-MEDIA:TYPE=AUDIO tracks when HLS master playlist declares audio languages
            const hlsMediaLines = m3u8Text
              .split(/\r?\n/)
              .filter((l) => /^#EXT-X-MEDIA:/i.test(l) && /TYPE=AUDIO/i.test(l));
            if (hlsMediaLines.length > 0) {
              const hlsLangs: string[] = [];
              for (const ml of hlsMediaLines) {
                const langAttr = ml.match(/LANGUAGE="([^"]+)"/i)?.[1] || '';
                const nameAttr = ml.match(/NAME="([^"]+)"/i)?.[1] || '';
                const normalized = normalizeSingleLangToken(langAttr) || normalizeSingleLangToken(nameAttr);
                if (normalized && !hlsLangs.includes(normalized)) {
                  hlsLangs.push(normalized);
                }
              }
              if (hlsLangs.length > 0) {
                cand._detectedLangs = hlsLangs;
                cand.audioLanguage = hlsLangs[0];
              }
            }

            let mediaText = m3u8Text;
            let mediaBaseUrl = probeRes.url || cand._rawUrl;

            if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
              const lines = m3u8Text.split(/\r?\n/);
              let variantPath = '';
              for (let i = 0; i < lines.length; i += 1) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                  const nextLine = (lines[i + 1] || '').trim();
                  if (nextLine && !nextLine.startsWith('#')) {
                    variantPath = nextLine;
                    break;
                  }
                }
              }
              if (!variantPath) {
                rejectedUrls.add(cand.id);
                return;
              }
              const variantUrl = new URL(variantPath, mediaBaseUrl).toString();
              const varHeaders = {
                'User-Agent': DEFAULT_UA,
                ...(cand._rawHeaders || {}),
              };
              const varRes = await fetch(variantUrl, {
                headers: varHeaders,
                redirect: 'follow',
                signal: AbortSignal.timeout(isFastLane ? 1600 : 2200),
              });
              if (!varRes.ok) {
                rejectedUrls.add(cand.id);
                return;
              }
              mediaText = await varRes.text();
              if (!mediaText.includes('#EXTM3U')) {
                rejectedUrls.add(cand.id);
                return;
              }
              mediaBaseUrl = varRes.url || variantUrl;
            }

            // Probe first media segment to make sure segment CDN doesn't return 403/404/502 HTML
            const firstSegLine = mediaText
              .split(/\r?\n/)
              .map((l) => l.trim())
              .find((l) => Boolean(l) && !l.startsWith('#'));

            if (!firstSegLine) {
              rejectedUrls.add(cand.id);
              return;
            }

            const firstSegUrl = new URL(firstSegLine, mediaBaseUrl).toString();
            const segRes = await fetch(firstSegUrl, {
              headers: {
                'User-Agent': DEFAULT_UA,
                ...(cand._rawHeaders || {}),
                Range: 'bytes=0-511',
              },
              redirect: 'follow',
              signal: AbortSignal.timeout(isFastLane ? 1600 : 2200),
            });
            const segCt = (segRes.headers.get('content-type') || '').toLowerCase();
            if (segRes.status >= 400 || segCt.includes('text/html') || segCt.includes('application/json')) {
              void segRes.body?.cancel();
              rejectedUrls.add(cand.id);
              return;
            }
            const segBuf = Buffer.from(await segRes.arrayBuffer());
            const segHead = segBuf.subarray(0, 96).toString('utf8').trimStart().toLowerCase();
            if (segHead.startsWith('<!doctype') || segHead.startsWith('<html') || segHead.startsWith('{"error')) {
              rejectedUrls.add(cand.id);
              return;
            }

            const segMatches = Array.from(mediaText.matchAll(/#EXTINF:([\d.]+)/g));
            if (segMatches.length > 0) {
              const totalSec = segMatches.reduce((acc, m) => acc + parseFloat(m[1] || '0'), 0);
              const isNetMirrorHls =
                cand.id.toLowerCase().includes('netmirror') ||
                cand._rawUrl.includes('imgcdn.kim') ||
                cand._rawUrl.includes('freecdn4.top');
              if (totalSec > 0) {
                if (!isNetMirrorHls && isDurationMismatched(totalSec)) {
                  rejectedUrls.add(cand.id);
                  return;
                }
                if (!isNetMirrorHls || totalSec > 620) {
                  const mins = Math.round(totalSec / 60);
                  cand.label = `${cand.label} (${mins}m)`;
                }
              }
            }
          } else if (!isFastLane && Date.now() - probeStartTime < 2200) {
            // Probe actual MKV/MP4 audio tracks and duration with ffprobe only within fast budget
            const probedInfo = await probeContainerInfoAsync(cand._rawUrl, cand._rawHeaders, 1800);
            if (probedInfo) {
              if (probedInfo.durationSeconds && isDurationMismatched(probedInfo.durationSeconds)) {
                rejectedUrls.add(cand.id);
                return;
              }
              if (probedInfo.audioTracks.length > 0) {
                cand._probedAudioCount = probedInfo.audioTracks.length;
                cand._firstAudioLang = probedInfo.audioTracks[0]?.displayLang || '';
                if (probedInfo.isHevc) {
                  cand._isHevc = true;
                  cand._isMkv = true;
                  cand.isDirectPlayable = false;
                }
                const realLangs = Array.from(
                  new Set(probedInfo.audioTracks.map((t) => t.displayLang).filter(Boolean))
                );
                if (realLangs.length > 0) {
                  cand._detectedLangs = realLangs;
                  cand.audioLanguage = realLangs[0];
                }
              }
            }
          }

          probedOk.add(cand.id);
        } catch {
          rejectedUrls.add(cand.id);
        }
      };

      const PROBE_BATCH = isFastLane ? 14 : 20;
      const probeDeadlineMs = isFastLane ? 2800 : 3800;
      for (let i = 0; i < roundRobinPool.length; i += PROBE_BATCH) {
        if (Date.now() - probeStartTime > probeDeadlineMs) break;
        await Promise.allSettled(roundRobinPool.slice(i, i + PROBE_BATCH).map(probeCandidate));
      }

      // If strict probing timed out before completing any batch, surface unrejected candidates; if all failed explicitly, drop dead links
      const unrejectedPool = roundRobinPool.filter((c) => !rejectedUrls.has(c.id));
      const useFallbackUnverified = probedOk.size === 0 && unrejectedPool.length > 0;
      const poolToExpand = useFallbackUnverified
        ? unrejectedPool.slice(0, 12)
        : candidates.filter((c) => probedOk.has(c.id) && !rejectedUrls.has(c.id));

      // Split any multi-language stream into SEPARATE individual server entries (never "Hindi + English" combined!)
      const expandedCandidates: CandidateSource[] = [];
      for (const cand of poolToExpand) {
        if (Array.isArray(cand._subtitles) && cand._subtitles.length > 0) {
          allSubtitles.push(...cand._subtitles);
        }
        const langs = Array.from(new Set(cand._detectedLangs.filter(Boolean)));
        const finalLangs = langs.length > 0 ? langs : [cand.audioLanguage || 'Original'];

        finalLangs.forEach((singleLang, langIdx) => {
          const langSlug = singleLang.toLowerCase().replace(/[^a-z0-9]/g, '') || `t${langIdx}`;
          const needsRemuxForTrack =
            cand.format !== 'hls' &&
            (Boolean(cand._isMkv) ||
              (Boolean(cand._probedAudioCount && cand._probedAudioCount > 1) &&
                Boolean(cand._firstAudioLang) &&
                singleLang.toLowerCase() !== cand._firstAudioLang?.toLowerCase()));

          const trackUrl = buildProxyUrl(cand._rawUrl, cand._rawHeaders, {
            remux: needsRemuxForTrack,
            hevc: cand._isHevc,
            lang: needsRemuxForTrack ? singleLang : undefined,
            audioLang: !needsRemuxForTrack && finalLangs.length > 1 ? singleLang : undefined,
          });

          expandedCandidates.push({
            ...cand,
            id: finalLangs.length > 1 ? `${cand.id}-l${langIdx}-${langSlug}` : cand.id,
            audioLanguage: singleLang,
            url: trackUrl,
            isDirectPlayable: !needsRemuxForTrack,
            note: `Nuvio Scraper · ${cand._cleanName} · ${singleLang} · ${cand.quality}`,
            _isMkv: needsRemuxForTrack,
          });
        });
      }

      const verifiedSources = expandedCandidates
        .sort((a, b) => {
          const langDiff = languagePriority(a.audioLanguage) - languagePriority(b.audioLanguage);
          if (langDiff !== 0) return langDiff;
          const aMkv = a._isMkv ? 1 : 0;
          const bMkv = b._isMkv ? 1 : 0;
          if (aMkv !== bMkv) return aMkv - bMkv;
          return (a.format === 'hls' ? 0 : 1) - (b.format === 'hls' ? 0 : 1);
        })
        .map(
          ({
            _cleanName: _cn,
            _rawUrl: _r,
            _rawHeaders: _h,
            _isMkv: _m,
            _isHevc: _hv,
            _detectedLangs: _dl,
            _probedAudioCount: _pac,
            _firstAudioLang: _fal,
            _subtitles: _subs,
            ...publicSource
          }) => ({
            ...publicSource,
            isVerified: !useFallbackUnverified,
          })
        );

      const payload = {
        sources: verifiedSources,
        subtitles: allSubtitles,
        scraperResults,
      };
      if (verifiedSources.length > 0) {
        streamsResultCache.set(cacheKey, { fetchedAt: Date.now(), payload });
      }
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to run Nuvio scrapers';
      res.status(500).json({ error: msg, sources: [], subtitles: [], scraperResults: [] });
    }
  });

  // Health check endpoint verifying real Nuvio scraper scripts from GitHub manifest (batched to avoid GitHub burst timeouts)
  app.get('/api/nuvio/health', async (req, res) => {
    const manifestUrl = (req.query.manifestUrl as string) || DEFAULT_NUVIO_MANIFEST;
    try {
      const manifest = await fetchNuvioManifest(manifestUrl);
      const scrapers =
        Array.isArray(manifest.scrapers) && manifest.scrapers.length > 0
          ? manifest.scrapers
          : Array.isArray(manifest.providers)
          ? manifest.providers
          : [];
      const baseUrl = manifestUrl.replace(/\/manifest\.json.*$/, '');
      const statusMap: Record<string, 'ok' | 'error'> = {};

      const BATCH_SIZE = 20;
      for (let i = 0; i < scrapers.length; i += BATCH_SIZE) {
        const batch = scrapers.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (scraper) => {
            try {
              const code = await fetchScraperCode(`${baseUrl}/${scraper.filename}`, 4500, 1);
              const exportsObj = compileScraperModule(code);
              statusMap[scraper.id] = typeof exportsObj.getStreams === 'function' ? 'ok' : 'error';
            } catch {
              statusMap[scraper.id] = 'error';
            }
          })
        );
      }

      res.json({ ok: true, statusMap, total: scrapers.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify Nuvio manifest';
      res.status(502).json({ ok: false, error: msg, statusMap: {}, total: 0 });
    }
  });

  // Server-side Stremio addon health check (avoids browser CORS blocks causing false "Offline" status)
  app.get('/api/stremio/health', async (req, res) => {
    const urlsParam = String(req.query.urls || '');
    const entries = urlsParam
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    const statusMap: Record<string, 'ok' | 'error'> = {};
    await Promise.allSettled(
      entries.map(async (manifestUrl) => {
        try {
          const response = await fetch(manifestUrl, {
            headers: {
              'User-Agent': DEFAULT_UA,
              Accept: 'application/json',
              Origin: 'https://web.stremio.com',
              Referer: 'https://web.stremio.com/',
            },
            signal: AbortSignal.timeout(5500),
          });
          if (!response.ok) {
            void response.body?.cancel();
            statusMap[manifestUrl] = 'error';
            return;
          }
          const text = await response.text();
          statusMap[manifestUrl] = text.trim().length > 0 ? 'ok' : 'error';
        } catch {
          statusMap[manifestUrl] = 'error';
        }
      })
    );

    res.json({ ok: true, statusMap });
  });

  // Unified fast concurrent service-level provider monitor across Stremio, Nuvio, CloudStream, and core endpoints
  app.post('/api/providers/health', async (req, res) => {
    interface ProviderCheckTarget {
      key: string;
      kind: 'stremio' | 'nuvio' | 'cloudstream' | 'core';
      url: string;
      name?: string;
    }

    interface HealthProbeOutcome {
      status: 'online' | 'degraded' | 'offline';
      latency: number;
      detail?: string;
    }

    try {
      const body = (req.body || {}) as { targets?: ProviderCheckTarget[] };
      const rawTargets = Array.isArray(body.targets) ? body.targets : [];
      const seenKeys = new Set<string>();
      const targets = rawTargets.filter((t) => {
        if (!t || !t.key || typeof t.url !== 'string' || !t.url.trim() || seenKeys.has(t.key)) return false;
        seenKeys.add(t.key);
        return true;
      });

      const results: Record<string, HealthProbeOutcome> = {};
      const inFlightByUrl = new Map<string, Promise<HealthProbeOutcome>>();

      const readBoundedSnippet = async (response: globalThis.Response, maxBytes = 49152): Promise<string> => {
        if (!response.body) {
          return await response.text();
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let total = 0;
        let out = '';
        try {
          while (total < maxBytes) {
            const { value, done } = await reader.read();
            if (done || !value) break;
            total += value.byteLength;
            out += decoder.decode(value, { stream: true });
          }
          out += decoder.decode();
        } finally {
          void reader.cancel().catch(() => {});
        }
        return out;
      };

      const fetchWithHardTimeout = async (
        targetUrl: string,
        headers: Record<string, string>,
        timeoutMs = 4200
      ): Promise<{ response: globalThis.Response; snippet: string; latency: number }> => {
        const controller = new AbortController();
        const start = Date.now();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(targetUrl, {
            headers,
            redirect: 'follow',
            signal: controller.signal,
          });
          const latency = Date.now() - start;
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            return { response, snippet: '', latency };
          }
          const snippet = await readBoundedSnippet(response, 49152);
          return { response, snippet, latency: Date.now() - start };
        } finally {
          clearTimeout(timer);
        }
      };

      const probeEndpointUrl = (normalizedUrl: string): Promise<HealthProbeOutcome> => {
        const existing = inFlightByUrl.get(normalizedUrl);
        if (existing) return existing;

        const task = (async (): Promise<HealthProbeOutcome> => {
          const start = Date.now();
          try {
            let probe = await fetchWithHardTimeout(normalizedUrl, {
              'User-Agent': DEFAULT_UA,
              Accept: 'application/json, text/plain, */*',
            });

            if (probe.response.status === 403 || probe.response.status === 405) {
              probe = await fetchWithHardTimeout(normalizedUrl, {
                'User-Agent': DEFAULT_UA,
                Accept: 'application/json, text/plain, */*',
                Origin: 'https://web.stremio.com',
                Referer: 'https://web.stremio.com/',
              });
            }

            const { response, snippet, latency } = probe;

            if (response.status === 429) {
              return { status: 'degraded', latency, detail: 'Rate limited (HTTP 429)' };
            }

            if (response.status === 403 || response.status === 503) {
              const isCf = Boolean(response.headers.get('cf-ray') || response.headers.get('server')?.toLowerCase().includes('cloudflare'));
              if (isCf) {
                return { status: 'degraded', latency, detail: `Protected (HTTP ${response.status})` };
              }
            }

            if (!response.ok) {
              if (response.status === 404 && normalizedUrl.includes('/api/bengali/')) {
                return { status: 'offline', latency, detail: 'Unconfigured (no Bengali backend)' };
              }
              return { status: 'offline', latency, detail: `HTTP ${response.status}` };
            }

            const trimmed = snippet.trim();
            if (trimmed.length === 0) {
              return { status: 'degraded', latency, detail: 'Empty response' };
            }

            let parsed: Record<string, unknown> | null = null;
            try {
              parsed = JSON.parse(trimmed) as Record<string, unknown>;
            } catch {
              parsed = null;
            }

            if (!parsed && (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html'))) {
              return { status: 'degraded', latency, detail: 'HTML instead of JSON' };
            }

            let detailHint = 'Online';
            if (parsed) {
              if (Array.isArray(parsed.scrapers)) {
                detailHint = `${parsed.scrapers.length} scrapers`;
              } else if (typeof parsed.version === 'string') {
                detailHint = `v${parsed.version}`;
              } else if (typeof parsed.name === 'string') {
                detailHint = parsed.name;
              } else if (Array.isArray(parsed.pluginLists) || Array.isArray(parsed.extensions)) {
                detailHint = 'CloudStream Repo';
              } else if (Array.isArray(parsed.zeeBanglaDaily)) {
                detailHint = `${parsed.zeeBanglaDaily.length} serials`;
              } else {
                detailHint = 'Manifest OK';
              }
            }

            if (latency >= 2500) {
              return { status: 'degraded', latency, detail: `Slow (${detailHint})` };
            }

            return { status: 'online', latency, detail: detailHint };
          } catch (err) {
            const latency = Date.now() - start;
            const isTimeout =
              err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
            return {
              status: 'offline',
              latency,
              detail: isTimeout ? 'Request timeout' : 'Unreachable',
            };
          }
        })();

        inFlightByUrl.set(normalizedUrl, task);
        return task;
      };

      const checkSingleTarget = async (target: ProviderCheckTarget) => {
        let normalizedUrl = target.url.trim();
        if (normalizedUrl.startsWith('/api/')) {
          normalizedUrl = `http://127.0.0.1:${PORT}${normalizedUrl}`;
        } else if (normalizedUrl.startsWith('stremio://')) {
          normalizedUrl = normalizedUrl.replace(/^stremio:\/\//i, 'https://');
        }
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          results[target.key] = { status: 'offline', latency: 0, detail: 'Invalid URL' };
          return;
        }
        results[target.key] = await probeEndpointUrl(normalizedUrl);
      };

      const CONCURRENCY = 20;
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        await Promise.allSettled(targets.slice(i, i + CONCURRENCY).map(checkSingleTarget));
      }

      const values = Object.values(results);
      const online = values.filter((v) => v.status === 'online').length;
      const degraded = values.filter((v) => v.status === 'degraded').length;
      const offline = values.filter((v) => v.status === 'offline').length;

      res.json({
        ok: true,
        checkedAt: Date.now(),
        results,
        summary: { total: values.length, online, degraded, offline },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Health check error';
      res.status(200).json({
        ok: false,
        error: msg,
        checkedAt: Date.now(),
        results: {},
        summary: { total: 0, online: 0, degraded: 0, offline: 0 },
      });
    }
  });

  // Export native Android Studio / Gradle / Kotlin project archive
  app.get('/api/android/archive', (_req, res) => {
    const projectRoot = process.cwd();
    const androidDir = path.join(projectRoot, 'android');
    if (!fs.existsSync(androidDir)) {
      res.status(404).json({ error: 'Android project directory not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="euthopiar-android-studio-project.tar.gz"'
    );

    const targets = ['android'];
    if (fs.existsSync(path.join(projectRoot, 'capacitor.config.ts'))) {
      targets.push('capacitor.config.ts');
    }

    const tarProc = spawn(
      'tar',
      [
        '--exclude=android/.gradle',
        '--exclude=android/build',
        '--exclude=android/app/build',
        '--exclude=android/.idea',
        '--exclude=android/local.properties',
        '-czf',
        '-',
        ...targets,
      ],
      { cwd: projectRoot }
    );

    tarProc.stdout.pipe(res);
    tarProc.stderr.on('data', () => {});
    tarProc.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to archive Android project' });
      } else {
        res.end();
      }
    });
    res.on('close', () => {
      if (!tarProc.killed) {
        tarProc.kill('SIGTERM');
      }
    });
  });

  // Search for official Hindi or Bengali dubbed TV series full episodes on YouTube
  const ytEpisodeCache = new Map<string, { fetchedAt: number; data: unknown }>();
  app.get('/api/youtube/episode', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const season = Number(req.query.season || 1);
    const episode = Number(req.query.episode || 1);
    const lang = String(req.query.lang || '').toLowerCase();
    const isBengali = lang.includes('bengali') || lang.includes('bn') || title.toLowerCase().includes('bengali');
    if (!title) {
      return res.status(400).json({ error: 'Missing title query parameter' });
    }

    const cacheKey = `${title.toLowerCase()}:s${season}:e${episode}:lang:${isBengali ? 'bn' : 'hi'}`;
    const cached = ytEpisodeCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
      return res.json(cached.data);
    }

    try {
      const isCid = /\b(c\.?i\.?d\.?)\b/i.test(title);
      // Fallback curate known top IDs for C.I.D. S1E1 to guarantee instant playback without timeout
      if (isCid && season === 1 && episode === 1) {
        const topId = isBengali ? 'AlZuNGfIRxQ' : 'FOY67ghyOc0';
        const source = {
          id: `yt-official-${topId}-${isBengali ? 'bn' : 'hi'}`,
          providerName: isBengali ? 'Sony Aath (Official YouTube)' : 'SET India (Official YouTube)',
          label: isBengali ? 'C.I.D. Bengali - Season 1 Episode 1 - Full Episode' : 'CID (सीआईडी) Season 1 - Episode 1 - Full Episode',
          quality: '1080p Official',
          url: `https://www.youtube-nocookie.com/embed/${topId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`,
          format: 'youtube',
          isFullEpisode: true,
          audioLanguage: isBengali ? 'Bengali' : 'Hindi',
          note: `Official Full Episode · ${isBengali ? 'Sony Aath' : 'SET India'} · ${isBengali ? 'Bengali Dub' : 'Hindi'}`,
          isDirectPlayable: true,
          isVerified: true,
        };
        const payload = { found: true, sources: [source] };
        ytEpisodeCache.set(cacheKey, { fetchedAt: Date.now(), data: payload });
        return res.json(payload);
      }

      const searchQuery = isCid
        ? isBengali
          ? `CID Bengali Season ${season} Episode ${episode} Sony Aath Full Episode`
          : `CID Season ${season} Episode ${episode} SET India Full Episode`
        : isBengali
        ? `${title} Bengali Season ${season} Episode ${episode} Full Episode`
        : `${title} Season ${season} Episode ${episode} Full Episode`;

      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(ytUrl, {
        headers: { 'User-Agent': DEFAULT_UA, 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        return res.status(502).json({ error: 'Failed to search YouTube' });
      }

      const html = await response.text();
      const videoIds = Array.from(
        new Set(Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]))
      ).slice(0, 4);

      if (videoIds.length === 0) {
        return res.json({ found: false, sources: [] });
      }

      const topId = videoIds[0];
      const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${topId}`, {
        signal: AbortSignal.timeout(3500),
      }).catch(() => null);
      const oembed = oembedRes && oembedRes.ok ? ((await oembedRes.json().catch(() => ({}))) as Record<string, string>) : {};

      const videoTitle = oembed?.title || `${title} S${season}E${episode} Full Episode`;
      const author = oembed?.author_name || (isCid ? (isBengali ? 'Sony Aath' : 'SET India') : 'YouTube');

      const source = {
        id: `yt-official-${topId}-${isBengali ? 'bn' : 'hi'}`,
        providerName: `${author} (Official YouTube)`,
        label: `${videoTitle.slice(0, 60)} · Full Episode`,
        quality: '1080p Official',
        url: `https://www.youtube-nocookie.com/embed/${topId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`,
        format: 'youtube',
        isFullEpisode: true,
        audioLanguage: isBengali ? 'Bengali' : 'Hindi',
        note: `Official Full Episode · ${author} · ${isBengali ? 'Bengali Dub' : 'Hindi'}`,
        isDirectPlayable: true,
        isVerified: true,
      };

      const payload = { found: true, sources: [source] };
      ytEpisodeCache.set(cacheKey, { fetchedAt: Date.now(), data: payload });
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve YouTube episode';
      res.status(502).json({ error: msg, found: false, sources: [] });
    }
  });

  // Explicit 404 JSON response for unconfigured /api/bengali/* routes so Vite SPA fallback never returns HTTP 200 HTML
  app.use('/api/bengali', (_req, res) => {
    res.status(404).json({
      ok: false,
      error: 'No Bengali serial provider backend is deployed on this server.',
    });
  });

  // Create Vite server in middleware mode (HMR/WS disabled in Cloud Run preview to avoid WebSocket errors)
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
    },
    appType: 'spa',
  });

  // Serve a WebSocket-free /@vite/client shim when HMR is disabled so Cloud Run
  // preview iframes never attempt failing ws:// or wss:// connections while CSS
  // style injection and React Refresh helpers continue working normally.
  app.get('/@vite/client', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`import "/node_modules/vite/dist/client/env.mjs";

const cspNonce =
  "document" in globalThis
    ? document.querySelector("meta[property=csp-nonce]")?.nonce
    : void 0;

const sheetsMap = new Map();
const linkSheetsMap = new Map();

if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    const devId = el.getAttribute("data-vite-dev-id");
    if (devId) sheetsMap.set(devId, el);
  });
  document
    .querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]')
    .forEach((el) => {
      const devId = el.getAttribute("data-vite-dev-id");
      if (devId) linkSheetsMap.set(devId, el);
    });
}

let lastInsertedStyle;

function updateStyle(id, content) {
  if (!("document" in globalThis) || linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) style.setAttribute("nonce", cspNonce);
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = void 0;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

function removeStyle(id) {
  if (!("document" in globalThis)) return;
  if (linkSheetsMap.has(id)) {
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(id)
        : id.replace(/"/g, '\\\\"');
    document
      .querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${escaped}"]\`)
      .forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.parentNode?.removeChild(style);
    sheetsMap.delete(id);
  }
}

const noop = () => {};

function createHotContext() {
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    acceptDeps: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}

function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}

const { HTMLElement: BaseHTMLElement = class {}, customElements } = globalThis;
class ErrorOverlay extends BaseHTMLElement {
  close() {
    this.parentNode?.removeChild(this);
  }
}
if (customElements && !customElements.get("vite-error-overlay")) {
  customElements.define("vite-error-overlay", ErrorOverlay);
}

export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`);
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://localhost:${PORT}`);
  });
}

void startServer();
