import {
  MediaType,
  StreamResolutionResult,
  StreamSource,
  SubtitleTrack,
} from '../types/media';
import { archiveMovieService } from './archiveMovieService';
import { bengaliSerialService } from './bengaliSerialService';
import { dejavuApiService } from './dejavuApiService';
import { nuvioService } from './nuvioService';
import { storageService } from './storageService';
import { stremioAddonService } from './stremioAddonService';
import { streamConnector } from './streamConnector';
import { tmdbService } from './tmdbService';
import { cloudStreamProviderResolver } from './cloudStreamProviderResolver';

export interface StreamQueryParams {
  tmdbId: number;
  imdbId?: string;
  dejavuId?: string;
  archiveIdentifier?: string;
  mediaType: MediaType;
  title: string;
  genreIds?: number[];
  originalLanguage?: string;
  releaseYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  bengaliSerialSlug?: string;
  preferredVideoId?: string;
}

export interface StreamResolveOptions {
  onProgress?: (result: StreamResolutionResult) => void;
}

export interface IStreamProviderService {
  resolveMovieStreams(
    params: StreamQueryParams,
    options?: StreamResolveOptions
  ): Promise<StreamResolutionResult>;
  resolveEpisodeStreams(
    params: StreamQueryParams,
    options?: StreamResolveOptions
  ): Promise<StreamResolutionResult>;
}

