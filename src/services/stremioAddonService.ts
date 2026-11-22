import {
  MediaType,
  StreamSource,
  StremioAddonConfig,
  StremioManifest,
  StremioStreamResponse,
} from '../types/media';
import { STREMIO_ADDONS_NET_DIRECTORY } from '../data/nuvioAndStremioCatalog';
import { storageService } from './storageService';
import { tmdbService } from './tmdbService';

export const POPULAR_STREMIO_PRESETS: Array<{
  name: string;
  manifestUrl: string;
  description: string;
}> = [
  {
    name: 'Torrentio (Public Stream Addon)',
    manifestUrl: 'https://torrentio.strem.fun/manifest.json',
    description: 'Scrapes popular multi-resolution streams with multi-language audio & subs',
  },
  {
    name: 'Meteor P2P (Movies, Series & Anime)',
    manifestUrl: 'https://meteorfortheweebs.midnightignite.me/stremio/manifest.json',
    description: 'Fast P2P stream index across movies, series, and anime',
  },
  {
    name: 'TorrentsDB',
    manifestUrl: 'https://torrentsdb.com/manifest.json',
    description: 'Multi-quality torrent & direct mirror streams for movies and TV shows',
  },
  {
    name: 'HdHub (Hindi & Multi-Audio)',
    manifestUrl:
      'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json',
    description: 'Hindi, Dual-Audio & English movie and TV series streams',
  },
  {
    name: 'TorrentClaw',
    manifestUrl: 'https://torrentclaw.com/api/stremio/manifest.json',
    description: 'Web-DL & P2P mirrors for latest movies and series',
  },
  {
    name: 'Peerflix (Streams & Torrents)',
    manifestUrl: 'https://peerflix.mov/manifest.json',
    description: 'Fast P2P and multi-language community movie & series streams',
  },
  {
    name: 'Pipe Streams',
    manifestUrl: 'https://pipe.boringways.workers.dev/manifest.json',
    description: 'Fast workers-backed torrent stream index for movies & series',
  },
  {
    name: 'IlCorsaroViola',
    manifestUrl: 'https://icv.stremio-italia.eu/manifest.json',
    description: 'Multi-resolution European & English stream index',
  },
  {
    name: 'MediaFusion (Multi-Audio & Streams)',
    manifestUrl: 'https://mediafusion.elfhosted.com/manifest.json',
    description: 'Universal regional, Hindi, Tamil, Telugu & English stream index',
  },
];

export interface StremioResolveParams {
  tmdbId?: number;
  imdbId?: string;
  mediaType: MediaType;
  title: string;
  releaseYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
}

export function normalizeStremioUrlKey(rawUrl: string): string {
  let u = (rawUrl || '').trim();
  if (u.startsWith('stremio://')) {
    u = 'https://' + u.slice('stremio://'.length);
  }
  u = u.split('#')[0].replace(/\/+$/, '');
  return u.toLowerCase();
}

