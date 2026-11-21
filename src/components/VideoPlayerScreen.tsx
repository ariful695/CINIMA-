import Hls from 'hls.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Captions,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Gauge,
  Languages,
  Loader2,
  Lock,
  Maximize,
  Maximize2,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sun,
  Unlock,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { resolveStremioLiveStreamUrl } from '../services/liveTvAddonService';
import {
  resolveSubtitleTrackUrl,
  streamProviderService,
} from '../services/streamProviderService';
import { useAppState } from '../state/AppContext';
import {
  PlayerSession,
  StreamSource,
  SubtitleTrack,
  THEME_ACCENTS,
} from '../types/media';
import {
  extractLanguageTags,
  getAvailableLanguages,
  getAvailableProviders,
  getCanonicalProviderName,
  getSourceFlags,
  matchesQualityFilter,
  matchesSourceTypeFilter,
  QualityFilter,
  SourceTypeFilter,
} from '../utils/streamFilters';

interface P2PPrebufferStatus {
  ready: boolean;
  infoHash: string;
  fileIdx?: number;
  fileName?: string;
  fileLength?: number;
  peers: number;
  seeders: number;
  speedKbps: number;
  prebufferMb: number;
  prebufferedBytes: number;
  targetBytes: number;
  headReady: boolean;
  tailReady: boolean;
  progressPct: number;
  readyToPlay: boolean;
  error?: string;
}

interface VideoPlayerScreenProps {
  session: PlayerSession;
}

interface HlsQualityLevel {
  index: number;
  label: string;
}

interface AudioTrackOption {
  index: number;
  label: string;
  lang?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function extractLangTokens(label?: string): string[] {
  if (!label) return [];
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[+/|,&]/)
    .map((part) => part.trim())
    .filter(
      (t) =>
        Boolean(t) &&
        t !== 'dual' &&
        t !== 'multi' &&
        t !== 'audio' &&
        t !== 'multi-audio' &&
        t !== 'original' &&
        !/^\d+\s*more$/.test(t)
    );
}

/**
 * Automatically chooses the most compatible server stream for the user's browser,
 * prioritizing direct playable HLS, direct MP4, HTTPS streams, and matching audio language.
 */