function createTextBlobUrl(content: string, mime = 'text/vtt'): string {
  const blob = new Blob([content], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * Converts standard .srt subtitle text into browser-compatible WebVTT Blob URL.
 */
export function convertSrtToVttBlobUrl(srtText: string): string {
  const cleanText = srtText.replace(/^\uFEFF/, '');
  const vttBody = cleanText
    .replace(/\r+/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  const fullVtt = vttBody.trim().startsWith('WEBVTT')
    ? vttBody
    : `WEBVTT\n\n${vttBody}`;
  return createTextBlobUrl(fullVtt, 'text/vtt');
}

export async function resolveSubtitleTrackUrl(track: SubtitleTrack): Promise<string> {
  if (track.url.startsWith('blob:')) {
    return track.url;
  }
  try {
    const fetchUrl = track.url.startsWith('/api/')
      ? track.url
      : `/api/proxy?url=${encodeURIComponent(track.url)}`;
    let res = await fetch(fetchUrl);
    if (!res.ok && !track.url.startsWith('/api/')) {
      res = await fetch(`/api/stream-proxy?url=${encodeURIComponent(track.url)}`);
    }
    if (!res.ok) return track.url;
    const text = (await res.text()).replace(/^\uFEFF/, '');
    if (track.format === 'srt' || !text.trim().startsWith('WEBVTT')) {
      return convertSrtToVttBlobUrl(text);
    }
    return createTextBlobUrl(text, 'text/vtt');
  } catch {
    return track.url;
  }
}

function interpolateTemplate(template: string, params: StreamQueryParams): string {
  return template
    .replace(/\{tmdbId\}/g, String(params.tmdbId))
    .replace(/\{imdbId\}/g, params.imdbId || `tmdb-${params.tmdbId}`)
    .replace(/\{mediaType\}/g, params.mediaType)
    .replace(/\{title\}/g, encodeURIComponent(params.title))
    .replace(/\{season\}/g, String(params.seasonNumber ?? 1))
    .replace(/\{episode\}/g, String(params.episodeNumber ?? 1));
}

export const ISO_TO_LANG_NAME: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  mr: 'Marathi',
  pa: 'Punjabi',
  ar: 'Arabic',
  tr: 'Turkish',
  th: 'Thai',
  id: 'Indonesian',
};

function getDefaultAudioLanguage(originalLanguage?: string): string {
  if (!originalLanguage) return 'Original';
  return ISO_TO_LANG_NAME[originalLanguage.trim().toLowerCase()] || 'Original';
}

function getOriginalLanguageRegex(originalLanguage?: string): RegExp {
  const langName = getDefaultAudioLanguage(originalLanguage);
  if (langName === 'Original') return /\boriginal\b/i;
  const code = (originalLanguage || '').trim().toLowerCase();
  const extraCode = code && code.length === 2 ? `|${code}` : '';
  return new RegExp(`\\b(${langName.toLowerCase()}${extraCode})\\b`, 'i');
}

function getPreferredAudioRegex(): RegExp | null {
  try {
    const pref = localStorage.getItem('kinostream_preferred_audio')?.trim();
    if (!pref) return null;
    const escaped = pref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
  } catch {
    return null;
  }
}

async function resolveFromCustomEndpoints(
  params: StreamQueryParams
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  const endpoints = storageService.getJsonEndpoints().filter((e) => e.enabled);
  const sources: StreamSource[] = [];
  const subtitles: SubtitleTrack[] = [];
  const fallbackLang = getDefaultAudioLanguage(params.originalLanguage);

  for (const endpoint of endpoints) {
    const resolvedUrl = interpolateTemplate(endpoint.urlTemplate, params);

    if (endpoint.format === 'hls' || resolvedUrl.includes('.m3u8')) {
      sources.push({
        id: `${endpoint.id}-hls`,
        providerName: endpoint.name,
        label: `${endpoint.name} · Adaptive HLS`,
        quality: 'Auto (HLS)',
        url: resolvedUrl,
        format: 'hls',
        audioLanguage: fallbackLang,
        note: 'Custom configured stream feed',
        isDirectPlayable: true,
      });
      continue;
    }

    if (endpoint.format === 'embed' || resolvedUrl.includes('/embed')) {
      sources.push({
        id: `${endpoint.id}-embed`,
        providerName: endpoint.name,
        label: `${endpoint.name} · Web Stream`,
        quality: '1080p Web',
        url: resolvedUrl,
        format: 'embed',
        audioLanguage: fallbackLang,
        note: 'Custom configured embed stream provider',
        isDirectPlayable: true,
      });
      continue;
    }

    if (endpoint.format === 'mp4' || resolvedUrl.endsWith('.mp4')) {
      sources.push({
        id: `${endpoint.id}-mp4`,
        providerName: endpoint.name,
        label: `${endpoint.name} · Direct MP4`,
        quality: '1080p',
        url: resolvedUrl,
        format: 'mp4',
        audioLanguage: fallbackLang,
        note: 'Custom direct video mirror',
        isDirectPlayable: true,
      });
      continue;
    }

    const controller = new AbortController();
    const timerFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    const clearTimerFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
    const timeout = timerFn(() => controller.abort(), 6000);
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(resolvedUrl)}`, {
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        streams?: Array<{
          url: string;
          quality?: string;
          format?: 'hls' | 'mp4';
          label?: string;
          language?: string;
        }>;
        subtitles?: Array<{
          url: string;
          label?: string;
          language?: string;
          format?: 'vtt' | 'srt';
        }>;
      };

      (payload.streams || []).forEach((s, idx) => {
        if (!s.url) return;
        sources.push({
          id: `${endpoint.id}-json-${idx}`,
          providerName: endpoint.name,
          label: s.label || `${endpoint.name} · ${s.quality || 'HD'}`,
          quality: s.quality || '1080p',
          url: s.url,
          format: s.format || (s.url.includes('.m3u8') ? 'hls' : 'mp4'),
          audioLanguage: s.language || fallbackLang,
          isDirectPlayable: true,
        });
      });

      (payload.subtitles || []).forEach((sub, idx) => {
        if (!sub.url) return;
        subtitles.push({
          id: `${endpoint.id}-sub-${idx}`,
          label: sub.label || sub.language || `Subtitle ${idx + 1}`,
          language: sub.language || 'en',
          url: sub.url,
          format: sub.format || (sub.url.endsWith('.srt') ? 'srt' : 'vtt'),
        });
      });
    } catch {
      // Skip unreachable custom endpoint
    } finally {
      clearTimerFn(timeout);
    }
  }

  return { sources, subtitles };
}

async function resolveArchiveStreams(params: StreamQueryParams): Promise<StreamSource[]> {
  if (!params.archiveIdentifier) {
    return [];
  }
  try {
    return await archiveMovieService.resolveStreamsForIdentifier(
      params.archiveIdentifier,
      params.originalLanguage
    );
  } catch {
    return [];
  }
}

async function resolveTmdbTrailers(params: StreamQueryParams): Promise<StreamSource[]> {
  if (!params.tmdbId || params.archiveIdentifier || params.dejavuId) return [];

  try {
    const videos = await tmdbService.getMediaVideos(params.tmdbId, params.mediaType);
    const trailers = videos.filter(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.official)
    );

    return trailers.slice(0, 2).map((v) => ({
      id: `tmdb-trailer-${v.key}`,
      providerName: 'TMDB & YouTube',
      label: `${v.name || 'Official Trailer'} · HD`,
      quality: '1080p Official',
      url: `https://www.youtube-nocookie.com/embed/${v.key}?autoplay=1&rel=0`,
      format: 'youtube',
      note: 'Official HD studio trailer',
      isDefault: false,
      isDirectPlayable: true,
    }));
  } catch {
    return [];
  }
}