function encodeBase64UrlUtf8(obj: Record<string, string>): string {
  try {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function extractQuality(text: string): string {
  if (!text) return 'HD';
  const upper = text.toUpperCase();
  if (upper.includes('4K') || upper.includes('2160P') || upper.includes('UHD')) return '4K UHD';
  if (upper.includes('1080P') || upper.includes('FHD')) return '1080p FHD';
  if (upper.includes('720P')) return '720p HD';
  if (upper.includes('480P') || upper.includes('SD')) return '480p';
  return 'HD';
}

function extractSeeders(text: string): number | undefined {
  const m = text.match(/👤\s*(\d+)/) || text.match(/seeders?:?\s*(\d+)/i);
  if (!m) return undefined;
  const val = parseInt(m[1], 10);
  return Number.isFinite(val) ? val : undefined;
}

function extractSizeInfo(text: string): { sizeLabel?: string; sizeGb?: number } {
  const m = text.match(/💾\s*([\d.]+\s*[GMK]B)/i) || text.match(/\b([\d.]+\s*(?:GB|MB))\b/i);
  if (!m) return {};
  const sizeLabel = m[1].replace(/\s+/g, '').toUpperCase();
  const num = parseFloat(sizeLabel);
  if (!Number.isFinite(num)) return { sizeLabel };
  if (sizeLabel.endsWith('GB')) return { sizeLabel, sizeGb: num };
  if (sizeLabel.endsWith('MB')) return { sizeLabel, sizeGb: num / 1024 };
  if (sizeLabel.endsWith('KB')) return { sizeLabel, sizeGb: num / (1024 * 1024) };
  return { sizeLabel };
}

/**
 * Extracts individual clean language names (never joined with '+' or 'Dual Audio').
 */
export function extractAudioLanguages(text: string): string[] {
  const found: string[] = [];
  const add = (lang: string) => {
    if (lang && !found.includes(lang)) found.push(lang);
  };

  if (/\bhindi\b|\[hin\]|\(hin\)/i.test(text)) add('Hindi');
  if (/\b(bengali|bangla)\b|\[ben\]|\(ben\)|🇧🇩/i.test(text)) add('Bengali');
  if (/\btamil\b|\[tam\]|\(tam\)/i.test(text)) add('Tamil');
  if (/\btelugu\b|\[tel\]|\(tel\)/i.test(text)) add('Telugu');
  if (/\bmalayalam\b|\[mal\]|\(mal\)/i.test(text)) add('Malayalam');
  if (/\bkannada\b|\[kan\]|\(kan\)/i.test(text)) add('Kannada');
  if (/\bmarathi\b|\[mar\]|\(mar\)/i.test(text)) add('Marathi');
  if (/\bpunjabi\b|\[pan\]|\(pan\)/i.test(text)) add('Punjabi');
  if (/\benglish\b|\[eng\]|\(eng\)|🇬🇧|🇺🇸/i.test(text)) add('English');
  if (/\b(truefrench|french|français|francais|vostfr|vf)\b|🇫🇷/i.test(text)) add('French');
  if (/\bjapanese\b|\[(?:jpn|jap)\]|\((?:jpn|jap)\)|🇯🇵/i.test(text)) add('Japanese');
  if (/\bkorean\b|\[kor\]|\(kor\)|🇰🇷/i.test(text)) add('Korean');
  if (/\b(spanish|latino|castellano)\b|\[esp\]|\(esp\)|🇪🇸|🇲🇽/i.test(text)) add('Spanish');
  if (/\bitalian\b|\[ita\]|\(ita\)|🇮🇹/i.test(text)) add('Italian');
  if (/\b(portuguese|pt-br|dublado)\b|🇵🇹|🇧🇷/i.test(text)) add('Portuguese');
  if (/\b(german|deutsch)\b|\[(?:ger|deu)\]|\((?:ger|deu)\)|🇩🇪/i.test(text)) add('German');
  if (/\brussian\b|\[rus\]|\(rus\)|🇷🇺/i.test(text)) add('Russian');
  if (/\bukrainian\b|\[ukr\]|\(ukr\)|🇺🇦/i.test(text)) add('Ukrainian');
  if (/\barabic\b|\[ara\]|\(ara\)|🇸🇦/i.test(text)) add('Arabic');
  if (/\bturkish\b|\[tur\]|\(tur\)|🇹🇷/i.test(text)) add('Turkish');
  if (/\bthai\b|🇹🇭/i.test(text)) add('Thai');
  if (/\b(indonesian|indo)\b|🇮🇩/i.test(text)) add('Indonesian');
  if (/\b(chinese|mandarin|cantonese)\b|🇨🇳/i.test(text)) add('Chinese');

  if (found.length === 0 && /🇮🇳/.test(text)) add('Hindi');
  if (
    !found.includes('Hindi') &&
    /🇮🇳/.test(text) &&
    !found.some((l) =>
      ['Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Punjabi'].includes(l)
    )
  ) {
    found.unshift('Hindi');
  }

  return found.length > 0 ? found : ['Original'];
}

const STREMIO_NOISE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by',
  '1080p', '720p', '480p', '2160p', '4k', 'uhd', 'fhd', 'hd', 'sd', 'web', 'webdl', 'webrip',
  'bluray', 'brrip', 'bdrip', 'dvdrip', 'hdrip', 'cam', 'hdcam', 'hdts', 'ts', 'remux',
  'repack', 'proper', 'extended', 'unrated', 'x264', 'x265', 'hevc', 'avc', '10bit', '8bit',
  'aac', 'ac3', 'eac3', 'ddp', 'ddp5', 'dts', 'truehd', 'atmos', 'hindi', 'english',
  'bengali', 'tamil', 'telugu', 'dual', 'audio', 'multi', 'dub', 'dubbed', 'sub', 'subbed',
  'esub', 'esubs', 'mkv', 'mp4', 'avi', 'yts', 'yify', 'rarbg', 'ettv', 'eztv', 'tgx',
  'torrentio', 'mediafusion', 'comet', 'bollystreams', 'cncverse', 'bridge', 'stremify', 'webstreamr',
  'nf', 'amzn', 'dsnp', 'hbo', 'atvp', 'hulu', 'hdr', 'hdr10', 'dv', 'seeds', 'seed', 'seeders',
  'peers', 'server', 'fast', 'direct', 'stream', 'streams', 'mirror', 'source', 'hubcloud', 'fsl',
  'gdflix', 'vcloud', 'hubdrive', 'fourkhdhub', 'mbps', 'kbps', 'gb', 'mb', 'no', 'included', 'subtitles',
]);

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STREMIO_NOISE_WORDS.has(w) && !/^\d{4}$/.test(w));
}