function selectMostCompatibleSource(
  sourcesList: StreamSource[],
  failedSet?: Set<string>,
  targetLanguage?: string,
  directPlayOnly = false
): StreamSource | null {
  if (!sourcesList || sourcesList.length === 0) return null;
  let pool = failedSet && failedSet.size > 0
    ? sourcesList.filter((s) => !failedSet.has(s.id))
    : sourcesList;
  if (directPlayOnly) {
    pool = pool.filter((s) => s.format === 'hls' || s.format === 'mp4');
  }
  const candidatePool = pool.length > 0 ? pool : (directPlayOnly ? [] : sourcesList);
  if (candidatePool.length === 0) return null;

  const target = (targetLanguage || '').toLowerCase().trim();
  const targetTokens = extractLangTokens(targetLanguage);

  const scored = candidatePool.map((s) => {
    let score = 0;
    const url = (s.url || '').toLowerCase();
    const lang = (s.audioLanguage || '').toLowerCase().trim();
    const sourceTokens = extractLangTokens(s.audioLanguage);

    // 1. Language matching: strict token-aware matching so Hindi never falls back to English-only
    if (target) {
      if (lang === target) {
        score += 1500;
      } else if (
        targetTokens.length > 0 &&
        sourceTokens.length > 0 &&
        targetTokens.some((tt) => sourceTokens.includes(tt))
      ) {
        // Check if primary requested language (e.g. Hindi in "Hindi + English") is present in source
        const primaryTarget = targetTokens[0];
        score += sourceTokens.includes(primaryTarget) ? 1300 : 900;
      } else {
        score -= 2000;
      }
    }

    // 1.5 Verified live stream bonus
    if (s.isVerified) {
      score += 600;
    }

    // 2. Browser playable format hierarchy (HLS > MP4 > embed > youtube)
    if (s.format === 'hls' || url.includes('.m3u8')) {
      score += 300;
    } else if (s.format === 'mp4' || url.includes('.mp4')) {
      score += 250;
    } else if (s.format === 'embed') {
      score += 50;
    } else if (s.format === 'youtube') {
      score += 10;
    }

    // 3. Direct HTTPS or same-origin proxy protocol (prefer instant CDN streams over slower P2P swarm startup)
    if (url.includes('/api/torrent/stream')) {
      score -= 180;
    } else if (url.startsWith('/api/') || url.startsWith('https://')) {
      score += 150;
    }

    // 4. Penalize slow FFmpeg remux compared to native direct HLS/MP4, and heavily penalize unplayable MKV
    if (url.includes('remux=1')) {
      score -= 120;
    } else if (s.isDirectPlayable === false && !url.includes('/api/')) {
      score -= 500;
    }

    // 5. Reliability bonus for CDN / direct archive streams
    if (url.includes('archive.org') || url.includes('fastly') || url.includes('akamai') || url.includes('cloudflare')) {
      score += 40;
    }

    // 6. Quality tier hint
    const qual = (s.quality || '').toLowerCase();
    if (qual.includes('1080') || qual.includes('master') || qual.includes('hd')) {
      score += 20;
    } else if (qual.includes('720')) {
      score += 10;
    }

    return { source: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (!scored[0]) return null;
  if (targetLanguage && scored[0].score <= -1000) {
    return null;
  }
  return scored[0].source;
}

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({ session }) => {
  const {
    closePlayback,
    saveWatchProgress,
    liveChannels,
    startPlayback,
    channelHealthMap,
    markChannelHealth,
    themeColor,
  } = useAppState();
  const accent = THEME_ACCENTS[themeColor || 'red'];
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hlsActiveRef = useRef(false);
  const controlsTimerRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const failedSourceIdsRef = useRef<Set<string>>(new Set());
  const userLockedLanguageRef = useRef<boolean>(false);
  const p2pBypassForSourceRef = useRef<string | null>(null);

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeSource, setActiveSource] = useState<StreamSource | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [resolvedSubUrls, setResolvedSubUrls] = useState<Record<string, string>>({});
  const [activeSubtitleId, setActiveSubtitleId] = useState<string>('off');
  const [activeCueText, setActiveCueText] = useState<string>('');

  const [p2pStatus, setP2pStatus] = useState<P2PPrebufferStatus | null>(null);
  const [p2pAttachUrl, setP2pAttachUrl] = useState<string | null>(null);
  const [p2pBypassTick, setP2pBypassTick] = useState(0);

  const [hlsLevels, setHlsLevels] = useState<HlsQualityLevel[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1); // -1 = Auto
  const [hlsAudioTracks, setHlsAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(session.initialTime || 0);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');

  const [showControls, setShowControls] = useState(true);
  const [openMenu, setOpenMenu] = useState<'none' | 'language' | 'quality' | 'subtitles' | 'speed' | 'sources'>('none');

  // In-player Sources drawer filters
  const [drawerTypeFilter, setDrawerTypeFilter] = useState<SourceTypeFilter>('all');
  const [drawerProviderFilter, setDrawerProviderFilter] = useState<string>('All');
  const [drawerLanguageFilter, setDrawerLanguageFilter] = useState<string>('All');
  const [drawerQualityFilter, setDrawerQualityFilter] = useState<QualityFilter>('all');

  const sourcesRef = useRef<StreamSource[]>([]);
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  // Touch/Pointer swipe gesture HUD state
  const [gestureHud, setGestureHud] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);
  const gestureStartRef = useRef<{
    y: number;
    side: 'left' | 'right';
    startVal: number;
  } | null>(null);

  const isLive = session.mediaType === 'live';

  const switchLiveChannel = useCallback(
    (direction: 1 | -1) => {
      if (!isLive || liveChannels.length <= 1 || !session.liveChannel) return;
      const httpsPool = liveChannels.filter((c) => c.streamUrl.startsWith('https://'));
      const pool = httpsPool.length > 0 ? httpsPool : liveChannels;
      const currentIdx = pool.findIndex((c) => c.id === session.liveChannel?.id);
      const startIdx = currentIdx >= 0 ? currentIdx : 0;

      // Prefer the next channel that isn't already known to be CORS-blocked
      let chosen = pool[(startIdx + direction + pool.length) % pool.length];
      for (let step = 1; step < pool.length; step += 1) {
        const idx = (startIdx + step * direction + pool.length) % pool.length;
        const candidate = pool[idx];
        if (channelHealthMap[candidate.id] !== false) {
          chosen = candidate;
          break;
        }
      }

      if (chosen) {
        startPlayback({
          mediaId: 0,
          mediaType: 'live',
          title: chosen.name,
          subtitle: `${chosen.group} · ${chosen.playlistName}`,
          liveChannel: chosen,
        });
      }
    },
    [isLive, liveChannels, session.liveChannel, channelHealthMap, startPlayback]
  );

  // Resolve stream sources & subtitles on mount
  useEffect(() => {
    failedSourceIdsRef.current.clear();
    userLockedLanguageRef.current = false;
    p2pBypassForSourceRef.current = null;
    setDrawerTypeFilter('all');
    setDrawerProviderFilter('All');
    setDrawerLanguageFilter('All');
    setDrawerQualityFilter('all');
    let active = true;
    const init = async () => {
      if (isLive && session.liveChannel) {
        const ch = session.liveChannel;
        let candidateSources: StreamSource[] = [];

        const isJsonEndpoint =
          ch.streamUrl.includes('.json') ||
          ch.streamUrl.includes('/stream/tv/') ||
          ch.streamUrl.includes('/stream/sport/');

        if (isJsonEndpoint) {
          const fetchTarget = ch.streamUrl.startsWith('/api/')
            ? ch.streamUrl
            : `/api/proxy?url=${encodeURIComponent(ch.streamUrl)}`;
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 6000);
          try {
            const res = await fetch(fetchTarget, { signal: controller.signal });
            if (res.ok) {
              const data = (await res.json()) as {
                streams?: Array<{
                  url?: string;
                  externalUrl?: string;
                  title?: string;
                  name?: string;
                  behaviorHints?: {
                    proxyHeaders?: { request?: Record<string, string> };
                    headers?: Record<string, string>;
                  };
                }>;
              };
              if (Array.isArray(data.streams) && data.streams.length > 0) {
                candidateSources = data.streams
                  .filter((s) => Boolean(s.url || s.externalUrl))
                  .map((s, idx) => {
                    const raw = s.url || s.externalUrl || '';
                    const reqHeaders =
                      s.behaviorHints?.proxyHeaders?.request || s.behaviorHints?.headers;
                    let target = raw;
                    if (!raw.startsWith('/api/')) {
                      let hParam = '';
                      if (reqHeaders && Object.keys(reqHeaders).length > 0) {
                        try {
                          hParam = btoa(JSON.stringify(reqHeaders))
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=+$/, '');
                        } catch {}
                      }
                      target = `/api/stream-proxy?url=${encodeURIComponent(raw)}${hParam ? `&h=${encodeURIComponent(hParam)}` : ''}`;
                    }
                    return {
                      id: `${ch.id}-src-${idx}`,
                      providerName: s.name || ch.playlistName,
                      label: `${ch.name} · ${s.title ? s.title.split('\n')[0] : `Server ${idx + 1}`}`,
                      quality: s.title?.match(/\b(1080p|720p|480p|4k)\b/i)?.[0] || 'Auto (Live)',
                      url: target,
                      format: (raw.includes('.mp4') ? 'mp4' : 'hls') as 'mp4' | 'hls',
                      isVerified: true,
                    };
                  });
              }
            }
          } catch (err) {
            console.warn('Failed to resolve Stremio live stream endpoint', err);
          } finally {
            window.clearTimeout(timer);
          }

          if (candidateSources.length === 0) {
            const unwrappedUrl = await resolveStremioLiveStreamUrl(fetchTarget);
            if (unwrappedUrl && !unwrappedUrl.includes('/stream/')) {
              const finalTarget = unwrappedUrl.startsWith('/api/')
                ? unwrappedUrl
                : `/api/stream-proxy?url=${encodeURIComponent(unwrappedUrl)}`;
              candidateSources = [
                {
                  id: `${ch.id}-unwrapped`,
                  providerName: ch.playlistName,
                  label: `${ch.name} · Live Stream`,
                  quality: 'Auto (Live)',
                  url: finalTarget,
                  format: unwrappedUrl.includes('.mp4') ? 'mp4' : 'hls',
                  isVerified: true,
                },
              ];
            }
          }
        }

        if (candidateSources.length === 0 && !isJsonEndpoint) {
          let playUrl = ch.streamUrl;
          if (
            (playUrl.startsWith('http://') || playUrl.startsWith('https://')) &&
            !playUrl.startsWith('/api/')
          ) {
            playUrl = `/api/stream-proxy?url=${encodeURIComponent(playUrl)}`;
          }
          const liveSrc: StreamSource = {
            id: ch.id,
            providerName: ch.playlistName,
            label: `${ch.name} · Live HLS`,
            quality: 'Auto (Live)',
            url: playUrl,
            format: playUrl.includes('.mp4') ? 'mp4' : 'hls',
            isVerified: true,
          };
          candidateSources = [liveSrc];
        }

        if (!active) return;
        setSources(candidateSources);
        setActiveSource(candidateSources[0]);
        setSubtitles([]);
        return;
      }

      if (session.initialSources && session.initialSources.length > 0) {
        if (!active) return;
        setSources(session.initialSources);
        const preferred =
          (session.preferredSourceId
            ? session.initialSources.find((s) => s.id === session.preferredSourceId)
            : null) ||
          selectMostCompatibleSource(session.initialSources) ||
          session.initialSources[0] ||
          null;
        setActiveSource(preferred);
        const initSubs = session.initialSubtitles || [];
        setSubtitles(initSubs);
        if (initSubs.length > 0) {
          const urlMap: Record<string, string> = {};
          await Promise.all(
            initSubs.map(async (sub) => {
              urlMap[sub.id] = await resolveSubtitleTrackUrl(sub);
            })
          );
          if (active) setResolvedSubUrls(urlMap);
        }
        return;
      }

      const resolved =
        session.mediaType === 'tv'
          ? await streamProviderService.resolveEpisodeStreams({
              tmdbId: session.mediaId,
              imdbId: session.imdbId,
              dejavuId: session.dejavuId,
              archiveIdentifier: session.archiveIdentifier,
              mediaType: 'tv',
              title: session.title,
              genreIds: session.genreIds,
              originalLanguage: session.originalLanguage,
              releaseYear: session.releaseYear,
              seasonNumber: session.seasonNumber,
              episodeNumber: session.episodeNumber,
            })
          : await streamProviderService.resolveMovieStreams({
              tmdbId: session.mediaId,
              imdbId: session.imdbId,
              dejavuId: session.dejavuId,
              archiveIdentifier: session.archiveIdentifier,
              mediaType: 'movie',
              title: session.title,
              genreIds: session.genreIds,
              originalLanguage: session.originalLanguage,
              releaseYear: session.releaseYear,
            });

      if (!active) return;
      setSources(resolved.sources);
      const preferred =
        (session.preferredSourceId
          ? resolved.sources.find((s) => s.id === session.preferredSourceId)
          : null) ||
        selectMostCompatibleSource(resolved.sources) ||
        resolved.sources[0] ||
        null;
      setActiveSource(preferred);
      setSubtitles(resolved.subtitles);
      if (!preferred) {
        setIsBuffering(false);
        setStreamError('No playable stream servers were found for this title.');
      }

      const urlMap: Record<string, string> = {};
      await Promise.all(
        resolved.subtitles.map(async (sub) => {
          urlMap[sub.id] = await resolveSubtitleTrackUrl(sub);
        })
      );
      if (active) setResolvedSubUrls(urlMap);
    };

    void init();
    return () => {
      active = false;
    };
  }, [session, isLive]);

  // Persist watch progress helper
  const persistProgress = useCallback(
    (timeVal: number, durVal: number) => {
      if (isLive || durVal <= 5 || timeVal < 3) return;
      const key =
        session.mediaType === 'tv'
          ? `tv-${session.mediaId}-s${session.seasonNumber || 1}e${session.episodeNumber || 1}`
          : `movie-${session.mediaId}`;

      saveWatchProgress({
        key,
        mediaId: session.mediaId,
        mediaType: session.mediaType === 'tv' ? 'tv' : 'movie',
        title: session.title,
        posterPath: session.posterPath || null,
        backdropPath: session.backdropPath || null,
        fallbackPoster: session.fallbackPoster,
        fallbackBackdrop: session.fallbackBackdrop,
        seasonNumber: session.seasonNumber,
        episodeNumber: session.episodeNumber,
        episodeTitle: session.episodeTitle,
        currentTime: timeVal,
        duration: durVal,
        updatedAt: Date.now(),
      });
    },
    [isLive, session, saveWatchProgress]
  );

  const safePlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      const promise = video.play();
      playPromiseRef.current = promise;
      await promise;
      setIsPlaying(true);
      setIsBuffering(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setIsPlaying(false);
      setIsBuffering(false);
    } finally {
      playPromiseRef.current = null;
    }
  }, []);

  const safePause = useCallback(
    async (video: HTMLVideoElement) => {
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch {
          // Ignore aborted in-flight play request
        }
      }
      video.pause();
      setIsPlaying(false);
      persistProgress(video.currentTime, video.duration);
    },
    [persistProgress]
  );

  const isActiveP2PTorrent = Boolean(
    activeSource &&
      activeSource.format !== 'youtube' &&
      activeSource.format !== 'embed' &&
      activeSource.url.includes('/api/torrent/stream') &&
      !activeSource.url.includes('p2p=0')
  );

  const handlePlaybackFailure = useCallback(
    (source: StreamSource | null, errorMsg: string) => {
      if (isLive && session.liveChannel) {
        markChannelHealth(session.liveChannel.id, false);
      }
      if (source && !isLive) {
        failedSourceIdsRef.current.add(source.id);
        const pool = sourcesRef.current;
        if (failedSourceIdsRef.current.size < 5 && pool.length > 1) {
          const targetLang = source.audioLanguage;
          // Try matching language first; if exhausted and language wasn't manually locked, fall back to best playable mirror
          const sameLangFallback = targetLang
            ? selectMostCompatibleSource(pool, failedSourceIdsRef.current, targetLang, true)
            : null;
          const anyLangFallback =
            sameLangFallback ||
            (!userLockedLanguageRef.current
              ? selectMostCompatibleSource(pool, failedSourceIdsRef.current, undefined, true)
              : null);
          if (anyLangFallback && anyLangFallback.id !== source.id) {
            setActiveSource(anyLangFallback);
            return;
          }
        }
      }
      setStreamError(errorMsg);
      setIsBuffering(false);
    },
    [isLive, session.liveChannel, markChannelHealth]
  );

  // P2P Torrent preparation + sequential pre-buffering status polling before attaching <video>
  useEffect(() => {
    if (!activeSource || !isActiveP2PTorrent) {
      setP2pStatus(null);
      setP2pAttachUrl(null);
      return;
    }

    if (p2pBypassForSourceRef.current === activeSource.id) {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    let cancelled = false;
    setP2pAttachUrl(null);
    setStreamError(null);
    setIsBuffering(true);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(activeSource.url, window.location.origin);
    } catch {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    const infoHash = parsedUrl.searchParams.get('infoHash') || '';
    const fileIdx = parsedUrl.searchParams.get('fileIdx');
    const season = parsedUrl.searchParams.get('season');
    const episode = parsedUrl.searchParams.get('episode');
    const tr = parsedUrl.searchParams.get('tr');
    const prebufferMb = Number(parsedUrl.searchParams.get('prebufferMb') || 10);

    if (!infoHash) {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    const baseParams = new URLSearchParams({
      infoHash,
      p2p: '1',
      prebufferMb: String(prebufferMb),
    });
    if (fileIdx !== null && fileIdx !== '') baseParams.set('fileIdx', fileIdx);
    if (season) baseParams.set('season', season);
    if (episode) baseParams.set('episode', episode);

    const prepareParams = new URLSearchParams(baseParams);
    if (tr) prepareParams.set('tr', tr);

    setP2pStatus({
      ready: false,
      infoHash,
      peers: 0,
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

    const controller = new AbortController();
    let pollTimer: number | null = null;
    let maxWaitTimer: number | null = null;

    const stopTimers = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (maxWaitTimer !== null) {
        window.clearTimeout(maxWaitTimer);
        maxWaitTimer = null;
      }
    };

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/torrent/status?${baseParams.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as P2PPrebufferStatus;
        if (cancelled) return;
        setP2pStatus(data);
        if (data.readyToPlay) {
          stopTimers();
          setP2pAttachUrl(activeSource.url);
        }
      } catch {
        // Ignore transient status poll aborts
      }
    };

    pollTimer = window.setInterval(() => {
      void pollStatus();
    }, 850);

    maxWaitTimer = window.setTimeout(() => {
      if (cancelled) return;
      stopTimers();
      controller.abort();
      handlePlaybackFailure(
        activeSource,
        'P2P torrent swarm has too few peers or timed out while pre-buffering. Click Continue to switch servers or Continue Anyway in a lower buffer.'
      );
    }, 45000);

    const runPrepare = async () => {
      try {
        const prepareTimer = window.setTimeout(() => controller.abort(), 38000);
        const res = await fetch(`/api/torrent/prepare?${prepareParams.toString()}`, {
          method: 'POST',
          signal: controller.signal,
        });
        window.clearTimeout(prepareTimer);
        if (cancelled) return;
        if (!res.ok) {
          stopTimers();
          const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
          handlePlaybackFailure(
            activeSource,
            errPayload.error || 'Unable to connect to torrent peers for this source.'
          );
          return;
        }
        const data = (await res.json()) as P2PPrebufferStatus;
        if (cancelled) return;
        setP2pStatus(data);
        if (data.readyToPlay) {
          stopTimers();
          setP2pAttachUrl(activeSource.url);
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        stopTimers();
        handlePlaybackFailure(
          activeSource,
          'P2P torrent swarm connection failed. Click Continue to try the next server.'
        );
      }
    };

    void runPrepare();

    return () => {
      cancelled = true;
      stopTimers();
      controller.abort();
    };
  }, [activeSource, isActiveP2PTorrent, reloadTick, p2pBypassTick, handlePlaybackFailure]);

  // Attach HLS.js or direct MP4 source when activeSource (and P2P pre-buffer if needed) is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;

    if (activeSource.format === 'youtube' || activeSource.format === 'embed') {
      setIsBuffering(false);
      setIsPlaying(true);
      return;
    }

    if (isActiveP2PTorrent && p2pAttachUrl !== activeSource.url) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      hlsActiveRef.current = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    let cancelled = false;
    let startupStallTimer: number | null = null;
    setStreamError(null);
    setIsBuffering(true);
    setHlsLevels([]);
    setSelectedHlsLevel(-1);
    setHlsAudioTracks([]);
    setSelectedAudioTrack(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const startTime = session.initialTime && session.initialTime > 3 ? session.initialTime : 0;

    const clearStallTimer = () => {
      if (startupStallTimer !== null) {
        window.clearTimeout(startupStallTimer);
        startupStallTimer = null;
      }
    };

    const syncNativeAudioTracks = () => {
      const nativeTracks = (
        video as HTMLVideoElement & {
          audioTracks?: ArrayLike<{ label?: string; language?: string; enabled: boolean }>;
        }
      ).audioTracks;
      if (nativeTracks && nativeTracks.length > 1) {
        const mapped: AudioTrackOption[] = [];
        let activeIdx = 0;
        for (let i = 0; i < nativeTracks.length; i += 1) {
          const t = nativeTracks[i];
          if (t.enabled) activeIdx = i;
          mapped.push({
            index: i,
            label: t.label || t.language?.toUpperCase() || `Audio Track ${i + 1}`,
            lang: t.language,
          });
        }
        setHlsAudioTracks(mapped);
        setSelectedAudioTrack(activeIdx);
      }
    };

    const handleLoadedMetadata = () => {
      if (cancelled) return;
      clearStallTimer();
      if (!isLive && startTime > 0 && video.duration > startTime + 2) {
        video.currentTime = startTime;
      }
      video.playbackRate = playbackRate;
      video.volume = isMuted ? 0 : volume;
      if (!hlsActiveRef.current) {
        syncNativeAudioTracks();
      }
      void safePlay(video);
    };

    startupStallTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (video.readyState < 2) {
        handlePlaybackFailure(
          activeSource,
          isLive
            ? 'This live channel did not respond in time. Click Continue/Retry or switch channels.'
            : 'Stream startup timed out without receiving video frames. Click Continue to switch to another server.'
        );
      }
    }, 18000);

    let retryCount = 0;
    let triedNativeFallback = false;

    const tryNativeFallback = () => {
      if (cancelled || triedNativeFallback) return false;
      const canPlayNative =
        activeSource.format === 'mp4' ||
        Boolean(video.canPlayType('application/vnd.apple.mpegurl')) ||
        Boolean(video.canPlayType('application/x-mpegURL'));
      if (!canPlayNative) return false;

      triedNativeFallback = true;
      hlsActiveRef.current = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.src = activeSource.url;
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      return true;
    };

    if (activeSource.format === 'hls' && Hls.isSupported()) {
      hlsActiveRef.current = true;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        backBufferLength: 60,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        manifestLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;

      let didAutoPickAudio = false;
      const syncHlsAudioTracks = () => {
        if (cancelled) return;
        const tracks = (hls.audioTracks || []).map((t, idx) => ({
          index: idx,
          label: t.name || (t.lang ? t.lang.toUpperCase() : `Audio ${idx + 1}`),
          lang: t.lang,
        }));
        if (tracks.length > 0) {
          if (!didAutoPickAudio && tracks.length > 1) {
            didAutoPickAudio = true;
            let urlAudioLang = '';
            try {
              const u = new URL(activeSource.url, window.location.origin);
              urlAudioLang = u.searchParams.get('audioLang') || u.searchParams.get('lang') || '';
            } catch {}
            const wantedTokens = extractLangTokens(urlAudioLang || activeSource.audioLanguage);
            const hlsLangMatchers: Array<{ key: string; regex: RegExp }> = [
              { key: 'hindi', regex: /\b(hi|hin|hindi)\b/i },
              { key: 'bengali', regex: /\b(bn|ben|bengali|bangla)\b/i },
              { key: 'tamil', regex: /\b(ta|tam|tamil)\b/i },
              { key: 'telugu', regex: /\b(te|tel|telugu)\b/i },
              { key: 'english', regex: /\b(en|eng|english)\b/i },
              { key: 'french', regex: /\b(fr|fre|fra|french|français|francais)\b/i },
              { key: 'japanese', regex: /\b(ja|jpn|jap|japanese)\b/i },
              { key: 'korean', regex: /\b(ko|kor|korean)\b/i },
              { key: 'spanish', regex: /\b(es|esp|spa|spanish|español)\b/i },
              { key: 'italian', regex: /\b(it|ita|italian)\b/i },
              { key: 'portuguese', regex: /\b(pt|por|portuguese)\b/i },
              { key: 'russian', regex: /\b(ru|rus|russian)\b/i },
              { key: 'german', regex: /\b(de|ger|deu|german)\b/i },
            ];
            for (const token of wantedTokens) {
              const matcher = hlsLangMatchers.find((m) => m.key === token)?.regex;
              if (!matcher) continue;
              const matched = tracks.find(
                (t) => matcher.test(t.lang || '') || matcher.test(t.label)
              );
              if (matched) {
                if (hls.audioTrack !== matched.index) {
                  hls.audioTrack = matched.index;
                }
                break;
              }
            }
          }
          setHlsAudioTracks(tracks);
          setSelectedAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
        }
      };

      hls.loadSource(activeSource.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        if (cancelled) return;
        const levels: HlsQualityLevel[] = data.levels
          .map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
          }))
          .reverse();
        setHlsLevels(levels);
        syncHlsAudioTracks();
        handleLoadedMetadata();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        syncHlsAudioTracks();
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
        if (cancelled) return;
        setSelectedAudioTrack(data.id);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (cancelled) return;
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount < 2) {
            retryCount += 1;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCount < 2) {
            retryCount += 1;
            hls.recoverMediaError();
            return;
          }
          if (tryNativeFallback()) {
            return;
          }

          clearStallTimer();
          const msg =
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? isLive
                ? 'This broadcast feed is currently unreachable, geo-restricted, or protected by broadcast DRM. Click Continue/Retry, switch to another channel, or add your M3U playlist in Settings > Sources.'
                : 'Network or CORS block prevented loading this stream in the browser.'
              : isLive
              ? 'Playback decoder encountered an issue on this live broadcast stream. Click Continue/Retry or switch channels.'
              : 'Playback decoder encountered an error on this feed.';
          handlePlaybackFailure(activeSource, msg);
        }
      });
    } else {
      hlsActiveRef.current = false;
      video.src = activeSource.url;
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    }

    return () => {
      cancelled = true;
      clearStallTimer();
      hlsActiveRef.current = false;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      const pendingPlay = playPromiseRef.current;
      const cleanupMedia = () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
      if (pendingPlay) {
        void pendingPlay.catch(() => {}).finally(cleanupMedia);
      } else {
        cleanupMedia();
      }
    };
  }, [activeSource, p2pAttachUrl, isActiveP2PTorrent, isLive, safePlay, reloadTick, handlePlaybackFailure]);

  // Sync subtitle track cues to custom caption overlay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = Array.from(video.textTracks);
    tracks.forEach((track) => {
      track.mode = 'hidden';
    });

    if (activeSubtitleId === 'off') {
      setActiveCueText('');
      return;
    }

    const activeIndex = subtitles.findIndex((s) => s.id === activeSubtitleId);
    const targetTrack = activeIndex >= 0 ? video.textTracks[activeIndex] : null;
    if (!targetTrack) {
      setActiveCueText('');
      return;
    }

    targetTrack.mode = 'hidden';

    const onCueChange = () => {
      const cues = targetTrack.activeCues;
      if (cues && cues.length > 0) {
        const lines = Array.from(cues)
          .map((c) => (c as VTTCue).text)
          .filter(Boolean);
        setActiveCueText(lines.join('\n'));
      } else {
        setActiveCueText('');
      }
    };

    targetTrack.addEventListener('cuechange', onCueChange);
    onCueChange();

    return () => {
      targetTrack.removeEventListener('cuechange', onCueChange);
    };
  }, [activeSubtitleId, subtitles, resolvedSubUrls]);

  // Auto-save playback progress every 3 seconds
  useEffect(() => {
    if (isLive) return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && video.duration > 0) {
        persistProgress(video.currentTime, video.duration);
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isLive, persistProgress]);

  // Auto-hide controls timer
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying && openMenu === 'none') {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying, openMenu]);

  useEffect(() => {
    wakeControls();
    return () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    };
  }, [wakeControls]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void safePlay(video);
    } else {
      void safePause(video);
    }
    wakeControls();
  }, [safePlay, safePause, wakeControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video || isLive) return;
      const target = Math.min(video.duration || 0, Math.max(0, video.currentTime + delta));
      video.currentTime = target;
      setCurrentTime(target);
      wakeControls();
    },
    [isLive, wakeControls]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    wakeControls();
  }, [isMuted, wakeControls]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen restricted by browser policy
    }
  }, []);

  const handleClose = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      persistProgress(video.currentTime, video.duration);
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    closePlayback();
  }, [closePlayback, persistProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openMenu !== 'none') setOpenMenu('none');
        else handleClose();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l') {
        e.preventDefault();
        seekBy(10);
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMenu, handleClose, togglePlayPause, seekBy, toggleMute, toggleFullscreen]);

  // Brightness (left half) & Volume (right half) vertical swipe gestures
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if ((e.target as HTMLElement).closest('button, input, select, .player-interactive')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    gestureStartRef.current = {
      y: e.clientY,
      side: isLeft ? 'left' : 'right',
      startVal: isLeft ? brightness : volume,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    wakeControls();
    if (isLocked) return;
    const start = gestureStartRef.current;
    if (!start || e.buttons === 0) return;
    const deltaY = start.y - e.clientY;
    if (Math.abs(deltaY) < 8) return;

    const deltaRatio = deltaY / 220;
    if (start.side === 'left') {
      const next = Math.min(1.5, Math.max(0.25, start.startVal + deltaRatio));
      setBrightness(next);
      setGestureHud({ type: 'brightness', value: Math.round((next / 1.5) * 100) });
    } else {
      const next = Math.min(1, Math.max(0, start.startVal + deltaRatio));
      setVolume(next);
      setIsMuted(next === 0);
      if (videoRef.current) {
        videoRef.current.volume = next;
        videoRef.current.muted = next === 0;
      }
      setGestureHud({ type: 'volume', value: Math.round(next * 100) });
    }
  };

  const handlePointerUp = () => {
    gestureStartRef.current = null;
    if (gestureHud) {
      window.setTimeout(() => setGestureHud(null), 700);
    }
  };

  const selectQualityLevel = (levelIndex: number) => {
    setSelectedHlsLevel(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
    setOpenMenu('none');
  };

  const selectAudioTrack = (trackIndex: number) => {
    setSelectedAudioTrack(trackIndex);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIndex;
    } else if (videoRef.current) {
      const nativeTracks = (
        videoRef.current as HTMLVideoElement & {
          audioTracks?: ArrayLike<{ enabled: boolean }>;
        }
      ).audioTracks;
      if (nativeTracks) {
        for (let i = 0; i < nativeTracks.length; i += 1) {
          nativeTracks[i].enabled = i === trackIndex;
        }
      }
    }
    setOpenMenu('none');
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setOpenMenu('none');
  };

  const displayTime = seekPreviewTime ?? currentTime;
  const progressPct = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  // Unified available audio languages (embedded HLS tracks, remux multi-audio tracks, and multi-language streams)
  const unifiedLanguageOptions = useMemo(() => {
    const list: {
      id: string;
      label: string;
      type: 'hls-track' | 'remux-lang' | 'source-lang';
      trackIndex?: number;
      targetLang?: string;
      isActive: boolean;
    }[] = [];

    const seenLabels = new Set<string>();

    // 1. Embedded HLS tracks on current stream (if multiple tracks exist)
    if (hlsAudioTracks.length > 1) {
      hlsAudioTracks.forEach((t) => {
        const cleanLabel = t.label.trim();
        seenLabels.add(cleanLabel.toLowerCase());
        list.push({
          id: `hls-${t.index}`,
          label: cleanLabel,
          type: 'hls-track',
          trackIndex: t.index,
          isActive: selectedAudioTrack === t.index,
        });
      });
    }

    // 2. Individual selectable tracks inside a remuxed multi-audio stream (e.g. 4KHDHub Hindi + Tamil + Telugu + English)
    const isRemuxStream = Boolean(
      activeSource?.url.includes('remux=1') &&
        (activeSource.url.includes('/api/stream-proxy') || activeSource.url.includes('/api/torrent/stream'))
    );
    if (isRemuxStream && hlsAudioTracks.length <= 1 && activeSource?.audioLanguage) {
      const remuxParts = activeSource.audioLanguage
        .split(/[+/|,]/)
        .map((p) => p.replace(/\(.*?\)/g, '').trim())
        .filter((p) => Boolean(p) && !/multi|dual|original|\d+\s*more/i.test(p));

      if (remuxParts.length > 1) {
        let currentRemuxLang = '';
        try {
          const parsedUrl = new URL(activeSource.url, window.location.origin);
          currentRemuxLang = (parsedUrl.searchParams.get('lang') || '').toLowerCase();
        } catch {}

        remuxParts.forEach((part, idx) => {
          const lower = part.toLowerCase();
          const isMatched =
            currentRemuxLang === lower ||
            (idx === 0 && (!currentRemuxLang || currentRemuxLang.includes('+') || currentRemuxLang.includes('multi')));
          seenLabels.add(lower);
          list.push({
            id: `remux-${lower}`,
            label: `${part} (Track)`,
            type: 'remux-lang',
            targetLang: part,
            isActive: isMatched,
          });
        });
      }
    }

    // 3. Multi-language stream variants across other available servers
    const availableLangs = Array.from(
      new Set(
        sources
          .map((s) => (s.audioLanguage || '').trim())
          .filter((l) => Boolean(l) && l.toLowerCase() !== 'original')
      )
    );

    availableLangs.forEach((lang) => {
      const lower = lang.toLowerCase();
      if (!seenLabels.has(lower)) {
        seenLabels.add(lower);
        const isCurrent =
          (activeSource?.audioLanguage || '').toLowerCase() === lower;
        list.push({
          id: `src-lang-${lower}`,
          label: lang,
          type: 'source-lang',
          targetLang: lang,
          isActive: isCurrent && hlsAudioTracks.length <= 1 && !list.some((item) => item.type === 'remux-lang' && item.isActive),
        });
      }
    });

    // 4. Fallback if no specific language tag was parsed
    if (list.length === 0) {
      const cur = activeSource?.audioLanguage || 'Original';
      list.push({
        id: 'cur-lang',
        label: cur,
        type: 'source-lang',
        targetLang: cur,
        isActive: true,
      });
    }

    return list;
  }, [hlsAudioTracks, sources, selectedAudioTrack, activeSource]);

  const currentLanguageDisplay = useMemo(() => {
    const active = unifiedLanguageOptions.find((opt) => opt.isActive);
    if (active) return active.label.replace(/\s*\(Track\)$/, '');
    if (hlsAudioTracks.length > 1 && hlsAudioTracks[selectedAudioTrack]) {
      return hlsAudioTracks[selectedAudioTrack].label;
    }
    return activeSource?.audioLanguage || 'Language';
  }, [unifiedLanguageOptions, hlsAudioTracks, selectedAudioTrack, activeSource]);

  const handleSelectLanguage = (opt: (typeof unifiedLanguageOptions)[number]) => {
    userLockedLanguageRef.current = true;
    if (opt.type === 'hls-track' && typeof opt.trackIndex === 'number') {
      selectAudioTrack(opt.trackIndex);
    } else if (opt.type === 'remux-lang' && opt.targetLang && activeSource) {
      let nextUrl = activeSource.url.includes('lang=')
        ? activeSource.url.replace(/([?&]lang=)[^&]*/i, `$1${encodeURIComponent(opt.targetLang)}`)
        : `${activeSource.url}&lang=${encodeURIComponent(opt.targetLang)}`;
      const curTime = videoRef.current?.currentTime || 0;
      if (nextUrl.includes('/api/stream-proxy') && curTime > 4) {
        nextUrl = nextUrl.includes('ss=')
          ? nextUrl.replace(/([?&]ss=)[^&]*/i, `$1${Math.floor(curTime)}`)
          : `${nextUrl}&ss=${Math.floor(curTime)}`;
      }
      const updatedSource: StreamSource = { ...activeSource, url: nextUrl };
      setSources((prev) => prev.map((s) => (s.id === activeSource.id ? updatedSource : s)));
      setActiveSource(updatedSource);
    } else if (opt.targetLang) {
      const best =
        selectMostCompatibleSource(sources, failedSourceIdsRef.current, opt.targetLang) ||
        sources.find(
          (s) => (s.audioLanguage || '').toLowerCase() === opt.targetLang?.toLowerCase()
        );
      if (best && best.id !== activeSource?.id) {
        setActiveSource(best);
      }
    }
    setOpenMenu('none');
  };

  // Filtered Sources Drawer datasets
  const nonTrailerSources = useMemo(
    () => sources.filter((s) => s.format !== 'youtube'),
    [sources]
  );
  const drawerProviders = useMemo(
    () => getAvailableProviders(nonTrailerSources),
    [nonTrailerSources]
  );
  const drawerLanguages = useMemo(
    () => getAvailableLanguages(nonTrailerSources),
    [nonTrailerSources]
  );
  const filteredDrawerSources = useMemo(() => {
    return sources.filter((s) => {
      if (!matchesSourceTypeFilter(s, drawerTypeFilter)) return false;
      if (drawerProviderFilter !== 'All' && getCanonicalProviderName(s) !== drawerProviderFilter) {
        return false;
      }
      if (drawerLanguageFilter !== 'All') {
        const tags = extractLanguageTags(s.audioLanguage);
        if (!tags.includes(drawerLanguageFilter)) return false;
      }
      if (!matchesQualityFilter(s, drawerQualityFilter)) return false;
      return true;
    });
  }, [sources, drawerTypeFilter, drawerProviderFilter, drawerLanguageFilter, drawerQualityFilter]);

  const hasDrawerFilter =
    drawerTypeFilter !== 'all' ||
    drawerProviderFilter !== 'All' ||
    drawerLanguageFilter !== 'All' ||
    drawerQualityFilter !== 'all';

  const resetDrawerFilters = () => {
    setDrawerTypeFilter('all');
    setDrawerProviderFilter('All');
    setDrawerLanguageFilter('All');
    setDrawerQualityFilter('all');
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={wakeControls}
      className="fixed inset-0 z-50 bg-black select-none flex items-center justify-center overflow-hidden"
    >
      {activeSource?.format === 'youtube' || activeSource?.format === 'embed' ? (
        <div className="relative h-full w-full flex flex-col bg-black">
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent px-4 sm:px-6 pt-4 pb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close player"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-xl hover:bg-white/20 border border-white/25 text-white transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-semibold text-white truncate">
                  {session.title}
                </h2>
                <p className="text-xs text-slate-300 truncate">
                  {activeSource.audioLanguage ? `Audio: ${activeSource.audioLanguage}` : (session.subtitle || 'HD Stream')}
                </p>
              </div>
            </div>

            {unifiedLanguageOptions.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'language' ? 'none' : 'language')}
                  className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-2"
                >
                  <Languages className="h-4 w-4" />
                  <span>{currentLanguageDisplay}</span>
                </button>

                {openMenu === 'language' && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl liquid-glass-strong p-2 space-y-1 shadow-2xl z-40 max-h-80 overflow-y-auto">
                    <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Audio Language
                    </p>
                    {unifiedLanguageOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectLanguage(opt)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                          opt.isActive
                            ? 'text-white font-semibold shadow-md'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                        style={opt.isActive ? { backgroundColor: accent.hex } : undefined}
                      >
                        <span>{opt.label}</span>
                        {opt.isActive && <Check className="h-4 w-4 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeSource.format === 'youtube' ? (
            <iframe
              src={activeSource.url}
              title={session.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              className="w-full h-full border-0 bg-black"
            />
          ) : (
            <div className="relative flex-1 flex items-center justify-center p-6 bg-zinc-950 overflow-hidden">
              {(session.backdropPath || session.fallbackBackdrop || session.posterPath || session.fallbackPoster) && (
                <img
                  src={
                    session.backdropPath
                      ? `https://image.tmdb.org/t/p/w1280${session.backdropPath}`
                      : session.fallbackBackdrop ||
                        (session.posterPath ? `https://image.tmdb.org/t/p/w780${session.posterPath}` : session.fallbackPoster)
                  }
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-25 blur-xl scale-105 pointer-events-none"
                />
              )}
              <div className="relative z-10 max-w-md w-full rounded-3xl liquid-glass-strong border border-white/15 p-6 text-center space-y-4 shadow-2xl">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    External Site Blocks In-App Frame
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <span className="font-medium text-white">{activeSource.providerName}</span> sets browser security headers (<code className="text-slate-200">X-Frame-Options</code>) that prevent playback inside an embedded frame. Open it directly in your browser or switch to a direct HLS/MP4 server.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <a
                    href={activeSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-xl inline-flex items-center gap-2 transition-transform active:scale-95"
                    style={{ backgroundColor: accent.hex }}
                  >
                    <span>Open on {activeSource.providerName}</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  {sources.some((s) => s.id !== activeSource.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextDirect =
                          sources.find((s) => s.id !== activeSource.id && (s.format === 'hls' || s.format === 'mp4')) ||
                          sources.find((s) => s.id !== activeSource.id);
                        if (nextDirect) setActiveSource(nextDirect);
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      <span>Continue</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Video Element with Brightness filter */}
          <video
            ref={videoRef}
            playsInline
            crossOrigin={
              !isLive &&
              subtitles.length > 0 &&
              Boolean(activeSource?.url.startsWith('/api/') || activeSource?.url.startsWith('blob:'))
                ? 'anonymous'
                : undefined
            }
            style={{ filter: `brightness(${brightness})` }}
            className={`h-full w-full touch-none ${videoFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isLocked) {
                wakeControls();
                return;
              }
              if (openMenu !== 'none') {
                setOpenMenu('none');
                return;
              }
              if (!showControls) {
                wakeControls();
              } else {
                togglePlayPause();
              }
            }}
            onLoadedData={() => setIsBuffering(false)}
            onCanPlay={() => setIsBuffering(false)}
            onCanPlayThrough={() => setIsBuffering(false)}
            onError={(e) => {
              if (hlsActiveRef.current) return;
              const video = e.currentTarget;
              if (!video.getAttribute('src')) return;
              handlePlaybackFailure(
                activeSource,
                isLive
                  ? 'Playback error loading this live stream. Click Continue to retry or switch channels.'
                  : 'Unable to play this stream directly in the browser.'
              );
            }}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => {
              setIsBuffering(false);
              setIsPlaying(true);
              if (isLive && session.liveChannel) {
                markChannelHealth(session.liveChannel.id, true);
              }
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              setIsBuffering(false);
              if (seekPreviewTime === null) {
                setCurrentTime(video.currentTime);
              }
              if (video.buffered.length > 0) {
                setBufferedEnd(video.buffered.end(video.buffered.length - 1));
              }
            }}
            onDurationChange={() => {
              const video = videoRef.current;
              if (video && Number.isFinite(video.duration)) {
                setDuration(video.duration);
              }
            }}
          >
        {subtitles.map((sub, idx) => {
          const srcUrl = resolvedSubUrls[sub.id];
          if (!srcUrl) return null;
          return (
            <track
              key={`${sub.id}-${idx}`}
              kind="subtitles"
              src={srcUrl}
              srcLang={sub.language}
              label={sub.label}
            />
          );
        })}
      </video>

      {/* Custom Crisp Cinema Subtitle Overlay */}
      {activeCueText && (
        <div className="pointer-events-none absolute bottom-24 sm:bottom-28 inset-x-4 flex justify-center z-20">
          <p className="px-4 py-1.5 rounded-lg bg-black/80 text-white text-sm sm:text-lg font-medium text-center max-w-2xl whitespace-pre-line shadow-lg">
            {activeCueText}
          </p>
        </div>
      )}

      {/* P2P Sequential Pre-Buffering HUD */}
      {isActiveP2PTorrent && p2pAttachUrl !== activeSource?.url && !streamError && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="player-interactive absolute inset-0 z-[25] flex items-center justify-center bg-black/80 backdrop-blur-md p-5"
        >
          <div className="max-w-md w-full rounded-2xl liquid-glass-strong border border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-300">
                  P2P Torrent Pre-Buffering
                </p>
                <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                  {activeSource?.providerName} · {activeSource?.quality}
                </h3>
                <p className="text-xs text-slate-300 truncate">
                  {p2pStatus?.fileName || activeSource?.label}
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin shrink-0 mt-1" style={{ color: accent.hex }} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-200">
                <span>
                  {!p2pStatus?.ready
                    ? 'Connecting to swarm & torrent metadata...'
                    : !p2pStatus.headReady || !p2pStatus.tailReady
                    ? 'Fetching header & tail metadata...'
                    : 'Sequential pre-buffering...'}
                </span>
                <span>{p2pStatus?.progressPct ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(4, p2pStatus?.progressPct ?? 0))}%`,
                    backgroundColor: accent.hex,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                <span>
                  {((p2pStatus?.prebufferedBytes || 0) / (1024 * 1024)).toFixed(1)} /{' '}
                  {((p2pStatus?.targetBytes || 10 * 1024 * 1024) / (1024 * 1024)).toFixed(0)} MB
                </span>
                <span>
                  {p2pStatus && p2pStatus.speedKbps >= 1024
                    ? `${(p2pStatus.speedKbps / 1024).toFixed(1)} MB/s`
                    : `${p2pStatus?.speedKbps || 0} KB/s`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded-lg bg-white/[0.06] border border-white/10 py-1.5 px-1">
                <div className="text-xs font-bold font-mono-tabular text-white">
                  {p2pStatus?.peers ?? 0}
                </div>
                <div className="text-[10px] text-slate-400">Peers</div>
              </div>
              <div className="rounded-lg bg-white/[0.06] border border-white/10 py-1.5 px-1">
                <div className="text-xs font-bold font-mono-tabular text-emerald-300">
                  {p2pStatus?.seeders ?? 0}
                </div>
                <div className="text-[10px] text-slate-400">Seeds</div>
              </div>
              <div className="rounded-lg bg-white/[0.06] border border-white/10 py-1.5 px-1">
                <div className={`text-xs font-bold ${p2pStatus?.headReady ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {p2pStatus?.headReady ? 'Ready' : 'Wait'}
                </div>
                <div className="text-[10px] text-slate-400">Header</div>
              </div>
              <div className="rounded-lg bg-white/[0.06] border border-white/10 py-1.5 px-1">
                <div className={`text-xs font-bold ${p2pStatus?.tailReady ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {p2pStatus?.tailReady ? 'Ready' : 'Wait'}
                </div>
                <div className="text-[10px] text-slate-400">End Meta</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors"
              >
                Cancel
              </button>
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOpenMenu('sources')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  <span>Switch Server</span>
                </button>
              )}
              {activeSource && (
                <button
                  type="button"
                  onClick={() => {
                    p2pBypassForSourceRef.current = activeSource.id;
                    setP2pBypassTick((t) => t + 1);
                  }}
                  className="min-h-[38px] px-4 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
                  style={{ backgroundColor: accent.hex }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Continue Anyway</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && !streamError && (!isActiveP2PTorrent || p2pAttachUrl === activeSource?.url) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
          <div className="h-14 w-14 rounded-full liquid-glass-strong flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: accent.hex }} />
          </div>
        </div>
      )}

      {/* Swipe Gesture HUD (Brightness / Volume) */}
      {gestureHud && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-5 py-3.5 rounded-2xl liquid-glass-strong flex items-center gap-3">
          {gestureHud.type === 'brightness' ? (
            <Sun className="h-5 w-5 text-amber-400" />
          ) : (
            <Volume2 className="h-5 w-5 text-[#3B82F6]" />
          )}
          <div className="w-28 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${gestureHud.value}%` }}
            />
          </div>
          <span className="text-xs font-mono-tabular text-white w-9 text-right">
            {gestureHud.value}%
          </span>
        </div>
      )}

      {/* Stream Error Overlay with recovery, Next Channel, Copy URL, and Exit */}
      {streamError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-xl p-6">
          <div className="max-w-md w-full rounded-2xl liquid-glass-strong p-6 text-center space-y-4">
            <p className="text-base font-semibold text-white">Stream Unavailable</p>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {streamError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  p2pBypassForSourceRef.current = null;
                  const wantedLang = activeSource?.audioLanguage;
                  const nextAlt =
                    (wantedLang ? selectMostCompatibleSource(sources, failedSourceIdsRef.current, wantedLang, true) : null) ||
                    (wantedLang ? sources.find((s) => s.id !== activeSource?.id && s.audioLanguage === wantedLang) : null) ||
                    selectMostCompatibleSource(sources, failedSourceIdsRef.current, undefined, true) ||
                    sources.find((s) => s.id !== activeSource?.id);
                  if (nextAlt) {
                    setStreamError(null);
                    setActiveSource(nextAlt);
                  } else {
                    setStreamError(null);
                    setReloadTick((t) => t + 1);
                  }
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
                style={{ backgroundColor: accent.hex }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Continue</span>
              </button>

              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setStreamError(null);
                    setOpenMenu('sources');
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  <span>Switch Server</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  p2pBypassForSourceRef.current = null;
                  setStreamError(null);
                  setReloadTick((t) => t + 1);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>

              {isLive && liveChannels.length > 1 && session.liveChannel && (
                <button
                  type="button"
                  onClick={() => switchLiveChannel(1)}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-lg"
                  style={{ backgroundColor: accent.hex }}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span>Next Channel</span>
                </button>
              )}

              {activeSource?.url && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(activeSource.url);
                      setCopiedUrl(true);
                      window.setTimeout(() => setCopiedUrl(false), 2000);
                    } catch {
                      // Clipboard blocked
                    }
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-100 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied URL</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Stream URL</span>
                    </>
                  )}
                </button>
              )}



              <button
                type="button"
                onClick={handleClose}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium"
              >
                Exit Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Player Controls Overlay */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Gradient & Title Bar */}
        <div className="bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 sm:px-6 pt-4 pb-10 flex items-center justify-between gap-4">
          {!isLocked ? (
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close player"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-xl hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] text-white transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-semibold text-white truncate">
                  {session.title}
                </h2>
                <p className="text-xs text-slate-300 truncate">
                  {activeSource
                    ? `Via ${activeSource.providerName} · ${activeSource.quality}${activeSource.seeders !== undefined ? ` · ${activeSource.seeders} seeders` : ''}`
                    : session.subtitle || ''}
                </p>
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 shrink-0">
            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => setVideoFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
                  aria-label="Toggle video fit"
                  className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{videoFit === 'cover' ? 'Fill' : 'Fit'}</span>
                </button>
                {sources.length > 0 && !isLive && (
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === 'sources' ? 'none' : 'sources')}
                    aria-label="Open stream sources"
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                      openMenu === 'sources'
                        ? 'text-white border-transparent shadow-md'
                        : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                    }`}
                    style={openMenu === 'sources' ? { backgroundColor: accent.hex } : undefined}
                  >
                    <Server className="h-4 w-4" />
                    <span className="hidden sm:inline">Sources ({sources.length})</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setIsLocked((prev) => !prev);
                setOpenMenu('none');
              }}
              aria-label={isLocked ? 'Unlock controls' : 'Lock controls'}
              className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                isLocked
                  ? 'text-white border-transparent shadow-lg'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
              style={isLocked ? { backgroundColor: accent.hex } : undefined}
            >
              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="hidden sm:inline">{isLocked ? 'Unlock' : 'Lock'}</span>
            </button>
          </div>
        </div>

        {/* Center Transport Controls */}
        {!isLocked && (
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {isLive ? (
              <button
                type="button"
                onClick={() => switchLiveChannel(-1)}
                aria-label="Previous live channel"
                className="min-h-[54px] min-w-[54px] flex flex-col items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] text-white transition-all active:scale-95"
              >
                <SkipBack className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">Prev</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => seekBy(-10)}
                aria-label="Rewind 10 seconds"
                className="min-h-[54px] min-w-[54px] flex flex-col items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] text-white transition-all active:scale-95"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">10s</span>
              </button>
            )}

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-full backdrop-blur-2xl border border-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform active:scale-95"
              style={{
                backgroundColor: accent.hex,
                boxShadow: `0 12px 36px rgba(${accent.glowRgb},0.45)`,
              }}
            >
              {isPlaying ? (
                <Pause className="h-7 w-7 sm:h-8 sm:w-8 fill-current" />
              ) : (
                <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-current ml-1" />
              )}
            </button>

            {isLive ? (
              <button
                type="button"
                onClick={() => switchLiveChannel(1)}
                aria-label="Next live channel"
                className="min-h-[54px] min-w-[54px] flex flex-col items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] text-white transition-all active:scale-95"
              >
                <SkipForward className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">Next</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="min-h-[54px] min-w-[54px] flex flex-col items-center justify-center rounded-full bg-white/10 backdrop-blur-2xl hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] text-white transition-all active:scale-95"
              >
                <RotateCw className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">10s</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom Scrubber & Action Bar */}
        {!isLocked ? (
          <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 sm:px-6 pt-10 pb-5 space-y-3">
            {/* Seek Bar */}
            {!isLive ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono-tabular text-slate-200 w-14 text-right">
                  {formatClock(displayTime)}
                </span>

                <div className="relative flex-1 flex items-center h-6">
                  <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-white/35"
                      style={{ width: `${Math.min(100, bufferedPct)}%` }}
                    />
                  </div>
                  <div
                    className="absolute left-0 h-1 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: accent.hex,
                      width: `${Math.min(100, progressPct)}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.5}
                    value={displayTime}
                    aria-label="Seek timeline"
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSeekPreviewTime(next);
                      setCurrentTime(next);
                    }}
                    onPointerUp={() => {
                      if (seekPreviewTime !== null && videoRef.current) {
                        videoRef.current.currentTime = seekPreviewTime;
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    onTouchEnd={() => {
                      if (seekPreviewTime !== null && videoRef.current) {
                        videoRef.current.currentTime = seekPreviewTime;
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    onKeyUp={() => {
                      if (seekPreviewTime !== null && videoRef.current) {
                        videoRef.current.currentTime = seekPreviewTime;
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    className="cinema-range relative z-10 w-full"
                  />
                </div>

                <span className="text-xs font-mono-tabular text-slate-400 w-14">
                  {formatClock(duration)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: accent.hex }}
                />
                <span>LIVE</span>
              </div>
            )}

            {/* Control Actions Row */}
            <div className="flex items-center justify-between gap-2 relative">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-200"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  aria-label="Volume"
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setVolume(val);
                    setIsMuted(val === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = val;
                      videoRef.current.muted = val === 0;
                    }
                  }}
                  className="hidden sm:block w-24 cursor-pointer"
                  style={{ accentColor: accent.hex }}
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                {!isLive && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'speed' ? 'none' : 'speed')
                    }
                    className="min-h-[40px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono-tabular text-white inline-flex items-center gap-1.5"
                  >
                    <Gauge className="h-4 w-4" />
                    <span>{playbackRate}x</span>
                  </button>
                )}

                {(!isLive || hlsAudioTracks.length > 1) && (sources.length > 1 || hlsAudioTracks.length > 1) && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'language' ? 'none' : 'language')
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                      openMenu === 'language'
                        ? 'text-white shadow-md'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                    style={openMenu === 'language' ? { backgroundColor: accent.hex } : undefined}
                  >
                    <Languages className="h-4 w-4" />
                    <span className="max-w-[90px] truncate">{currentLanguageDisplay}</span>
                  </button>
                )}

                {subtitles.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'subtitles' ? 'none' : 'subtitles')
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                      activeSubtitleId !== 'off'
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    <Captions className="h-4 w-4" />
                    <span className="hidden sm:inline">Subtitles</span>
                  </button>
                )}

                {sources.length > 0 && !isLive && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'sources' ? 'none' : 'sources')
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                      openMenu === 'sources'
                        ? 'text-white shadow-md'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                    style={openMenu === 'sources' ? { backgroundColor: accent.hex } : undefined}
                  >
                    <Server className="h-4 w-4" />
                    <span className="hidden sm:inline">Sources</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'quality' ? 'none' : 'quality')
                  }
                  className="min-h-[40px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white inline-flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>
                    {selectedHlsLevel === -1
                      ? activeSource?.quality || 'Auto'
                      : hlsLevels.find((l) => l.index === selectedHlsLevel)?.label ||
                        'Quality'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Popover Menus */}
              {openMenu === 'language' && (
                <div className="player-interactive absolute right-0 bottom-12 w-72 rounded-2xl liquid-glass-strong p-2 space-y-1 shadow-2xl z-40 max-h-80 overflow-y-auto touch-auto">
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Audio Language
                  </p>
                  {unifiedLanguageOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectLanguage(opt)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                        opt.isActive
                          ? 'text-white font-semibold shadow-md'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                      style={opt.isActive ? { backgroundColor: accent.hex } : undefined}
                    >
                      <span>{opt.label}</span>
                      {opt.isActive && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
              )}

              {openMenu === 'speed' && (
                <div className="player-interactive absolute right-0 bottom-12 w-40 rounded-2xl liquid-glass-strong p-1.5 touch-auto">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changeSpeed(rate)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono-tabular transition-colors ${
                        playbackRate === rate
                          ? 'text-white font-semibold shadow-md'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                      style={
                        playbackRate === rate
                          ? { backgroundColor: accent.hex }
                          : undefined
                      }
                    >
                      {rate}x {rate === 1 ? '(Normal)' : ''}
                    </button>
                  ))}
                </div>
              )}

              {openMenu === 'subtitles' && (
                <div className="player-interactive absolute right-0 bottom-12 w-56 rounded-2xl liquid-glass-strong p-1.5 max-h-72 overflow-y-auto touch-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubtitleId('off');
                      setOpenMenu('none');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeSubtitleId === 'off'
                        ? 'text-white font-semibold shadow-md'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                    style={
                      activeSubtitleId === 'off'
                        ? { backgroundColor: accent.hex }
                        : undefined
                    }
                  >
                    Off
                  </button>
                  {subtitles.map((sub, idx) => (
                    <button
                      key={`${sub.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setActiveSubtitleId(sub.id);
                        setOpenMenu('none');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        activeSubtitleId === sub.id
                          ? 'text-white font-semibold shadow-md'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                      style={
                        activeSubtitleId === sub.id
                          ? { backgroundColor: accent.hex }
                          : undefined
                      }
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              {openMenu === 'quality' && (
                <div className="player-interactive absolute right-0 bottom-12 w-72 rounded-2xl liquid-glass-strong p-2 space-y-2 max-h-72 overflow-y-auto touch-auto">
                  {hlsLevels.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                        Adaptive HLS Resolution
                      </p>
                      <button
                        type="button"
                        onClick={() => selectQualityLevel(-1)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          selectedHlsLevel === -1
                            ? 'text-white font-semibold shadow-md'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                        style={
                          selectedHlsLevel === -1
                            ? { backgroundColor: accent.hex }
                            : undefined
                        }
                      >
                        Auto (Adaptive)
                      </button>
                      {hlsLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          type="button"
                          onClick={() => selectQualityLevel(lvl.index)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono-tabular transition-colors ${
                            selectedHlsLevel === lvl.index
                              ? 'text-white font-semibold shadow-md'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                          style={
                            selectedHlsLevel === lvl.index
                              ? { backgroundColor: accent.hex }
                              : undefined
                          }
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {sources.length > 1 && (
                    <div className="space-y-1 pt-1 border-t border-white/10">
                      <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                        Stream Source Provider
                      </p>
                      {sources.map((src, idx) => (
                        <button
                          key={`${src.id}-${idx}`}
                          type="button"
                          onClick={() => {
                            setStreamError(null);
                            setActiveSource(src);
                            setOpenMenu('none');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                            activeSource?.id === src.id
                              ? 'text-white font-semibold shadow-md'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                          style={
                            activeSource?.id === src.id
                              ? { backgroundColor: accent.hex }
                              : undefined
                          }
                        >
                          <div className="truncate">{src.label}</div>
                          <div className="text-[11px] opacity-75">
                            {src.providerName} · {src.audioLanguage || 'Original'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pb-6 flex justify-center">
            <button
              type="button"
              onClick={() => setIsLocked(false)}
              className="min-h-[42px] px-5 rounded-full liquid-glass-strong border border-white/25 text-xs font-semibold text-white inline-flex items-center gap-2 shadow-xl"
            >
              <Unlock className="h-4 w-4" />
              <span>Screen Locked · Tap to Unlock</span>
            </button>
          </div>
        )}
      </div>

      {/* In-Player Slide-Over Sources Drawer */}
      {openMenu === 'sources' && !isLocked && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="player-interactive absolute inset-y-0 right-0 z-40 w-80 sm:w-96 max-w-[92vw] liquid-glass-strong border-l border-white/15 flex flex-col shadow-2xl"
        >
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Server className="h-5 w-5 text-white" />
              <div>
                <h3 className="font-display text-base font-bold text-white leading-tight">Sources</h3>
                <p className="text-[10px] font-mono-tabular text-slate-400">
                  {filteredDrawerSources.length} of {sources.length} servers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVideoFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
                aria-label="Toggle Fit/Fill"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLocked(true);
                  setOpenMenu('none');
                }}
                aria-label="Lock player"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <Lock className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpenMenu('none')}
                aria-label="Close sources"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Drawer Filters: Type, Provider, Language & Quality */}
          {sources.length > 1 && (
            <div className="px-3 py-2.5 border-b border-white/10 bg-black/30 space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <Filter className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                {(
                  [
                    { id: 'all', label: 'All', show: true },
                    { id: 'direct', label: 'Direct', show: sources.some((s) => getSourceFlags(s).isDirectInstant) },
                    { id: 'nuvio', label: 'Nuvio', show: sources.some((s) => getSourceFlags(s).isNuvio) },
                    { id: 'stremio', label: 'Stremio', show: sources.some((s) => getSourceFlags(s).isStremio) },
                    { id: 'cloudstream', label: 'CloudStream', show: sources.some((s) => getSourceFlags(s).isCS) },
                    { id: 'p2p', label: 'P2P', show: sources.some((s) => getSourceFlags(s).isP2P) },
                  ] as const
                )
                  .filter((t) => t.show)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDrawerTypeFilter(t.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                        drawerTypeFilter === t.id
                          ? 'bg-white text-slate-900 border-white'
                          : 'bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
              </div>

              {drawerProviders.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setDrawerProviderFilter('All')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                      drawerProviderFilter === 'All'
                        ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                        : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    All Providers
                  </button>
                  {drawerProviders.map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDrawerProviderFilter(name)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                        drawerProviderFilter === name
                          ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                          : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {drawerLanguages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrawerLanguageFilter('All')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                        drawerLanguageFilter === 'All'
                          ? 'text-white border-transparent'
                          : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                      style={drawerLanguageFilter === 'All' ? { backgroundColor: accent.hex } : undefined}
                    >
                      All Lang
                    </button>
                    {drawerLanguages.map(({ lang }) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setDrawerLanguageFilter(lang)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                          drawerLanguageFilter === lang
                            ? 'text-white border-transparent'
                            : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                        style={drawerLanguageFilter === lang ? { backgroundColor: accent.hex } : undefined}
                      >
                        {lang}
                      </button>
                    ))}
                    <span className="h-3.5 w-px bg-white/10 shrink-0" />
                  </>
                )}

                {(['all', '4k', '1080p', '720p', '480p'] as const).map((qOpt) => (
                  <button
                    key={qOpt}
                    type="button"
                    onClick={() => setDrawerQualityFilter(qOpt)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border transition-colors ${
                      drawerQualityFilter === qOpt
                        ? 'bg-sky-500/25 text-sky-200 border-sky-400/50'
                        : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-slate-200'
                    }`}
                  >
                    {qOpt === 'all' ? 'Any Qual' : qOpt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 touch-auto">
            {filteredDrawerSources.length === 0 ? (
              <div className="p-5 rounded-2xl bg-black/40 border border-white/10 text-center space-y-3">
                <p className="text-xs text-slate-300">No servers match the selected filters.</p>
                {hasDrawerFilter && (
                  <button
                    type="button"
                    onClick={resetDrawerFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            ) : (
              filteredDrawerSources.map((src, idx) => {
                const isActive = activeSource?.id === src.id;
                const { isP2P } = getSourceFlags(src);
                return (
                  <button
                    key={`${src.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      p2pBypassForSourceRef.current = null;
                      setStreamError(null);
                      setIsBuffering(true);
                      setActiveSource(src);
                      setOpenMenu('none');
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all space-y-2 ${
                      isActive
                        ? 'bg-white/[0.14] border-white/40 shadow-lg'
                        : 'bg-black/40 hover:bg-white/[0.08] border-white/10'
                    }`}
                  >
                    {idx === 0 && (
                      <span className="inline-block px-2 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] font-bold tracking-wider text-slate-200 uppercase">
                        Recommended
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {src.providerName} {src.seeders !== undefined ? `| ${src.seeders}` : ''} | {src.quality}
                      </p>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 truncate">{src.label}</p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-white">
                        {src.quality}
                      </span>
                      {src.audioLanguage && (
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-slate-200">
                          [{src.audioLanguage}]
                        </span>
                      )}
                      {src.sizeLabel && (
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono-tabular text-slate-200">
                          {src.sizeLabel}
                        </span>
                      )}
                      {src.seeders !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[10px] font-mono-tabular text-blue-300 inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{src.seeders}</span>
                        </span>
                      )}
                      {isP2P && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/25 border border-purple-500/35 text-[10px] font-semibold text-purple-200">
                          P2P Torrent
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};