function matchesEpisodeFilter(source: StreamSource, params: StreamQueryParams): boolean {
  if (source.id.startsWith('bengali-') || source.isFullEpisode) return true;
  if (params.mediaType !== 'tv' || !params.seasonNumber || !params.episodeNumber) return true;
  const text = `${source.label} ${source.note || ''}`;
  const exact = new RegExp(
    `(?:s0?${params.seasonNumber}[\\s._-]*e0?${params.episodeNumber}\\b|\\b${params.seasonNumber}x0?${params.episodeNumber}\\b)`,
    'i'
  );
  if (exact.test(text)) return true;
  if (/s\d{1,2}[\s._-]*e\d{1,2}|\d{1,2}x\d{1,2}/i.test(text)) return false;
  return true;
}

function rankSource(
  s: StreamSource,
  preferredRegex: RegExp | null,
  originalRegex: RegExp
): number {
  if (s.format === 'youtube' && !s.isFullEpisode) return 50;
  if (s.format === 'youtube' && s.isFullEpisode) return 1.5;
  if (s.format === 'embed') return 20;
  const meta = `${s.audioLanguage || ''} ${s.label} ${s.note || ''}`;
  const isP2P = s.url.includes('/api/torrent/stream');
  let score = s.isVerified && s.isDirectPlayable !== false && !isP2P ? 0 : !isP2P ? 2 : 4;

  const isDual = /(dual|multi)|\+/i.test(meta);
  if (preferredRegex && preferredRegex.test(meta)) score += 0;
  else if (isDual) score += 0.2;
  else if (originalRegex.test(meta)) score += 0.35;
  else if (/(english|eng)/i.test(meta)) score += 0.8;
  else if (/(hindi|bengali|tamil|telugu|malayalam|french|russian|spanish|german)/i.test(meta))
    score += 3.5;
  else score += 1.2;

  if (/(cam|hdcam|ts|telesync|hdts)/i.test(meta)) score += 6;
  if (/(hevc|x265|h265|\.mkv)/i.test(meta)) score += 1.5;
  return score;
}