function isStremioStreamRelevant(
  rawText: string,
  params: StremioResolveParams,
  hasExplicitFilenameOrYear: boolean,
  hasFileIdx = false
): boolean {
  if (!rawText) return true;
  if (/\b(sample|trailer|promo|teaser|camrip)\b/i.test(rawText)) {
    return false;
  }
  if (
    /please configure|configure the addon|kindly configure|not configured|nothing here\?|hunt it down|pro can launch|upgrade to|go premium|need more sources|\$\s*\/\s*month|❌/i.test(
      rawText
    )
  ) {
    return false;
  }

  const firstLine = rawText.split('\n')[0] || rawText;
  if (params.mediaType === 'movie') {
    if (
      /\b(s\d{1,2}[.\s_-]*e\d{1,2}|\d{1,2}x\d{2}|complete\s+series|season\s+\d+\s+complete)\b/i.test(
        firstLine
      )
    ) {
      return false;
    }
  } else if (params.mediaType === 'tv' && params.seasonNumber && params.episodeNumber) {
    const epMatch =
      rawText.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i) ||
      rawText.match(/\b(\d{1,2})x(\d{2})\b/i) ||
      rawText.match(/\bSeason\s*(\d{1,2})\b[\s,._-]*Episode\s*(\d{1,2})\b/i);
    if (epMatch) {
      const sNum = parseInt(epMatch[1], 10);
      const eNum = parseInt(epMatch[2], 10);
      if (sNum !== params.seasonNumber || eNum !== params.episodeNumber) {
        return false;
      }
    } else {
      // BUG-04: Reject season packs when fileIdx is absent
      if (/\b(complete|season\s*\d+|s\d{1,2}\s*pack)\b/i.test(rawText) && !hasFileIdx) {
        return false;
      }
      // BUG-03: Enforce untagged movie release year check across ALL seasons (>= 1)
      const years = Array.from(firstLine.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) =>
        Number(m[1])
      );
      const hasAnySeriesHint = /\b(season|episode|ep\.?\s*\d+|s\d{1,2}|complete|pack)\b/i.test(
        rawText
      );
      if (years.length > 0 && !hasAnySeriesHint) {
        if (!params.releaseYear || !years.some((y) => Math.abs(y - params.releaseYear!) <= 1)) {
          return false;
        }
      }
    }
  }

  // Enforce title token overlap when stream carries an explicit movie filename, release year, or descriptive title
  if (params.title) {
    const expectedTokens = tokenizeForMatch(params.title);
    const addonTokens = new Set([
      'torrentio',
      'meteor',
      'torrentsdb',
      'torrentclaw',
      'peerflix',
      'pipe',
      'hdhub',
      'notorrent',
      'ilcorsaroviola',
      'icv',
      'knaben',
      'truespec',
      'verified',
      'original',
    ]);
    const candidateTokens = tokenizeForMatch(firstLine).filter((t) => !addonTokens.has(t));
    if (expectedTokens.length >= 2 && candidateTokens.length >= 2) {
      const matchedCount = expectedTokens.filter((et) =>
        candidateTokens.some(
          (ct) => ct === et || (et.length >= 4 && ct.length >= 4 && (ct.includes(et) || et.includes(ct)))
        )
      ).length;
      const minNeeded = Math.max(1, Math.floor(expectedTokens.length * 0.35));
      if (matchedCount < minNeeded) return false;
    }
  }

  return true;
}