function mergeResults(lists: StreamSource[][], params: StreamQueryParams): StreamSource[] {
  const deduplicated = new Map<string, StreamSource>();
  const seenIds = new Set<string>();

  for (const list of lists) {
    for (const s of list) {
      if (!s.url || !matchesEpisodeFilter(s, params)) continue;
      const langKey = (s.audioLanguage || '').trim().toLowerCase();
      const key = `${s.url}::${langKey}`;
      const existing = deduplicated.get(key);
      if (!existing) {
        let uniqueId = s.id;
        let suffix = 2;
        while (seenIds.has(uniqueId)) {
          uniqueId = `${s.id}-${suffix++}`;
        }
        seenIds.add(uniqueId);
        deduplicated.set(key, { ...s, id: uniqueId, isDefault: false });
      } else if (s.extensionName && !existing.extensionName) {
        existing.extensionName = s.extensionName;
      }
    }
  }

  const preferredRegex = getPreferredAudioRegex();
  const originalRegex = getOriginalLanguageRegex(params.originalLanguage);

  const allSources = Array.from(deduplicated.values()).sort((a, b) => {
    const diff = rankSource(a, preferredRegex, originalRegex) - rankSource(b, preferredRegex, originalRegex);
    if (Math.abs(diff) > 0.01) return diff;
    if (a.format !== b.format) return a.format === 'hls' ? -1 : 1;
    return (b.seeders || 0) - (a.seeders || 0);
  });

  if (allSources.length > 0) {
    allSources[0].isDefault = true;
  }
  return allSources;
}