export const stremioAddonService = {
  /**
   * Normalizes a Stremio addon input URL into base and manifest URLs (preserving query params like ?config=...).
   */
  normalizeUrl(rawInput: string): { baseUrl: string; manifestUrl: string } {
    let url = rawInput.trim();
    if (url.startsWith('stremio://')) {
      url = 'https://' + url.slice('stremio://'.length);
    }

    // Match stremio-addons.net/addons/<slug> or slug directly
    const dirSlugMatch = url.match(/stremio-addons\.net\/addons\/([a-z0-9-]+)/i);
    if (dirSlugMatch?.[1]) {
      const entry = STREMIO_ADDONS_NET_DIRECTORY.find(
        (a) => a.slug.toLowerCase() === dirSlugMatch[1].toLowerCase()
      );
      if (entry) {
        url = entry.manifestUrl;
      }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const [pathOnly, queryPart] = url.split('?');
    const cleanPath = pathOnly.replace(/\/+$/, '');
    let baseUrl: string;
    let manifestUrl: string;

    if (/\/manifest\.json$/i.test(cleanPath)) {
      baseUrl = cleanPath.replace(/\/manifest\.json$/i, '');
      manifestUrl = queryPart ? `${cleanPath}?${queryPart}` : cleanPath;
    } else {
      baseUrl = cleanPath;
      manifestUrl = queryPart ? `${cleanPath}/manifest.json?${queryPart}` : `${cleanPath}/manifest.json`;
    }

    return { baseUrl, manifestUrl };
  },

  /**
   * Fetches and validates a Stremio Addon manifest with /api/proxy fallback.
   */
  async fetchManifest(rawUrl: string, presetName?: string): Promise<StremioAddonConfig> {
    const { baseUrl, manifestUrl } = this.normalizeUrl(rawUrl);
    const normKey = normalizeStremioUrlKey(manifestUrl);
    const dirEntry = STREMIO_ADDONS_NET_DIRECTORY.find(
      (a) => normalizeStremioUrlKey(a.manifestUrl) === normKey
    );

    const tryFetchManifestJson = async (target: string): Promise<StremioManifest | null> => {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 7000);
        const res = await fetch(target, { signal: controller.signal });
        window.clearTimeout(timeout);
        if (!res.ok) return null;
        const text = await res.text();
        if (!text.trim().startsWith('{')) return null;
        return JSON.parse(text) as StremioManifest;
      } catch {
        return null;
      }
    };

    const manifest =
      (await tryFetchManifestJson(`/api/proxy?url=${encodeURIComponent(manifestUrl)}`)) ||
      (await tryFetchManifestJson(manifestUrl));

    if (!manifest || !manifest.id || !manifest.name) {
      throw new Error(
        `Invalid or unreachable Stremio manifest at ${manifestUrl} (missing manifest.id or manifest.name).`
      );
    }

    return {
      id: manifest.id,
      name: manifest.name || presetName || dirEntry?.name || 'Stremio Add-on',
      manifestUrl,
      baseUrl,
      enabled: true,
      description: manifest.description || dirEntry?.description || 'Community stream add-on',
      version: manifest.version || '1.0.0',
      logo: manifest.logo || dirEntry?.logo,
      addedAt: Date.now(),
    };
  },

  /**
   * Refreshes manifests/versions for all installed Stremio add-ons and returns updated configs.
   */
  async refreshAllAddons(addons: StremioAddonConfig[]): Promise<StremioAddonConfig[]> {
    const updated = await Promise.all(
      addons.map(async (addon) => {
        const m = (addon.manifestUrl || '').toLowerCase();
        if (m.endsWith('/repo.json') || m.endsWith('/cs.json')) {
          return addon;
        }
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 6500);
          const res = await fetch(
            `/api/proxy?url=${encodeURIComponent(addon.manifestUrl)}`,
            { signal: controller.signal }
          );
          window.clearTimeout(timeout);
          if (!res.ok) return addon;
          const text = await res.text();
          if (!text.trim().startsWith('{')) return addon;
          const manifest = JSON.parse(text) as StremioManifest;
          if (manifest && manifest.id && manifest.name) {
            return {
              ...addon,
              name: manifest.name || addon.name,
              description: manifest.description || addon.description,
              version: manifest.version || addon.version,
              logo: manifest.logo || addon.logo,
            };
          }
        } catch {
          // Keep existing addon if temporarily offline
        }
        return addon;
      })
    );
    return updated;
  },

  /**
   * Resolves playable HTTP, HLS & BitTorrent P2P streams across all enabled Stremio Addons.
   * Splits multi-language streams into separate single-language entries.
   */
  async resolveStreams(
    params: StremioResolveParams,
    onBatch?: (batch: StreamSource[]) => void
  ): Promise<StreamSource[]> {
    const toggles = storageService.getProviderToggles();
    const addons = storageService
      .getStremioAddons()
      .filter((a) => {
        if (!a.enabled || !a.baseUrl) return false;
        const m = (a.manifestUrl || '').toLowerCase();
        // Skip CloudStream repo.json entries and metadata/subtitle-only endpoints
        if (m.endsWith('/repo.json') || m.endsWith('/cs.json')) return false;
        if (m.includes('cinemeta.strem.io') || m.includes('opensubtitles')) return false;
        // Respect core provider toggles from SettingsScreen
        if (m.includes('torrentio.strem.fun') && toggles.torrentio === false) return false;
        if (m.includes('meteorfortheweebs') && toggles.meteor === false) return false;
        if (m.includes('torrentsdb.com') && toggles.torrentsdb === false) return false;
        if (m.includes('hdhub.thevolecitor') && toggles.hdhub === false) return false;
        if (
          (m.includes('notorrent2.workers.dev') || m.includes('nuviostreams.hayd.uk')) &&
          toggles.notorrent === false
        ) {
          return false;
        }
        if (m.includes('torrentclaw') && toggles.torrentclaw === false) return false;
        if (m.includes('peerflix.mov') && toggles.peerflix === false) return false;
        if (m.includes('pipe.boringways') && toggles.pipe === false) return false;
        if ((m.includes('icv.stremio-italia') || m.includes('ilcorsaroviola')) && toggles.icv === false) return false;
        return a.baseUrl.startsWith('http://') || a.baseUrl.startsWith('https://');
      });
    if (addons.length === 0) return [];

    // Query newest user-added addons first
    const orderedAddons = [...addons].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    let targetImdbId = params.imdbId;
    if (!targetImdbId && params.tmdbId) {
      targetImdbId = await tmdbService.getImdbId(params.tmdbId, params.mediaType);
      if (!targetImdbId) {
        try {
          const yearQ = params.releaseYear ? `&year=${params.releaseYear}` : '';
          const titleQ = params.title ? `&title=${encodeURIComponent(params.title)}` : '';
          const res = await fetch(
            `/api/resolve-imdb?tmdbId=${params.tmdbId}&mediaType=${params.mediaType}${titleQ}${yearQ}`
          );
          if (res.ok) {
            const j = (await res.json()) as { imdbId?: string | null };
            if (j?.imdbId) targetImdbId = j.imdbId;
          }
        } catch {
          // Ignore server fallback failure
        }
      }
    }

    const baseId =
      targetImdbId && targetImdbId.startsWith('tt')
        ? targetImdbId
        : params.tmdbId
        ? `tmdb:${params.tmdbId}`
        : '';

    if (!baseId) {
      return [];
    }

    const stremioType = params.mediaType === 'tv' ? 'series' : 'movie';
    const streamSegment =
      params.mediaType === 'tv'
        ? `${baseId}:${params.seasonNumber || 1}:${params.episodeNumber || 1}`
        : baseId;

    const sources: StreamSource[] = [];

    const fetchAddonJson = async (endpointUrl: string): Promise<StremioStreamResponse | null> => {
      const controller = new AbortController();
      const timerFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
      const clearTimerFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
      const timeout = timerFn(() => controller.abort(), 7500);
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(endpointUrl)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text.trim().startsWith('{')) return null;
        return JSON.parse(text) as StremioStreamResponse;
      } catch {
        return null;
      } finally {
        clearTimerFn(timeout);
      }
    };

    await Promise.allSettled(
      orderedAddons.map(async (addon) => {
        try {
          const [, manifestQuery] = (addon.manifestUrl || '').split('?');
          const cleanBase = addon.baseUrl.replace(/\/manifest\.json(\?.*)?$/i, '').replace(/\/+$/, '');
          const endpointUrl = `${cleanBase}/stream/${stremioType}/${streamSegment}.json${
            manifestQuery ? `?${manifestQuery}` : ''
          }`;
          const data = await fetchAddonJson(endpointUrl);
          const streams = data?.streams || [];
          const addonCollected: StreamSource[] = [];

          streams.forEach((s, idx) => {
            const rawText = [s.name, s.title, s.description, s.behaviorHints?.filename]
              .filter(Boolean)
              .join(' ');
            const quality = extractQuality(rawText);
            const languages = extractAudioLanguages(rawText);
            const seeders = extractSeeders(rawText);
            const { sizeLabel, sizeGb } = extractSizeInfo(rawText);
            const hasExplicitFilenameOrYear = Boolean(
              s.behaviorHints?.filename || /\b(19\d{2}|20\d{2})\b/.test(rawText)
            );

            const hasFileIdx = typeof s.fileIdx === 'number' || Boolean(s.url);

            if (!isStremioStreamRelevant(rawText, params, hasExplicitFilenameOrYear, hasFileIdx)) {
              return;
            }

            if (s.ytId && /^[a-zA-Z0-9_-]{6,}$/.test(s.ytId)) {
              addonCollected.push({
                id: `stremio-${addon.id}-yt-${idx}`,
                providerName: addon.name,
                label: (s.title || s.name || `${addon.name} Video`).split('\n')[0].slice(0, 64),
                quality,
                url: `https://www.youtube-nocookie.com/embed/${s.ytId}?autoplay=1&rel=0`,
                format: 'youtube',
                audioLanguage: languages[0] || 'Original',
                note: `Stremio · ${addon.name}`,
                isDefault: false,
                isDirectPlayable: true,
              });
              return;
            }

            const reqHeaders = s.behaviorHints?.proxyHeaders?.request;
            const encodedHeaders =
              reqHeaders && Object.keys(reqHeaders).length > 0
                ? encodeBase64UrlUtf8(reqHeaders)
                : '';

            // Only treat externalUrl as playable when it points directly to a media file, not a donation/config page
            const directMediaExtUrl =
              s.externalUrl && /\.(mp4|m3u8|webm)(\?|$)/i.test(s.externalUrl) ? s.externalUrl : undefined;
            const streamUrl = s.url || directMediaExtUrl;
            // Reject HTML redirect/captcha pages masquerading as stream URLs
            if (streamUrl && /\/redirect\?p=/i.test(streamUrl)) {
              return;
            }
            if (streamUrl && (streamUrl.startsWith('http://') || streamUrl.startsWith('https://'))) {
              const title = s.title || s.name || s.description || `${addon.name} Stream ${idx + 1}`;
              const isHls = streamUrl.toLowerCase().includes('.m3u8') || rawText.toUpperCase().includes('HLS');
              const filenameHint = s.behaviorHints?.filename || '';
              const isMkvOrUnsupported =
                !isHls &&
                (streamUrl.toLowerCase().includes('.mkv') ||
                  filenameHint.toLowerCase().includes('.mkv') ||
                  /\b(\.mkv|x265|hevc|10bit|dts|truehd|ddp|eac3|remux)\b/i.test(rawText));
              const isHevc = /\b(x265|hevc|10bit)\b/i.test(rawText);

              if (isMkvOrUnsupported && sizeGb !== undefined && sizeGb > 12) {
                return;
              }

              // BUG-11: Keep HLS dual-audio as one single Dual item; remux non-HLS multi-audio per track consistently
              if (isHls && languages.length > 1) {
                const dualLabel = `Dual (${languages.join(' / ')})`;
                const finalUrl = encodedHeaders
                  ? `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}&h=${encodeURIComponent(encodedHeaders)}`
                  : streamUrl;
                addonCollected.push({
                  id: `stremio-${addon.id}-${idx}-dual`,
                  providerName: addon.name,
                  label: title.split('\n')[0].slice(0, 64),
                  quality,
                  url: finalUrl,
                  format: 'hls',
                  audioLanguage: dualLabel,
                  sizeLabel,
                  seeders,
                  note: `Stremio · ${addon.name} · ${quality}`,
                  isDefault: false,
                  isDirectPlayable: !s.behaviorHints?.notWebReady,
                  isVerified: !s.behaviorHints?.notWebReady,
                });
              } else {
                languages.forEach((singleLang, langIdx) => {
                  const needsRemuxForTrack = isMkvOrUnsupported || (!isHls && languages.length > 1);
                  const needsProxy = needsRemuxForTrack || Boolean(encodedHeaders);
                  const finalUrl = needsProxy
                    ? `/api/stream-proxy?url=${encodeURIComponent(streamUrl)}${
                        encodedHeaders ? `&h=${encodeURIComponent(encodedHeaders)}` : ''
                      }${needsRemuxForTrack ? `&remux=1${isHevc ? '&hevc=1' : ''}&lang=${encodeURIComponent(singleLang)}` : ''}`
                    : streamUrl;

                  addonCollected.push({
                    id: `stremio-${addon.id}-${idx}-l${langIdx}`,
                    providerName: addon.name,
                    label: title.split('\n')[0].slice(0, 64),
                    quality,
                    url: finalUrl,
                    format: isHls ? 'hls' : 'mp4',
                    audioLanguage: singleLang,
                    sizeLabel,
                    seeders,
                    note: `Stremio · ${addon.name} · ${quality}`,
                    isDefault: false,
                    isDirectPlayable: !needsRemuxForTrack && !s.behaviorHints?.notWebReady,
                    isVerified: !needsRemuxForTrack && !s.behaviorHints?.notWebReady,
                  });
                });
              }
              return;
            }

            if (s.infoHash && /^[a-fA-F0-9]{40}$/.test(s.infoHash)) {
              const filename = s.behaviorHints?.filename || s.title || '';
              const isMp4 = /\.mp4\b/i.test(filename);
              const isHevc = /\b(x265|hevc|10bit)\b/i.test(rawText);
              const baseNeedsRemux =
                !isMp4 || /\b(\.mkv|\.avi|x265|hevc|10bit|dts|truehd|ddp|eac3|ac3)\b/i.test(rawText);
              const trackers = (s.sources || [])
                .filter((src) => src.startsWith('tracker:'))
                .map((src) => src.slice('tracker:'.length))
                .slice(0, 8)
                .join(',');

              const displayLabel =
                (s.title || filename || `${addon.name} ${quality}`).split('\n')[0].slice(0, 64);

              const seasonEpQuery =
                params.mediaType === 'tv' && params.seasonNumber && params.episodeNumber
                  ? `&season=${params.seasonNumber}&episode=${params.episodeNumber}`
                  : '';

              languages.forEach((singleLang, langIdx) => {
                const needsRemux = baseNeedsRemux || languages.length > 1;
                const p2pEnabled = storageService.getP2PTorrentEnabled();
                const prebufferMb = storageService.getP2PPrebufferSizeMb();
                const torrentUrl = `/api/torrent/stream?infoHash=${encodeURIComponent(s.infoHash!)}${
                  typeof s.fileIdx === 'number' ? `&fileIdx=${s.fileIdx}` : ''
                }${seasonEpQuery}${trackers ? `&tr=${encodeURIComponent(trackers)}` : ''}${needsRemux ? '&remux=1' : ''}${
                  isHevc ? '&hevc=1' : ''
                }${singleLang ? `&lang=${encodeURIComponent(singleLang)}` : ''}&p2p=${p2pEnabled ? '1' : '0'}&prebufferMb=${prebufferMb}`;

                addonCollected.push({
                  id: `stremio-${addon.id}-p2p-${idx}-l${langIdx}`,
                  providerName: addon.name,
                  label: displayLabel,
                  quality,
                  url: torrentUrl,
                  format: 'mp4',
                  audioLanguage: singleLang,
                  sizeLabel,
                  seeders,
                  note: `P2P${sizeLabel ? ` · ${sizeLabel}` : ''}${seeders !== undefined ? ` · ${seeders} seeders` : ''}`,
                  isDefault: false,
                  isDirectPlayable: !needsRemux && isMp4 && !isHevc && (sizeGb === undefined || sizeGb <= 8),
                });
              });
            }
          });

          const hasLighter = addonCollected.some((item) => {
            const gbMatch = item.sizeLabel?.match(/^([\d.]+)GB$/i);
            return !gbMatch || parseFloat(gbMatch[1]) <= 8;
          });
          const filtered = hasLighter
            ? addonCollected.filter((item) => {
                const gbMatch = item.sizeLabel?.match(/^([\d.]+)GB$/i);
                return !gbMatch || parseFloat(gbMatch[1]) <= 8;
              })
            : addonCollected;

          filtered.sort((a, b) => {
            const aDirect = a.isDirectPlayable !== false ? 0 : 1;
            const bDirect = b.isDirectPlayable !== false ? 0 : 1;
            if (aDirect !== bDirect) return aDirect - bDirect;
            return (b.seeders || 0) - (a.seeders || 0);
          });

          // Preserve diversity across individual languages (Hindi, Bengali, Tamil, English, etc.)
          const perLangCount = new Map<string, number>();
          const balanced: StreamSource[] = [];
          for (const item of filtered) {
            const langKey = (item.audioLanguage || 'Original').toLowerCase();
            const count = perLangCount.get(langKey) || 0;
            if (count < 5 && balanced.length < 24) {
              perLangCount.set(langKey, count + 1);
              balanced.push(item);
            }
          }

          sources.push(...balanced);
          if (balanced.length > 0 && onBatch) {
            onBatch(balanced);
          }
        } catch {
          // Skip addon on timeout or network block
        }
      })
    );

    return sources;
  },
};