function deduplicateSubtitles(tracks: SubtitleTrack[]): SubtitleTrack[] {
  const seen = new Set<string>();
  const result: SubtitleTrack[] = [];
  for (const sub of tracks) {
    if (!sub?.url) continue;
    const key = `${(sub.language || '').trim().toLowerCase()}::${sub.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sub);
  }
  return result;
}

function isLikelyAnimeTitle(params: StreamQueryParams): boolean {
  if (params.genreIds?.includes(16)) return true;
  if (['ja', 'zh', 'ko'].includes(params.originalLanguage || '')) return true;
  return false;
}

class DecoupledStreamProviderService implements IStreamProviderService {
  private async resolveStreamsInternal(
    params: StreamQueryParams,
    effectiveType: MediaType,
    options?: StreamResolveOptions
  ): Promise<StreamResolutionResult> {
    const emptyRes: StreamResolutionResult = { sources: [], subtitles: [] };
    const toggles = storageService.getProviderToggles();
    const isBengaliCandidate = bengaliSerialService.isBengaliSerialOrCartoon({
      title: params.title,
      originalLanguage: params.originalLanguage,
      bengaliSerialSlug: params.bengaliSerialSlug,
    });
    const isCustomBengaliOnly = Boolean(
      params.bengaliSerialSlug || (params.tmdbId >= 895000 && params.tmdbId <= 899999)
    );

    const nuvioSources: StreamSource[] = [];
    const nuvioSubtitles: SubtitleTrack[] = [];
    let archiveSources: StreamSource[] = [];
    const stremioSources: StreamSource[] = [];
    let customRes: StreamResolutionResult = { sources: [], subtitles: [] };
    let dejavuRes: StreamResolutionResult = { sources: [], subtitles: [] };
    let anikotoRes: StreamResolutionResult = { sources: [], subtitles: [] };
    let bengaliSources: StreamSource[] = [];
    let settled = false;

    const buildSnapshot = (): StreamResolutionResult => {
      const verifiedArchive = archiveSources.map((s) => ({ ...s, isVerified: true }));
      const rawCandidates = mergeResults(
        [
          verifiedArchive,
          bengaliSources,
          nuvioSources,
          stremioSources,
          dejavuRes.sources,
          customRes.sources,
          anikotoRes.sources,
        ],
        params
      );

      let cloudStreamSources: StreamSource[] = [];
      if (toggles.cloudstream !== false && rawCandidates.length > 0) {
        try {
          cloudStreamSources = cloudStreamProviderResolver.resolveStreams(params, rawCandidates);
        } catch {
          cloudStreamSources = [];
        }
      }

      const allSources = mergeResults([rawCandidates, cloudStreamSources], params);
      return {
        sources: allSources,
        subtitles: deduplicateSubtitles([
          ...nuvioSubtitles,
          ...customRes.subtitles,
          ...dejavuRes.subtitles,
        ]),
      };
    };

    const emitProgress = () => {
      if (settled || !options?.onProgress) return;
      try {
        const snap = buildSnapshot();
        if (snap.sources.length > 0 || snap.subtitles.length > 0) {
          options.onProgress(snap);
        }
      } catch {
        // Ignore progress listener failure
      }
    };

    await Promise.allSettled([
      toggles.nuvio !== false && !isCustomBengaliOnly
        ? nuvioService
            .resolveStreams(
              {
                tmdbId: params.tmdbId,
                mediaType: effectiveType,
                title: params.title,
                releaseYear: params.releaseYear,
                seasonNumber: params.seasonNumber,
                episodeNumber: params.episodeNumber,
                isArchiveItem: Boolean(params.archiveIdentifier || params.dejavuId),
              },
              (batch) => {
                if (batch.sources.length > 0) nuvioSources.push(...batch.sources);
                if (batch.subtitles.length > 0) nuvioSubtitles.push(...batch.subtitles);
                emitProgress();
              }
            )
            .catch(() => emptyRes)
        : Promise.resolve(emptyRes),

      resolveArchiveStreams(params)
        .then((res) => {
          archiveSources = res;
          if (res.length > 0) emitProgress();
        })
        .catch(() => []),

      toggles.stremio !== false && !isCustomBengaliOnly
        ? stremioAddonService
            .resolveStreams(
              {
                tmdbId: params.tmdbId,
                imdbId: params.imdbId,
                mediaType: effectiveType,
                title: params.title,
                releaseYear: params.releaseYear,
                seasonNumber: params.seasonNumber,
                episodeNumber: params.episodeNumber,
              },
              (batch) => {
                if (batch.length > 0) {
                  stremioSources.push(...batch);
                  emitProgress();
                }
              }
            )
            .catch(() => [] as StreamSource[])
        : Promise.resolve([] as StreamSource[]),

      resolveFromCustomEndpoints(params)
        .then((res) => {
          customRes = res;
          if (res.sources.length > 0 || res.subtitles.length > 0) emitProgress();
        })
        .catch(() => emptyRes),

      toggles.dejavu !== false && !isCustomBengaliOnly
        ? dejavuApiService
            .resolveStreamsForTitle({
              dejavuId: params.dejavuId,
              title: params.title,
              mediaType: effectiveType,
            })
            .then((res) => {
              dejavuRes = res;
              if (res.sources.length > 0 || res.subtitles.length > 0) emitProgress();
            })
            .catch(() => emptyRes)
        : Promise.resolve(emptyRes),

      isLikelyAnimeTitle(params) && !isBengaliCandidate
        ? (effectiveType === 'tv'
            ? streamConnector.resolveEpisodeStreams(params)
            : streamConnector.resolveMovieStreams(params)
          )
            .then((res) => {
              anikotoRes = res;
              if (res.sources.length > 0) emitProgress();
            })
            .catch(() => emptyRes)
        : Promise.resolve(emptyRes),

      toggles.bengali_serials !== false && isBengaliCandidate
        ? bengaliSerialService
            .resolveStreams({
              title: params.title,
              seasonNumber: params.seasonNumber,
              episodeNumber: params.episodeNumber,
              episodeTitle: params.episodeTitle,
              preferredVideoId: params.preferredVideoId,
            })
            .then((res) => {
              bengaliSources = res;
              if (res.length > 0) emitProgress();
            })
            .catch(() => [] as StreamSource[])
        : Promise.resolve([] as StreamSource[]),
    ]);

    settled = true;
    const finalResult = buildSnapshot();

    if (finalResult.sources.length === 0) {
      const trailerSources = await resolveTmdbTrailers(params);
      return {
        sources: mergeResults([trailerSources], params),
        subtitles: finalResult.subtitles,
      };
    }

    return finalResult;
  }

  async resolveMovieStreams(
    params: StreamQueryParams,
    options?: StreamResolveOptions
  ): Promise<StreamResolutionResult> {
    return this.resolveStreamsInternal(params, params.mediaType, options);
  }

  async resolveEpisodeStreams(
    params: StreamQueryParams,
    options?: StreamResolveOptions
  ): Promise<StreamResolutionResult> {
    return this.resolveStreamsInternal(params, 'tv', options);
  }
}

export const streamProviderService: IStreamProviderService =
  new DecoupledStreamProviderService();
