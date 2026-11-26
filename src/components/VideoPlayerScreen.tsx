import Hls from 'hls.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Captions,
  Check,
  Copy,
  Download,
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
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Unlock,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { bengaliSerialService } from '../services/bengaliSerialService';
import {
  resolveSubtitleTrackUrl,
  streamProviderService,
} from '../services/streamProviderService';
import { getTmdbImageUrl, tmdbService } from '../services/tmdbService';
import { storageService } from '../services/storageService';
import { nativeAndroidBridge } from '../services/nativeAndroidBridge';
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
  getSourceFlags,
  matchesQualityFilter,
  matchesSourceTypeFilter,
  QualityFilter,
  SourceTypeFilter,
} from '../utils/streamFilters';

export const QUALITY_PRESETS = [
  { id: 'auto', label: 'Auto (Original)', badge: 'Default' },
  { id: '1080p', label: '1080p', badge: 'FHD' },
  { id: '720p', label: '720p', badge: 'HD' },
  { id: '480p', label: '480p', badge: 'SD' },
  { id: '360p', label: '360p', badge: 'Data Saver' },
  { id: '240p', label: '240p', badge: 'Low' },
  { id: '144p', label: '144p', badge: 'Ultra Low' },
] as const;

function cleanStreamTitle(label: string): string {
  return label
    .replace(/\b(PlavioHD|Nuvio|Stremio|CloudStream|Torrentio|II Corsaro Viola|ThePirateBay|MediaFusion|SuperStream)\b/gi, '')
    .replace(/^[\s·|:-]+|[\s·|:-]+$/g, '')
    .trim() || 'High Quality Stream';
}

function isServerRemuxUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('remux=1')) return true;
  if (
    /[?&]quality=/.test(url) &&
    (url.includes('/api/stream-proxy') || url.includes('/api/torrent/stream'))
  ) {
    return true;
  }
  return false;
}

function stripSeekParam(url: string): string {
  return url
    .replace(/([?&])ss=\d+(?=&|$)/gi, '$1')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function buildUrlWithSeekParam(url: string, seekSec: number): string {
  const clean = stripSeekParam(url);
  if (seekSec <= 3) return clean;
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}ss=${Math.floor(seekSec)}`;
}

function getWatchProgressKeyForSession(session: PlayerSession): string {
  return session.mediaType === 'tv'
    ? `tv-${session.mediaId}-s${session.seasonNumber || 1}e${session.episodeNumber || 1}`
    : `movie-${session.mediaId}`;
}

function resolveSessionInitialResumeTime(session: PlayerSession): number {
  if (session.initialTime && session.initialTime > 3) {
    return session.initialTime;
  }
  if (session.mediaType === 'live' || !session.mediaId || session.mediaId <= 0) {
    return 0;
  }
  const key = getWatchProgressKeyForSession(session);
  const saved = storageService.getContinueWatching().find((item) => item.key === key);
  if (!saved || !Number.isFinite(saved.currentTime) || saved.currentTime <= 3) {
    return 0;
  }
  if (saved.duration >= 300 && saved.currentTime >= saved.duration - 15) {
    return 0;
  }
  return saved.currentTime;
}

interface P2PPrebufferStatus {
  ready: boolean;
  infoHash: string;
  fileIdx?: number;
  fileName?: string;
  fileLength?: number;
  fileSize?: number;
  peers: number;
  seeders: number;
  speedKbps: number;
  prebufferMb: number;
  prebufferedBytes: number;
  targetBytes: number;
  minReadyBytes?: number;
  headReady: boolean;
  tailReady: boolean;
  progressPct: number;
  launchProgressPct?: number;
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
    .replace(/[()]/g, ' ')
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
        t !== 'dub' &&
        t !== 'sub' &&
        t !== 'track' &&
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

    // 3. Direct HTTPS or same-origin proxy protocol (prefer instant CDN streams over slower P2P swarm startup, without excluding P2P fallbacks)
    if (url.includes('/api/torrent/stream')) {
      score -= 320;
    } else if (url.startsWith('/api/') || url.startsWith('https://')) {
      score += 180;
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

function selectBestPlayableSource(
  sourcesList: StreamSource[],
  failedSet?: Set<string>,
  preferredSourceId?: string,
  allowHeavyFallback = true
): StreamSource | null {
  if (!sourcesList || sourcesList.length === 0) return null;
  if (preferredSourceId) {
    const exact = sourcesList.find((s) => s.id === preferredSourceId && !failedSet?.has(s.id));
    if (exact) return exact;
  }
  const nonP2pPool = sourcesList.filter(
    (s) =>
      !failedSet?.has(s.id) &&
      !s.url.includes('/api/torrent/stream') &&
      s.format !== 'youtube' &&
      s.format !== 'embed'
  );
  if (nonP2pPool.length > 0) {
    return (
      selectMostCompatibleSource(nonP2pPool, failedSet, 'Hindi', true) ||
      selectMostCompatibleSource(nonP2pPool, failedSet, 'Hindi', false) ||
      selectMostCompatibleSource(nonP2pPool, failedSet, undefined, true) ||
      selectMostCompatibleSource(nonP2pPool, failedSet, undefined, false) ||
      nonP2pPool[0]
    );
  }
  if (!allowHeavyFallback) {
    return null;
  }
  return (
    selectMostCompatibleSource(sourcesList, failedSet, 'Hindi', true) ||
    selectMostCompatibleSource(sourcesList, failedSet, 'Hindi', false) ||
    selectMostCompatibleSource(sourcesList, failedSet, undefined, true) ||
    selectMostCompatibleSource(sourcesList, failedSet, undefined, false) ||
    sourcesList.find((s) => !failedSet?.has(s.id)) ||
    sourcesList[0] ||
    null
  );
}

const CinemaPrebufferHUD: React.FC<{
  mode: 'resolving' | 'p2p' | 'direct';
  session: PlayerSession;
  status: P2PPrebufferStatus | null;
  activeSource: StreamSource | null;
  accentHex: string;
  onCancel: () => void;
  onSwitchServer?: () => void;
  onContinueAnyway?: () => void;
  hasAlternativeSources: boolean;
}> = ({
  mode,
  session,
  status,
  activeSource,
  accentHex,
  onCancel,
  onSwitchServer,
  onContinueAnyway,
  hasAlternativeSources,
}) => {
  const [displayPct, setDisplayPct] = useState(0);
  const rawLaunchPct =
    mode === 'p2p'
      ? status?.launchProgressPct ??
        (status?.minReadyBytes && status.minReadyBytes > 0
          ? Math.min(100, Math.round(((status.prebufferedBytes || 0) / status.minReadyBytes) * 100))
          : status?.progressPct ?? 0)
      : 0;
  const currentPctRef = useRef(0);

  useEffect(() => {
    if (mode !== 'p2p') {
      currentPctRef.current = 0;
      setDisplayPct(0);
      return;
    }
    let animId: number;
    const update = () => {
      const diff = rawLaunchPct - currentPctRef.current;
      if (Math.abs(diff) > 0.15) {
        currentPctRef.current += diff * 0.24;
        const rounded = Math.round(Math.min(100, Math.max(0, currentPctRef.current)));
        setDisplayPct((prev) => (prev !== rounded ? rounded : prev));
        animId = requestAnimationFrame(update);
      } else {
        currentPctRef.current = rawLaunchPct;
        const rounded = Math.round(rawLaunchPct);
        setDisplayPct((prev) => (prev !== rounded ? rounded : prev));
      }
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [rawLaunchPct, mode]);

  const backdropSrc =
    getTmdbImageUrl(session.backdropPath, 'w1280') ||
    session.fallbackBackdrop ||
    getTmdbImageUrl(session.posterPath, 'w780') ||
    session.fallbackPoster ||
    null;

  const launchTargetBytes = status?.minReadyBytes || 512 * 1024;
  const prebufferedBytes = status?.prebufferedBytes || 0;
  const remainingBytes = Math.max(0, launchTargetBytes - prebufferedBytes);
  const bytesPerSec = Math.max(1, (status?.speedKbps || 0) * 1024);
  const etaSec =
    status?.speedKbps && status.speedKbps > 15 ? Math.ceil(remainingBytes / bytesPerSec) : null;

  const mbPre = (prebufferedBytes / (1024 * 1024)).toFixed(1);
  const mbLaunch = (launchTargetBytes / (1024 * 1024)).toFixed(1);
  const speedStr =
    status && status.speedKbps >= 1024
      ? `${(status.speedKbps / 1024).toFixed(1)} MB/s`
      : `${Math.round(status?.speedKbps || 0)} KB/s`;

  const clampedPct = Math.min(100, Math.max(0, displayPct));
  const ringCircumference = 201.06; // 2 * pi * 32
  const strokeDashoffset = ringCircumference * (1 - clampedPct / 100);

  const audioTag = activeSource?.audioLanguage
    ? extractLanguageTags(activeSource.audioLanguage)[0]
    : undefined;
  const episodeContext =
    session.mediaType === 'tv' && session.seasonNumber && session.episodeNumber
      ? `S${session.seasonNumber} · E${session.episodeNumber}${session.episodeTitle ? ` · ${session.episodeTitle}` : ''}`
      : session.subtitle || '';

  const metadataParts = [
    audioTag ? `${audioTag} Audio` : activeSource ? 'Original Audio' : null,
    activeSource?.quality || null,
    activeSource?.format ? activeSource.format.toUpperCase() : null,
  ].filter(Boolean) as string[];

  const stageLabel =
    mode === 'resolving'
      ? 'Matching fastest audio & video server'
      : mode === 'direct'
      ? 'Buffering initial cinema frames'
      : !status?.ready
      ? 'Connecting to peer swarm'
      : !status.headReady
      ? 'Reading media header'
      : 'Fast-buffering playback start';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="player-interactive absolute inset-0 z-[25] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    >
      {/* Full-bleed Cinema Backdrop Scrim */}
      <div className="pointer-events-none absolute inset-0 bg-[#05070C]">
        {backdropSrc && (
          <img
            src={backdropSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover opacity-30 scale-105 blur-xl"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(8, 11, 18, 0.55) 0%, rgba(5, 7, 12, 0.92) 78%)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: accentHex }}
        />
      </div>

      {/* Compact Landscape-Safe Cinema Prebuffer Surface */}
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-white/15 backdrop-blur-2xl p-4 sm:p-6 space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
        style={{
          background:
            'linear-gradient(180deg, rgba(20, 25, 38, 0.84) 0%, rgba(10, 13, 22, 0.92) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 24px 80px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Top Focal Row: Progress Dial + Title & Audio Metadata */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 flex items-center justify-center">
            {mode === 'p2p' ? (
              <>
                <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76" aria-hidden="true">
                  <defs>
                    <linearGradient id="cinemaPrebufferGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={accentHex} />
                      <stop offset="100%" stopColor="#38BDF8" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="38"
                    cy="38"
                    r="32"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="38"
                    cy="38"
                    r="32"
                    fill="none"
                    stroke="url(#cinemaPrebufferGrad)"
                    strokeWidth="5"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm sm:text-base font-bold font-mono-tabular text-white leading-none">
                    {clampedPct}%
                  </span>
                </div>
              </>
            ) : (
              <>
                <svg className="h-full w-full" viewBox="0 0 76 76" aria-hidden="true">
                  <circle
                    cx="38"
                    cy="38"
                    r="32"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="4.5"
                  />
                </svg>
                <svg
                  className="ks-spin-arc absolute inset-0 h-full w-full"
                  viewBox="0 0 76 76"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="cinemaSpinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={accentHex} />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="38"
                    cy="38"
                    r="32"
                    fill="none"
                    stroke="url(#cinemaSpinGrad)"
                    strokeWidth="4.5"
                    strokeDasharray="68 140"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white/90" />
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-medium tracking-wide text-slate-300 truncate">
              {stageLabel}
            </p>
            <h3 className="font-display text-base sm:text-xl font-bold text-white truncate leading-tight">
              {session.title}
            </h3>
            {episodeContext && (
              <p className="text-xs text-slate-300 truncate">{episodeContext}</p>
            )}
            <p className="text-xs text-slate-300 font-mono-tabular truncate">
              {metadataParts.length > 0
                ? metadataParts.join(' · ')
                : 'Selecting Hindi & English audio'}
            </p>
          </div>
        </div>

        {/* Sleek Cinema Progress Track + Clean Unboxed Telemetry */}
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden relative">
            {mode === 'p2p' ? (
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-200 ease-out"
                style={{
                  transform: `scaleX(${Math.max(0.04, clampedPct / 100)})`,
                  background: `linear-gradient(90deg, ${accentHex}, #38BDF8)`,
                }}
              />
            ) : (
              <div
                className="ks-buffer-sweep h-full w-2/5 rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentHex}, #38BDF8, transparent)`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs font-mono-tabular text-slate-300">
            {mode === 'p2p' ? (
              <>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-white font-semibold">{speedStr}</span>
                  <span className="text-white/25">·</span>
                  <span>
                    {mbPre} / {mbLaunch} MB
                  </span>
                  <span className="text-white/25">·</span>
                  <span>{status?.peers ?? 0} peers</span>
                  <span className="text-white/25 hidden sm:inline">·</span>
                  <span className="hidden sm:inline text-emerald-300">
                    {status?.seeders ?? 0} seeds
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-emerald-300">
                  {etaSec !== null
                    ? `~${etaSec}s`
                    : status?.headReady
                    ? 'Launching'
                    : 'Syncing'}
                </span>
              </>
            ) : (
              <>
                <span className="truncate text-slate-300">
                  {activeSource
                    ? 'Preparing instant stream startup'
                    : 'Checking verified fast streams'}
                </span>
                <span className="shrink-0 text-white font-semibold">
                  {activeSource?.quality || 'HD'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Row (44px+ Touch Targets) */}
        <div className="flex items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-slate-200 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 justify-end">
            {hasAlternativeSources && onSwitchServer && (
              <button
                type="button"
                onClick={onSwitchServer}
                className="min-h-[44px] px-4 rounded-xl bg-white/12 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Server className="h-4 w-4" />
                <span>Switch Server</span>
              </button>
            )}
            {mode === 'p2p' && onContinueAnyway && (
              <button
                type="button"
                onClick={onContinueAnyway}
                className="min-h-[44px] px-5 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform"
                style={{ backgroundColor: accentHex }}
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Play Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const autoRemuxAttemptedIdsRef = useRef<Set<string>>(new Set());
  const userLockedLanguageRef = useRef<boolean>(false);
  const userSelectedSourceRef = useRef<boolean>(false);
  const hasPlayedFramesRef = useRef<boolean>(false);
  const p2pBypassForSourceRef = useRef<string | null>(null);
  const readyTorrentHashesRef = useRef<Set<string>>(new Set());
  const qualityBaseSourceRef = useRef<{
    id: string;
    url: string;
    format: StreamSource['format'];
    quality: string;
  } | null>(null);
  const pendingQualityFallbackRef = useRef<{
    sourceId: string;
    qualId: string;
  } | null>(null);
  const playerToastTimerRef = useRef<number | null>(null);
  const mountGenRef = useRef<number>(0);
  const initialResolvedResume = resolveSessionInitialResumeTime(session);
  const resumePositionRef = useRef<number>(initialResolvedResume);
  const pendingResumeTargetRef = useRef<number>(initialResolvedResume);
  const initialResumeToastTargetRef = useRef<number>(initialResolvedResume);
  const resumedToastShownRef = useRef<boolean>(false);
  const lastResumeAttemptAtRef = useRef<number>(0);
  const resumeSeekAttemptsRef = useRef<number>(0);
  const prematureReconnectCountRef = useRef<number>(0);
  const seekFeedbackTimerRef = useRef<number | null>(null);
  const lastUiTimeUpdateRef = useRef<number>(0);

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeSource, setActiveSource] = useState<StreamSource | null>(null);
  const activeSourceRef = useRef<StreamSource | null>(null);
  useEffect(() => {
    activeSourceRef.current = activeSource;
  }, [activeSource]);

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
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [isResolvingStreams, setIsResolvingStreams] = useState(session.mediaType !== 'live');
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveSwitchToast, setLiveSwitchToast] = useState<string | null>(null);
  const [resumedNoticeTime, setResumedNoticeTime] = useState<number | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<{
    dir: 'back' | 'forward';
    amount: number;
    key: number;
  } | null>(null);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [activeLiveFeedIdx, setActiveLiveFeedIdx] = useState(0);
  const failedLiveUrlsRef = useRef<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(initialResolvedResume);
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
  const [drawerLanguageFilter, setDrawerLanguageFilter] = useState<string>('All');
  const [drawerQualityFilter, setDrawerQualityFilter] = useState<QualityFilter>('all');
  const [selectedQualityOption, setSelectedQualityOption] = useState<string>('auto');

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

  const liveFeedsList = useMemo(() => {
    if (!isLive || !session.liveChannel) return [];
    const seen = new Set<string>();
    const list = [session.liveChannel, ...(session.fallbackFeeds || [])].filter((ch) => {
      if (!ch?.streamUrl) return false;
      const key = ch.streamUrl.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return list;
  }, [isLive, session.liveChannel, session.fallbackFeeds]);

  const playbackRateRef = useRef(playbackRate);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const seekOffsetSecondsRef = useRef<number>(0);
  const [probedDurationSeconds, setProbedDurationSeconds] = useState<number>(0);
  const [tmdbRuntimeSeconds, setTmdbRuntimeSeconds] = useState<number>(
    session.runtimeMinutes && session.runtimeMinutes > 0 ? session.runtimeMinutes * 60 : 0
  );

  const durationRef = useRef(duration);
  const knownRuntimeRef = useRef(0);
  const activeSourceUrlRef = useRef(activeSource?.url || '');

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
  }, [playbackRate, isMuted, volume]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    activeSourceUrlRef.current = activeSource?.url || '';
  }, [activeSource?.url]);

  const initialRuntimeSeconds =
    session.runtimeMinutes && session.runtimeMinutes > 0 ? session.runtimeMinutes * 60 : 0;
  const knownRuntimeSeconds = Math.max(
    initialRuntimeSeconds,
    probedDurationSeconds,
    tmdbRuntimeSeconds
  );

  useEffect(() => {
    knownRuntimeRef.current = knownRuntimeSeconds;
  }, [knownRuntimeSeconds]);

  // Ensure TMDB runtime is resolved even when launched from Home / Continue Watching / Catalog without runtimeMinutes
  useEffect(() => {
    if (initialRuntimeSeconds > 0) {
      setTmdbRuntimeSeconds(initialRuntimeSeconds);
      return;
    }
    const isSyntheticLive = session.mediaId >= 880001 && session.mediaId <= 899999;
    if (isLive || isSyntheticLive || !session.mediaId || session.mediaId <= 0) {
      setTmdbRuntimeSeconds(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let runtimeMin = 0;
        if (session.mediaType === 'tv') {
          if (session.seasonNumber && session.episodeNumber) {
            const season = await tmdbService.getSeasonDetails(
              session.mediaId,
              session.seasonNumber
            );
            const ep = season.episodes?.find(
              (item) => item.episodeNumber === session.episodeNumber
            );
            if (ep?.runtime && ep.runtime > 0) {
              runtimeMin = ep.runtime;
            }
          }
          if (!runtimeMin) {
            const details = await tmdbService.getMediaDetails(session.mediaId, 'tv');
            if (details?.runtime && details.runtime > 0) {
              runtimeMin = details.runtime;
            }
          }
        } else {
          const details = await tmdbService.getMediaDetails(session.mediaId, 'movie');
          if (details?.runtime && details.runtime > 0) {
            runtimeMin = details.runtime;
          }
        }
        if (!cancelled && runtimeMin > 0) {
          setTmdbRuntimeSeconds(runtimeMin * 60);
        }
      } catch {
        // Ignore non-fatal runtime metadata lookup failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLive,
    initialRuntimeSeconds,
    session.mediaId,
    session.mediaType,
    session.seasonNumber,
    session.episodeNumber,
  ]);

  const applyReportedDuration = useCallback((rawDur: number) => {
    if (!Number.isFinite(rawDur) || rawDur <= 0) return;
    const totalCandidate = seekOffsetSecondsRef.current + rawDur;
    const curPos =
      seekOffsetSecondsRef.current + (videoRef.current?.currentTime || 0);
    const knownRuntime = knownRuntimeRef.current;
    const currentDur = durationRef.current;
    const isRemux = isServerRemuxUrl(activeSourceUrlRef.current);

    // Never accept a partial duration shorter than what has already played
    if (totalCandidate + 0.5 < curPos) return;

    // Ignore tiny chunk/init-fragment durations (e.g. 9s) when full runtime metadata is known
    if (knownRuntime >= 300 && totalCandidate < Math.min(180, knownRuntime * 0.25)) {
      return;
    }

    // Never shrink a valid existing duration down to a short progressive window
    if (currentDur >= 180 && totalCandidate < Math.min(120, currentDur * 0.25)) {
      return;
    }

    if (isRemux) {
      if (currentDur === 0 || (totalCandidate > currentDur && totalCandidate >= 60)) {
        durationRef.current = totalCandidate;
        setDuration(totalCandidate);
      }
      return;
    }

    if (
      currentDur === 0 ||
      totalCandidate > currentDur ||
      Math.abs(totalCandidate - currentDur) >= 1
    ) {
      durationRef.current = totalCandidate;
      setDuration(totalCandidate);
    }
  }, []);

  useEffect(() => {
    let parsedSs = 0;
    if (activeSource?.url) {
      try {
        const u = new URL(activeSource.url, window.location.origin);
        const ssVal = Number(u.searchParams.get('ss') || '0');
        if (Number.isFinite(ssVal) && ssVal > 0) {
          parsedSs = Math.floor(ssVal);
        }
      } catch {
        // Ignore relative/malformed URL parsing
      }
    }
    seekOffsetSecondsRef.current = parsedSs;

    const initialDur =
      session.runtimeMinutes && session.runtimeMinutes > 0 ? session.runtimeMinutes * 60 : 0;
    const preservedDur =
      parsedSs > 0
        ? Math.max(initialDur, knownRuntimeRef.current, durationRef.current)
        : Math.max(initialDur, knownRuntimeRef.current);
    setProbedDurationSeconds(initialDur);
    durationRef.current = preservedDur;
    setDuration(preservedDur);

    if (activeSource?.url && !isLive && activeSource.format !== 'hls' && !isServerRemuxUrl(activeSource.url)) {
      let probeActive = true;
      fetch(activeSource.url, { method: 'HEAD' })
        .then((res) => {
          if (!probeActive) return;
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('mpegurl') || ct.includes('m3u8')) {
            setActiveSource((prev) =>
              prev && prev.id === activeSource.id && prev.format !== 'hls'
                ? { ...prev, format: 'hls' }
                : prev
            );
            return;
          }
          const hdr = res.headers.get('x-content-duration');
          if (hdr) {
            const parsed = parseFloat(hdr);
            if (Number.isFinite(parsed) && parsed > 0) {
              setProbedDurationSeconds(parsed);
              applyReportedDuration(parsed);
            }
          }
        })
        .catch(() => {});
      return () => {
        probeActive = false;
      };
    }
  }, [
    activeSource?.id,
    activeSource?.url,
    activeSource?.format,
    isLive,
    session.runtimeMinutes,
    applyReportedDuration,
  ]);

  const rawReportedDuration =
    Number.isFinite(duration) && duration > 0 ? duration : knownRuntimeSeconds;
  const effectiveDuration =
    rawReportedDuration > 0 && rawReportedDuration + 0.5 >= currentTime
      ? rawReportedDuration
      : knownRuntimeSeconds > 0 && knownRuntimeSeconds + 0.5 >= currentTime
      ? knownRuntimeSeconds
      : 0;

  const switchLiveChannel = useCallback(
    (direction: 1 | -1) => {
      if (!isLive || liveChannels.length <= 1 || !session.liveChannel) return;
      const validPool = liveChannels.filter(
        (c) => c.streamUrl.startsWith('https://') || c.streamUrl.startsWith('/api/')
      );
      const pool = validPool.length > 0 ? validPool : liveChannels;
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

  // Reset live backup tracking & resume position only when session identity changes
  const sessionKey = `${session.mediaType}-${session.mediaId}-${session.seasonNumber || 0}-${session.episodeNumber || 0}-${session.liveChannel?.id || ''}`;
  useEffect(() => {
    const initialResume = resolveSessionInitialResumeTime(session);
    resumePositionRef.current = initialResume;
    pendingResumeTargetRef.current = initialResume;
    initialResumeToastTargetRef.current = initialResume;
    resumedToastShownRef.current = false;
    prematureReconnectCountRef.current = 0;
    resumeSeekAttemptsRef.current = 0;
    setResumedNoticeTime(null);
    setCurrentTime(initialResume);
    setActiveLiveFeedIdx(0);
    failedLiveUrlsRef.current.clear();
    setLiveSwitchToast(null);
    qualityBaseSourceRef.current = null;
    pendingQualityFallbackRef.current = null;
    setSelectedQualityOption('auto');
  }, [sessionKey, session.initialTime]);

  useEffect(() => {
    setHasFirstFrame(false);
  }, [activeSource?.id, reloadTick, sessionKey]);

  // Activate selected Live TV channel or backup feed cleanly
  useEffect(() => {
    if (!isLive || !session.liveChannel) return;
    const ch = liveFeedsList[activeLiveFeedIdx] || session.liveChannel;
    let playUrl = ch.streamUrl;
    if (
      (playUrl.startsWith('http://') || playUrl.startsWith('https://')) &&
      !playUrl.startsWith('/api/')
    ) {
      playUrl = `/api/stream-proxy?url=${encodeURIComponent(playUrl)}`;
    }
    const liveSrc: StreamSource = {
      id: `${ch.id}-feed-${activeLiveFeedIdx}`,
      providerName: ch.playlistName,
      label: `${ch.name} · Live HLS${liveFeedsList.length > 1 ? ` (Feed ${activeLiveFeedIdx + 1}/${liveFeedsList.length})` : ''}`,
      quality: 'Auto (Live)',
      url: playUrl,
      format: playUrl.includes('.mp4') ? 'mp4' : 'hls',
      isVerified: true,
    };
    setSources([liveSrc]);
    setActiveSource(liveSrc);
    setSubtitles([]);
  }, [isLive, session.liveChannel, liveFeedsList, activeLiveFeedIdx]);

  const isBengaliSession = useMemo(
    () =>
      bengaliSerialService.isBengaliSerialOrCartoon({
        title: session.title,
        originalLanguage: session.originalLanguage,
        bengaliSerialSlug: session.bengaliSerialSlug,
      }) || (session.mediaId >= 895000 && session.mediaId <= 899999),
    [session.title, session.originalLanguage, session.bengaliSerialSlug, session.mediaId]
  );

  // Resolve stream sources & subtitles progressively via shared subscription
  useEffect(() => {
    failedSourceIdsRef.current.clear();
    autoRemuxAttemptedIdsRef.current.clear();
    userLockedLanguageRef.current = false;
    userSelectedSourceRef.current = Boolean(session.preferredSourceId);
    hasPlayedFramesRef.current = false;
    p2pBypassForSourceRef.current = null;
    setIsResolvingStreams(!isLive);
    setShowUnmutePrompt(false);
    setStreamError(null);
    setIsBuffering(true);
    setDrawerTypeFilter('all');
    setSelectedQualityOption('auto');
    setDrawerLanguageFilter('All');
    setDrawerQualityFilter('all');

    let active = true;
    const resolvedSubIdsSeen = new Set<string>();

    const syncSubtitles = async (subs: SubtitleTrack[]) => {
      setSubtitles(subs);
      const missing = subs.filter((s) => !resolvedSubIdsSeen.has(s.id));
      if (missing.length === 0) return;
      missing.forEach((s) => resolvedSubIdsSeen.add(s.id));
      const urlMap: Record<string, string> = {};
      await Promise.allSettled(
        missing.map(async (sub) => {
          urlMap[sub.id] = await resolveSubtitleTrackUrl(sub);
        })
      );
      if (active && Object.keys(urlMap).length > 0) {
        setResolvedSubUrls((prev) => ({ ...prev, ...urlMap }));
      }
    };

    if (isLive && session.liveChannel) {
      return () => {
        active = false;
      };
    }

    const applySnapshot = (
      nextSources: StreamSource[],
      nextSubs: SubtitleTrack[],
      isDone: boolean
    ) => {
      if (!active) return;
      if (isDone) {
        setIsResolvingStreams(false);
      }
      const preferredOverride = session.preferredSourceId
        ? session.initialSources?.find((s) => s.id === session.preferredSourceId)
        : undefined;
      const mergedIncoming = preferredOverride
        ? nextSources.map((s) => (s.id === preferredOverride.id ? preferredOverride : s))
        : nextSources;

      const allowedSources = isBengaliSession
        ? mergedIncoming.filter((s) => s.format !== 'youtube')
        : mergedIncoming;

      if (allowedSources.length > 0) {
        setSources(allowedSources);
      } else if (isDone && isBengaliSession) {
        setSources([]);
      }
      if (nextSubs.length > 0) {
        void syncSubtitles(nextSubs);
      }

      const getActiveResumeSeconds = () => {
        const videoCur = videoRef.current?.currentTime || 0;
        const absCur = seekOffsetSecondsRef.current + videoCur;
        if (pendingResumeTargetRef.current > 3 && seekOffsetSecondsRef.current === 0 && videoCur < 3) {
          return Math.max(resumePositionRef.current, pendingResumeTargetRef.current);
        }
        return Math.max(absCur, resumePositionRef.current, pendingResumeTargetRef.current);
      };

      const prepareWithResume = (src: StreamSource): StreamSource => {
        if (isLive) return src;
        const target = Math.floor(getActiveResumeSeconds());
        if (target <= 3) {
          seekOffsetSecondsRef.current = 0;
          pendingResumeTargetRef.current = 0;
          return src;
        }
        resumePositionRef.current = target;
        if (isServerRemuxUrl(src.url)) {
          seekOffsetSecondsRef.current = target;
          pendingResumeTargetRef.current = 0;
          return { ...src, url: buildUrlWithSeekParam(src.url, target) };
        }
        seekOffsetSecondsRef.current = 0;
        pendingResumeTargetRef.current = target;
        return src;
      };

      const currentActive = activeSourceRef.current;
      const bestNow = selectBestPlayableSource(
        allowedSources,
        failedSourceIdsRef.current,
        session.preferredSourceId,
        isDone
      );

      if (!currentActive || (isBengaliSession && currentActive.format === 'youtube')) {
        if (bestNow) {
          setActiveSource(prepareWithResume(bestNow));
        } else if (isDone) {
          if (isBengaliSession) {
            setActiveSource(null);
          }
          setIsBuffering(false);
          setStreamError(
            isBengaliSession
              ? 'No Bengali serial stream provider is available (YouTube playback disabled).'
              : 'No playable stream servers were found for this title.'
          );
        }
      } else if (
        !userSelectedSourceRef.current &&
        !hasPlayedFramesRef.current &&
        !qualityBaseSourceRef.current &&
        !pendingQualityFallbackRef.current &&
        bestNow
      ) {
        const curIsP2POrEmbed =
          currentActive.url.includes('/api/torrent/stream') ||
          currentActive.format === 'embed' ||
          currentActive.format === 'youtube';
        const bestIsDirect =
          !bestNow.url.includes('/api/torrent/stream') &&
          bestNow.format !== 'embed' &&
          bestNow.format !== 'youtube';
        const curIsHindi = /\b(hindi|hin)\b|🇮🇳/i.test(currentActive.audioLanguage || '');
        const bestIsHindi = /\b(hindi|hin)\b|🇮🇳/i.test(bestNow.audioLanguage || '');

        if ((curIsP2POrEmbed && bestIsDirect) || (!curIsHindi && bestIsHindi && bestIsDirect)) {
          setActiveSource(prepareWithResume(bestNow));
        }
      }
    };

    if (session.initialSources && session.initialSources.length > 0) {
      applySnapshot(session.initialSources, session.initialSubtitles || [], false);
    }

    const unsubscribe = streamProviderService.subscribeAndResolveStreams(
      {
        tmdbId: session.mediaId,
        imdbId: session.imdbId,
        dejavuId: session.dejavuId,
        archiveIdentifier: session.archiveIdentifier,
        mediaType: session.mediaType === 'tv' ? 'tv' : 'movie',
        title: session.title,
        genreIds: session.genreIds,
        originalLanguage: session.originalLanguage,
        releaseYear: session.releaseYear,
        seasonNumber: session.seasonNumber,
        episodeNumber: session.episodeNumber,
        bengaliSerialSlug: session.bengaliSerialSlug,
        preferredVideoId: session.preferredVideoId,
      },
      (result, isDone) => {
        applySnapshot(result.sources, result.subtitles, isDone);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [session, isLive, isBengaliSession]);

  const getAbsolutePlaybackPosition = useCallback((): number => {
    const rawTime = videoRef.current?.currentTime || 0;
    const absCur = seekOffsetSecondsRef.current + rawTime;
    if (
      pendingResumeTargetRef.current > 3 &&
      seekOffsetSecondsRef.current === 0 &&
      rawTime < 3
    ) {
      return Math.max(resumePositionRef.current, pendingResumeTargetRef.current);
    }
    return Math.max(absCur, resumePositionRef.current);
  }, []);

  const prepareSourceWithResume = useCallback(
    (src: StreamSource, explicitSeconds?: number): StreamSource => {
      if (isLive || src.format === 'youtube' || src.format === 'embed') {
        seekOffsetSecondsRef.current = 0;
        pendingResumeTargetRef.current = 0;
        return src;
      }
      const target = Math.floor(
        explicitSeconds !== undefined ? explicitSeconds : getAbsolutePlaybackPosition()
      );
      if (target <= 3) {
        seekOffsetSecondsRef.current = 0;
        pendingResumeTargetRef.current = 0;
        return isServerRemuxUrl(src.url)
          ? { ...src, url: stripSeekParam(src.url) }
          : src;
      }
      resumePositionRef.current = target;
      if (isServerRemuxUrl(src.url)) {
        seekOffsetSecondsRef.current = target;
        pendingResumeTargetRef.current = 0;
        resumeSeekAttemptsRef.current = 0;
        return {
          ...src,
          url: buildUrlWithSeekParam(src.url, target),
        };
      }
      seekOffsetSecondsRef.current = 0;
      pendingResumeTargetRef.current = target;
      resumeSeekAttemptsRef.current = 0;
      return src;
    },
    [isLive, getAbsolutePlaybackPosition]
  );

  const tryApplyResumeSeek = useCallback(
    (video: HTMLVideoElement | null): boolean => {
      if (!video || isLive) return false;
      if (seekOffsetSecondsRef.current > 0) {
        pendingResumeTargetRef.current = 0;
        return false;
      }
      const target = pendingResumeTargetRef.current;
      if (!Number.isFinite(target) || target <= 3) return false;
      if (video.readyState < 1) return false;

      if (Number.isFinite(video.duration) && video.duration >= 10 && target >= video.duration - 2) {
        pendingResumeTargetRef.current = 0;
        return false;
      }

      const cur = video.currentTime || 0;
      if (Math.abs(cur - target) <= 4) {
        pendingResumeTargetRef.current = 0;
        resumeSeekAttemptsRef.current = 0;
        return false;
      }

      const now = performance.now();
      if (now - lastResumeAttemptAtRef.current < 300) {
        return false;
      }
      if (resumeSeekAttemptsRef.current >= 10) {
        pendingResumeTargetRef.current = 0;
        return false;
      }

      lastResumeAttemptAtRef.current = now;
      resumeSeekAttemptsRef.current += 1;
      try {
        video.currentTime = target;
        setCurrentTime(target);
        return true;
      } catch {
        return false;
      }
    },
    [isLive]
  );

  // Persist watch progress helper (never drops progress when stream duration isn't reported yet)
  const persistProgress = useCallback(
    (timeVal: number, durVal: number) => {
      if (isLive || timeVal < 3) return;
      const safeDuration =
        Number.isFinite(durVal) && durVal > 5
          ? durVal
          : knownRuntimeRef.current > 5
          ? knownRuntimeRef.current
          : Math.max(timeVal + 300, 600);
      const key = getWatchProgressKeyForSession(session);

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
        duration: safeDuration,
        updatedAt: Date.now(),
      });
    },
    [isLive, session, saveWatchProgress]
  );

  const safePlay = useCallback(
    async (video: HTMLVideoElement) => {
      try {
        tryApplyResumeSeek(video);
        const promise = video.play();
        playPromiseRef.current = promise;
        await promise;
        tryApplyResumeSeek(video);
        setIsPlaying(true);
        setIsBuffering(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError')) {
          try {
            video.muted = true;
            isMutedRef.current = true;
            setIsMuted(true);
            setShowUnmutePrompt(true);
            tryApplyResumeSeek(video);
            const mutedPromise = video.play();
            playPromiseRef.current = mutedPromise;
            await mutedPromise;
            tryApplyResumeSeek(video);
            setIsPlaying(true);
            setIsBuffering(false);
            return;
          } catch {
            // Fall through if even muted playback is disallowed
          }
        }
        setIsPlaying(false);
        setIsBuffering(false);
      } finally {
        playPromiseRef.current = null;
      }
    },
    [tryApplyResumeSeek]
  );

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
      const cur = getAbsolutePlaybackPosition();
      const dur = effectiveDuration > 0 ? effectiveDuration : video.duration;
      if (cur > 3) resumePositionRef.current = cur;
      persistProgress(cur, dur);
    },
    [effectiveDuration, persistProgress, getAbsolutePlaybackPosition]
  );

  const isActiveP2PTorrent = Boolean(
    activeSource &&
      activeSource.format !== 'youtube' &&
      activeSource.format !== 'embed' &&
      activeSource.url.includes('/api/torrent/stream') &&
      !activeSource.url.includes('p2p=0')
  );

  const tryAutoRemuxUpgrade = useCallback(
    (source: StreamSource | null): boolean => {
      if (!source || isLive) return false;
      if (source.format === 'youtube' || source.format === 'embed' || source.format === 'hls') {
        return false;
      }
      if (isServerRemuxUrl(source.url) || autoRemuxAttemptedIdsRef.current.has(source.id)) {
        return false;
      }
      const resumeAt = Math.floor(getAbsolutePlaybackPosition());
      let upgradedUrl = '';
      if (source.url.includes('/api/torrent/stream') || source.url.includes('/api/stream-proxy')) {
        const sep = source.url.includes('?') ? '&' : '?';
        upgradedUrl = `${source.url}${sep}remux=1`;
      } else if (source.url.startsWith('http://') || source.url.startsWith('https://')) {
        upgradedUrl = `/api/stream-proxy?url=${encodeURIComponent(source.url)}&remux=1`;
      } else {
        return false;
      }

      if (resumeAt > 3) {
        upgradedUrl = buildUrlWithSeekParam(upgradedUrl, resumeAt);
        resumePositionRef.current = resumeAt;
        seekOffsetSecondsRef.current = resumeAt;
        pendingResumeTargetRef.current = 0;
      }

      autoRemuxAttemptedIdsRef.current.add(source.id);
      if (upgradedUrl.includes('/api/torrent/stream')) {
        p2pBypassForSourceRef.current = source.id;
      }
      const upgradedSource: StreamSource = {
        ...source,
        url: upgradedUrl,
        format: 'mp4',
      };
      setSources((prev) => prev.map((s) => (s.id === source.id ? upgradedSource : s)));
      setActiveSource(upgradedSource);
      return true;
    },
    [isLive, getAbsolutePlaybackPosition]
  );

  const showPlayerToast = useCallback((message: string, durationMs = 3200) => {
    if (playerToastTimerRef.current !== null) {
      window.clearTimeout(playerToastTimerRef.current);
    }
    setLiveSwitchToast(message);
    playerToastTimerRef.current = window.setTimeout(() => {
      setLiveSwitchToast(null);
      playerToastTimerRef.current = null;
    }, durationMs);
  }, []);

  const handlePlaybackFailure = useCallback(
    (source: StreamSource | null, errorMsg: string) => {
      if (isLive && session.liveChannel) {
        const currentCh = liveFeedsList[activeLiveFeedIdx] || session.liveChannel;
        markChannelHealth(currentCh.id, false);
        failedLiveUrlsRef.current.add(currentCh.streamUrl);

        if (liveFeedsList.length > 1) {
          const nextIdx = liveFeedsList.findIndex(
            (feed, idx) => idx !== activeLiveFeedIdx && !failedLiveUrlsRef.current.has(feed.streamUrl)
          );
          if (nextIdx >= 0) {
            showPlayerToast(
              `Feed ${activeLiveFeedIdx + 1} unavailable · Switching to backup feed ${nextIdx + 1}...`,
              2400
            );
            setActiveLiveFeedIdx(nextIdx);
            return;
          }
        }
      }
      if (source && !isLive) {
        const curPos = getAbsolutePlaybackPosition();
        if (curPos > 3) {
          resumePositionRef.current = curPos;
        }

        // If a user-requested quality transcode failed, revert cleanly to original quality on the SAME server
        if (
          pendingQualityFallbackRef.current &&
          pendingQualityFallbackRef.current.sourceId === source.id
        ) {
          const failedQual = pendingQualityFallbackRef.current.qualId;
          pendingQualityFallbackRef.current = null;
          const base = qualityBaseSourceRef.current;
          qualityBaseSourceRef.current = null;
          setSelectedQualityOption('auto');
          const restoredSource: StreamSource =
            base && base.id === source.id
              ? {
                  ...source,
                  url: base.url,
                  format: base.format,
                  quality: base.quality,
                }
              : {
                  ...source,
                  url: source.url
                    .replace(/([?&])quality=[^&]*/g, '$1')
                    .replace(/\?&/, '?')
                    .replace(/[?&]$/, ''),
                };
          if (restoredSource.url.includes('/api/torrent/stream')) {
            p2pBypassForSourceRef.current = restoredSource.id;
          }
          setStreamError(null);
          setIsBuffering(true);
          setActiveSource(prepareSourceWithResume(restoredSource, curPos));
          showPlayerToast(`${failedQual.toUpperCase()} unavailable · Playing original quality`);
          return;
        }

        failedSourceIdsRef.current.add(source.id);
        const pool = isBengaliSession
          ? sourcesRef.current.filter((s) => s.format !== 'youtube')
          : sourcesRef.current;
        const maxAttempts = Math.min(24, Math.max(1, pool.length));
        if (failedSourceIdsRef.current.size < maxAttempts && pool.length > 0) {
          const activeLang =
            source.audioLanguage && source.audioLanguage !== 'Original'
              ? source.audioLanguage
              : userLockedLanguageRef.current
              ? source.audioLanguage
              : 'Hindi';
          const sameLangFallback = activeLang
            ? selectMostCompatibleSource(pool, failedSourceIdsRef.current, activeLang, true) ||
              selectMostCompatibleSource(pool, failedSourceIdsRef.current, activeLang, false)
            : null;
          const anyLangFallback =
            sameLangFallback ||
            (!userLockedLanguageRef.current
              ? selectMostCompatibleSource(pool, failedSourceIdsRef.current, undefined, true) ||
                selectMostCompatibleSource(pool, failedSourceIdsRef.current, undefined, false) ||
                pool.find((s) => !failedSourceIdsRef.current.has(s.id) && s.id !== source.id) ||
                null
              : null);
          if (anyLangFallback && anyLangFallback.id !== source.id) {
            qualityBaseSourceRef.current = null;
            pendingQualityFallbackRef.current = null;
            setSelectedQualityOption('auto');
            setActiveSource(prepareSourceWithResume(anyLangFallback, curPos));
            return;
          }
        }
      }
      setStreamError(
        isBengaliSession
          ? 'No Bengali serial stream provider is available (YouTube playback disabled).'
          : errorMsg
      );
      setIsBuffering(false);
    },
    [
      isLive,
      isBengaliSession,
      session.liveChannel,
      liveFeedsList,
      activeLiveFeedIdx,
      markChannelHealth,
      getAbsolutePlaybackPosition,
      prepareSourceWithResume,
      showPlayerToast,
    ]
  );

  // P2P Torrent preparation + sequential pre-buffering status polling before attaching <video>
  useEffect(() => {
    if (!activeSource || !isActiveP2PTorrent) {
      setP2pStatus(null);
      setP2pAttachUrl(null);
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(activeSource.url, window.location.origin);
    } catch {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    const infoHash = (parsedUrl.searchParams.get('infoHash') || '').toLowerCase();
    const fileIdx = parsedUrl.searchParams.get('fileIdx');
    const season = parsedUrl.searchParams.get('season');
    const episode = parsedUrl.searchParams.get('episode');
    const tr = parsedUrl.searchParams.get('tr');
    const prebufferMb = Number(parsedUrl.searchParams.get('prebufferMb') || 5);

    if (!infoHash) {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    if (
      p2pBypassForSourceRef.current === activeSource.id ||
      readyTorrentHashesRef.current.has(infoHash)
    ) {
      setP2pAttachUrl(activeSource.url);
      return;
    }

    let cancelled = false;
    setP2pAttachUrl(null);
    setStreamError(null);
    setIsBuffering(true);

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
      targetBytes: Math.max(2, Math.min(30, prebufferMb)) * 1024 * 1024,
      minReadyBytes: 512 * 1024,
      headReady: false,
      tailReady: false,
      progressPct: 0,
      launchProgressPct: 0,
      readyToPlay: false,
    });

    const controller = new AbortController();
    const startTimeMs = Date.now();
    let pollTimer: number | null = null;
    let initialPollTimer: number | null = null;
    let maxWaitTimer: number | null = null;
    let pollInFlight = false;

    const stopTimers = () => {
      if (initialPollTimer !== null) {
        window.clearTimeout(initialPollTimer);
        initialPollTimer = null;
      }
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
      if (cancelled || pollInFlight) return;
      pollInFlight = true;
      try {
        const res = await fetch(`/api/torrent/status?${baseParams.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as P2PPrebufferStatus;
        if (cancelled) return;
        setP2pStatus(data);
        const elapsedMs = Date.now() - startTimeMs;
        const hasDirectMirrors = sourcesRef.current.some(
          (s) => !s.url.includes('/api/torrent/stream') && !failedSourceIdsRef.current.has(s.id)
        );
        if (
          data.readyToPlay ||
          data.headReady ||
          (data.ready && data.prebufferedBytes >= 256 * 1024 && (data.peers > 0 || elapsedMs >= 6000))
        ) {
          readyTorrentHashesRef.current.add(infoHash);
          stopTimers();
          setP2pAttachUrl(activeSource.url);
          return;
        }
        // Fail fast only after tracker discovery window if swarm has zero reachable peers and direct mirrors exist
        if (elapsedMs >= 11000 && !data.ready && data.peers === 0 && hasDirectMirrors) {
          stopTimers();
          controller.abort();
          handlePlaybackFailure(
            activeSource,
            'No P2P peers found. Switching to instant direct server.'
          );
        }
      } catch {
        // Ignore transient status poll aborts
      } finally {
        pollInFlight = false;
      }
    };

    initialPollTimer = window.setTimeout(() => {
      void pollStatus();
    }, 150);

    pollTimer = window.setInterval(() => {
      void pollStatus();
    }, 300);

    maxWaitTimer = window.setTimeout(() => {
      if (cancelled) return;
      stopTimers();
      controller.abort();
      handlePlaybackFailure(
        activeSource,
        'P2P torrent swarm has too few peers or timed out while pre-buffering. Click Play Now or switch to a direct server.'
      );
    }, 45000);

    const runPrepare = async () => {
      try {
        const prepareTimer = window.setTimeout(() => controller.abort(), 45000);
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
        const elapsedMs = Date.now() - startTimeMs;
        if (
          data.readyToPlay ||
          data.headReady ||
          (data.ready && (data.prebufferedBytes >= 256 * 1024 || elapsedMs >= 1600))
        ) {
          readyTorrentHashesRef.current.add(infoHash);
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
    const myGen = ++mountGenRef.current;
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

    let parsedSs = 0;
    try {
      const parsedActive = new URL(activeSource.url, window.location.origin);
      const ssVal = Number(parsedActive.searchParams.get('ss') || '0');
      if (Number.isFinite(ssVal) && ssVal > 0) parsedSs = Math.floor(ssVal);
    } catch {
      // Ignore malformed URL
    }
    seekOffsetSecondsRef.current = parsedSs;

    const candidateResume = Math.max(
      resumePositionRef.current,
      pendingResumeTargetRef.current
    );
    const startTime =
      parsedSs === 0 && candidateResume > 3 ? candidateResume : 0;
    pendingResumeTargetRef.current = startTime > 3 ? startTime : 0;
    resumeSeekAttemptsRef.current = 0;

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
      if (Number.isFinite(video.duration) && video.duration > 0) {
        applyReportedDuration(video.duration);
      }
      tryApplyResumeSeek(video);
      video.playbackRate = playbackRateRef.current;
      video.muted = isMutedRef.current;
      video.volume = isMutedRef.current ? 0 : volumeRef.current;
      if (!hlsActiveRef.current) {
        syncNativeAudioTracks();
      }
      void safePlay(video);
    };

    const hasAltLiveFeeds = isLive && liveFeedsList.length > 1;
    const hasAltVodMirrors =
      !isLive &&
      sourcesRef.current.some(
        (s) =>
          s.id !== activeSource.id &&
          !failedSourceIdsRef.current.has(s.id) &&
          !s.url.includes('/api/torrent/stream')
      );
    const isRemuxSrc = isServerRemuxUrl(activeSource.url);
    const isQualitySwitching =
      pendingQualityFallbackRef.current?.sourceId === activeSource.id;
    const stallBudgetMs = isLive
      ? 18000
      : isQualitySwitching
      ? 26000
      : isActiveP2PTorrent
      ? isRemuxSrc
        ? 26000
        : 18000
      : hasAltVodMirrors
      ? isRemuxSrc
        ? 18000
        : 8500
      : isRemuxSrc
      ? 22000
      : 12000;

    startupStallTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (video.readyState < 2) {
        if (tryAutoRemuxUpgrade(activeSource)) {
          return;
        }
        handlePlaybackFailure(
          activeSource,
          isLive
            ? 'This live channel did not respond in time. Click Continue/Retry or switch channels.'
            : 'Stream startup timed out without receiving video frames. Click Continue to switch to another server.'
        );
      }
    }, stallBudgetMs);

    let retryCount = 0;
    let triedNativeFallback = false;

    const onDirectVideoError = () => {
      if (cancelled || hlsActiveRef.current) return;
      if (!video.getAttribute('src')) return;
      clearStallTimer();
      if (tryAutoRemuxUpgrade(activeSource)) {
        return;
      }
      handlePlaybackFailure(
        activeSource,
        isLive
          ? 'Playback error loading this live stream. Click Continue to retry or switch channels.'
          : 'Unable to play this stream directly in the browser.'
      );
    };

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
      video.addEventListener('canplay', handleLoadedMetadata, { once: true });
      video.addEventListener('error', onDirectVideoError, { once: true });
      video.load();
      return true;
    };

    const bufferMb = storageService.getPlayerBufferMb();
    const hlsMaxLen = bufferMb === 25 ? 25 : bufferMb === 50 ? 45 : bufferMb === 75 ? 65 : 90;
    const hlsMaxMaxLen = bufferMb === 25 ? 45 : bufferMb === 50 ? 90 : bufferMb === 75 ? 120 : 150;
    let localHls: Hls | null = null;

    if (activeSource.format === 'hls' && Hls.isSupported()) {
      hlsActiveRef.current = true;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        startFragPrefetch: true,
        startPosition: !isLive && startTime > 3 ? startTime : -1,
        backBufferLength: 60,
        maxBufferSize: bufferMb * 1024 * 1024,
        maxBufferLength: hlsMaxLen,
        maxMaxBufferLength: hlsMaxMaxLen,
        manifestLoadingTimeOut: isLive ? 14000 : 6500,
        fragLoadingTimeOut: isLive ? 18000 : 8500,
        manifestLoadingMaxRetry: isLive ? 5 : 1,
        levelLoadingMaxRetry: isLive ? 5 : 1,
        fragLoadingMaxRetry: isLive ? 8 : 2,
      });
      hlsRef.current = hls;
      localHls = hls;

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
            const explicitLang = (urlAudioLang || activeSource.audioLanguage || '').trim();
            const wantedTokens = extractLangTokens(explicitLang);
            if (wantedTokens.length === 0 && !userLockedLanguageRef.current) {
              wantedTokens.push('hindi');
            }
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

      hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
        if (cancelled || isLive) return;
        const totalDur = data.details?.totalduration;
        if (totalDur && Number.isFinite(totalDur) && totalDur > 0 && !data.details?.live) {
          applyReportedDuration(totalDur);
        }
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
                ? 'This broadcast feed is currently unreachable, geo-restricted, or protected by broadcast DRM. Click Retry or switch to another channel.'
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
      video.addEventListener('canplay', handleLoadedMetadata, { once: true });
      video.addEventListener('error', onDirectVideoError, { once: true });
      video.load();
      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }
    }

    return () => {
      cancelled = true;
      clearStallTimer();
      hlsActiveRef.current = false;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleLoadedMetadata);
      video.removeEventListener('error', onDirectVideoError);
      const pendingPlay = playPromiseRef.current;
      const cleanupMedia = () => {
        if (localHls) {
          localHls.destroy();
          if (hlsRef.current === localHls) {
            hlsRef.current = null;
          }
        }
        // Only tear down the shared <video> element if no newer source mount superseded us
        if (myGen === mountGenRef.current) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
      };
      if (pendingPlay) {
        void pendingPlay.catch(() => {}).finally(cleanupMedia);
      } else {
        cleanupMedia();
      }
    };
  }, [activeSource, p2pAttachUrl, isActiveP2PTorrent, isLive, liveFeedsList.length, safePlay, reloadTick, handlePlaybackFailure, tryAutoRemuxUpgrade]);

  // Helper to resolve shifted subtitle cues cleanly (supports remux ?ss=N offset)
  const syncOffsetCueText = useCallback(
    (track: TextTrack, offsetSec: number, videoTime: number) => {
      if (offsetSec <= 0) return;
      const cues = track.cues;
      if (!cues || cues.length === 0) return;
      const absTime = offsetSec + videoTime;
      const matched: string[] = [];
      for (let i = 0; i < cues.length; i += 1) {
        const cue = cues[i] as VTTCue;
        if (cue.startTime <= absTime && cue.endTime >= absTime && cue.text) {
          matched.push(cue.text);
        }
      }
      setActiveCueText(matched.join('\n'));
    },
    []
  );

  // Sync subtitle track cues to custom caption overlay (match by track ID / label, not brittle index)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = Array.from(video.textTracks);
    tracks.forEach((track) => {
      track.mode = 'disabled';
    });

    if (activeSubtitleId === 'off') {
      setActiveCueText('');
      return;
    }

    const activeSubMeta = subtitles.find((s) => s.id === activeSubtitleId);
    const targetTrack =
      tracks.find((t) => t.id === activeSubtitleId) ||
      (activeSubMeta
        ? tracks.find(
            (t) =>
              t.label === activeSubMeta.label &&
              (!t.language || t.language === activeSubMeta.language)
          )
        : undefined) ||
      null;

    if (!targetTrack) {
      setActiveCueText('');
      return;
    }

    targetTrack.mode = 'hidden';

    const onCueChange = () => {
      if (seekOffsetSecondsRef.current > 0) {
        syncOffsetCueText(
          targetTrack,
          seekOffsetSecondsRef.current,
          videoRef.current?.currentTime || 0
        );
        return;
      }
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
  }, [activeSubtitleId, subtitles, resolvedSubUrls, syncOffsetCueText]);

  // Auto-save playback progress every 4 seconds + immediately on tab hide/page leave/unmount
  useEffect(() => {
    if (isLive) return;
    const flushProgress = () => {
      const video = videoRef.current;
      const cur = getAbsolutePlaybackPosition();
      const dur = effectiveDuration > 0 ? effectiveDuration : (video?.duration || 0);
      if (cur >= 3) {
        persistProgress(cur, dur);
      }
    };
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        flushProgress();
      }
    }, 4000);
    const handleVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        flushProgress();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrHide);
    window.addEventListener('pagehide', flushProgress);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrHide);
      window.removeEventListener('pagehide', flushProgress);
      flushProgress();
    };
  }, [isLive, effectiveDuration, persistProgress, getAbsolutePlaybackPosition]);

  // Ongoing playback stall detector: auto-switch VOD server after 25s or Live feed after 1.5s
  useEffect(() => {
    if (!isBuffering || !isPlaying || streamError || (isActiveP2PTorrent && p2pAttachUrl !== activeSource?.url)) {
      return;
    }
    const canFailover = isLive
      ? liveFeedsList.length > 1
      : sourcesRef.current.some(
          (s) =>
            s.id !== activeSource?.id &&
            !failedSourceIdsRef.current.has(s.id) &&
            !s.url.includes('/api/torrent/stream')
        );
    if (!canFailover || !activeSource) return;

    const timeoutMs = isLive
      ? 1500
      : isServerRemuxUrl(activeSource.url)
      ? 35000
      : 25000;
    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.readyState >= 3) return;
      handlePlaybackFailure(
        activeSource,
        isLive ? 'Live feed stalled. Switching backup feed...' : 'Stream stalled.'
      );
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [
    isBuffering,
    isPlaying,
    streamError,
    isLive,
    isActiveP2PTorrent,
    p2pAttachUrl,
    activeSource,
    liveFeedsList.length,
    handlePlaybackFailure,
  ]);

  // Auto-hide controls timer (keep visible while resolving streams or buffering before first frame)
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    const stillStarting = !hasPlayedFramesRef.current && (isBuffering || isResolvingStreams || sources.length === 0);
    if (stillStarting) {
      return;
    }
    controlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying && openMenu === 'none') {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying, openMenu, isBuffering, isResolvingStreams, sources.length]);

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
      if (
        !isLive &&
        (video.ended ||
          (seekOffsetSecondsRef.current === 0 &&
            (video.currentTime || 0) < 1 &&
            resumePositionRef.current > 5))
      ) {
        pendingResumeTargetRef.current = resumePositionRef.current;
        resumeSeekAttemptsRef.current = 0;
        tryApplyResumeSeek(video);
      }
      void safePlay(video);
    } else {
      void safePause(video);
    }
    wakeControls();
  }, [isLive, safePlay, safePause, tryApplyResumeSeek, wakeControls]);

  const seekToSeconds = useCallback(
    (rawTarget: number) => {
      const video = videoRef.current;
      if (!video || isLive) return;
      const maxDuration = effectiveDuration > 0 ? effectiveDuration : Infinity;
      const target = Math.min(maxDuration, Math.max(0, rawTarget));
      resumePositionRef.current = target;
      pendingResumeTargetRef.current = 0;
      resumeSeekAttemptsRef.current = 0;
      setResumedNoticeTime(null);

      if (isServerRemuxUrl(activeSource?.url) && activeSource) {
        const seekUrl = buildUrlWithSeekParam(activeSource.url, target);
        seekOffsetSecondsRef.current = target > 3 ? Math.floor(target) : 0;
        setCurrentTime(target);
        setIsBuffering(true);
        const updatedSource: StreamSource = { ...activeSource, url: seekUrl };
        setSources((prev) => prev.map((s) => (s.id === activeSource.id ? updatedSource : s)));
        setActiveSource(updatedSource);
      } else {
        video.currentTime = target;
        setCurrentTime(target);
      }
      wakeControls();
    },
    [isLive, effectiveDuration, activeSource, wakeControls]
  );

  const seekBy = useCallback(
    (delta: number) => {
      const current = getAbsolutePlaybackPosition();
      seekToSeconds(current + delta);
      if (seekFeedbackTimerRef.current !== null) {
        window.clearTimeout(seekFeedbackTimerRef.current);
      }
      setSeekFeedback({
        dir: delta < 0 ? 'back' : 'forward',
        amount: Math.abs(delta),
        key: Date.now(),
      });
      seekFeedbackTimerRef.current = window.setTimeout(() => {
        setSeekFeedback(null);
      }, 650);
    },
    [getAbsolutePlaybackPosition, seekToSeconds]
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
    const isNative = nativeAndroidBridge.isNativeAndroid();
    const nextFullscreen = isNative ? !isFullscreen : !document.fullscreenElement;

    if (isNative) {
      await nativeAndroidBridge.setPlayerFullscreen(nextFullscreen, nextFullscreen);
      setIsFullscreen(nextFullscreen);
    }

    if (!el) return;
    try {
      if (nextFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else if (!nextFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      if (isNative) {
        setIsFullscreen(nextFullscreen);
      }
    }
  }, [isFullscreen]);

  const handleClose = useCallback(() => {
    const video = videoRef.current;
    const cur = getAbsolutePlaybackPosition();
    const dur = effectiveDuration > 0 ? effectiveDuration : (video?.duration || 0);
    if (cur >= 3) {
      persistProgress(cur, dur);
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    void nativeAndroidBridge.setPlayerFullscreen(false, false);
    closePlayback();
  }, [closePlayback, effectiveDuration, persistProgress, getAbsolutePlaybackPosition]);

  // Auto-lock screen orientation to landscape and request fullscreen when playing any video
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
        void window.screen.orientation.lock('landscape').catch(() => {});
      }
      void nativeAndroidBridge.setPlayerFullscreen(true, true);
      const el = containerRef.current;
      if (el && !document.fullscreenElement) {
        void el.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore orientation lock restrictions
    }

    return () => {
      try {
        if (typeof window !== 'undefined' && window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
          window.screen.orientation.unlock();
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
        void nativeAndroidBridge.setPlayerFullscreen(false, false);
      } catch {
        // Ignore
      }
    };
  }, []);

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

  const handleSelectQuality = (qualId: string) => {
    setSelectedQualityOption(qualId);
    setOpenMenu('none');

    if (!activeSource) return;

    const curPos = getAbsolutePlaybackPosition();
    if (curPos > 3) resumePositionRef.current = curPos;

    // Remember the original unmodified stream (including its native 'hls' or 'mp4' format)
    if (!qualityBaseSourceRef.current || qualityBaseSourceRef.current.id !== activeSource.id) {
      qualityBaseSourceRef.current = {
        id: activeSource.id,
        url: stripSeekParam(activeSource.url),
        format: activeSource.format,
        quality: activeSource.quality,
      };
    }

    const base = qualityBaseSourceRef.current;

    if (qualId === 'auto') {
      pendingQualityFallbackRef.current = null;
      qualityBaseSourceRef.current = null;
      if (base.url.includes('/api/torrent/stream')) {
        p2pBypassForSourceRef.current = activeSource.id;
      }
      const prepared = prepareSourceWithResume(
        {
          ...activeSource,
          url: base.url,
          format: base.format,
          quality: base.quality || 'Auto',
        },
        curPos
      );
      setStreamError(null);
      setIsBuffering(true);
      setActiveSource(prepared);
      return;
    }

    let targetUrl = base.url;
    if (!targetUrl.includes('/api/stream-proxy') && !targetUrl.includes('/api/torrent/stream')) {
      targetUrl = `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}&remux=1&quality=${qualId}`;
    } else {
      if (targetUrl.includes('/api/stream-proxy') && !/[?&]remux=/.test(targetUrl)) {
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}remux=1`;
      }
      if (/[?&]quality=/.test(targetUrl)) {
        targetUrl = targetUrl.replace(/([?&]quality=)[^&]*/, `$1${qualId}`);
      } else {
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}quality=${qualId}`;
      }
    }

    if (targetUrl.includes('/api/torrent/stream')) {
      try {
        const parsed = new URL(targetUrl, window.location.origin);
        const hash = (parsed.searchParams.get('infoHash') || '').toLowerCase();
        if (
          p2pStatus?.ready ||
          p2pStatus?.headReady ||
          (hash && readyTorrentHashesRef.current.has(hash))
        ) {
          p2pBypassForSourceRef.current = activeSource.id;
        }
      } catch {
        // Ignore URL parse issues
      }
    }

    // Server quality transcoding always outputs fragmented MP4, so update format from 'hls' -> 'mp4'
    // and mark pending fallback so scaling errors revert to Auto on the SAME server instead of jumping providers.
    pendingQualityFallbackRef.current = { sourceId: activeSource.id, qualId };
    const prepared = prepareSourceWithResume(
      {
        ...activeSource,
        url: targetUrl,
        format: 'mp4',
        quality: qualId.toUpperCase(),
      },
      curPos
    );
    setStreamError(null);
    setIsBuffering(true);
    setActiveSource(prepared);
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
  const timelineDuration =
    effectiveDuration > 0 && effectiveDuration + 0.5 >= displayTime
      ? effectiveDuration
      : knownRuntimeSeconds > 0 && knownRuntimeSeconds + 0.5 >= displayTime
      ? knownRuntimeSeconds
      : 0;
  const sliderMax = timelineDuration > 0 ? timelineDuration : Math.max(displayTime, bufferedEnd, 1);
  const progressPct = sliderMax > 0 ? Math.min(100, (displayTime / sliderMax) * 100) : 0;
  const bufferedPct = sliderMax > 0 ? Math.min(100, (bufferedEnd / sliderMax) * 100) : 0;
  const displayEndClock =
    timelineDuration > 0
      ? formatClock(timelineDuration)
      : bufferedEnd > displayTime + 0.5
      ? formatClock(bufferedEnd)
      : '--:--';

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
    const curAbsTime = getAbsolutePlaybackPosition();
    if (curAbsTime > 3) {
      resumePositionRef.current = curAbsTime;
    }

    if (opt.type === 'hls-track' && typeof opt.trackIndex === 'number') {
      selectAudioTrack(opt.trackIndex);
    } else if (opt.type === 'remux-lang' && opt.targetLang && activeSource) {
      const nextUrl = activeSource.url.includes('lang=')
        ? activeSource.url.replace(/([?&]lang=)[^&]*/i, `$1${encodeURIComponent(opt.targetLang)}`)
        : `${activeSource.url}&lang=${encodeURIComponent(opt.targetLang)}`;
      const updatedSource = prepareSourceWithResume(
        { ...activeSource, url: nextUrl },
        curAbsTime
      );
      setSources((prev) => prev.map((s) => (s.id === activeSource.id ? updatedSource : s)));
      setActiveSource(updatedSource);
    } else if (opt.targetLang) {
      const best =
        selectMostCompatibleSource(sources, failedSourceIdsRef.current, opt.targetLang) ||
        sources.find(
          (s) => (s.audioLanguage || '').toLowerCase() === opt.targetLang?.toLowerCase()
        );
      if (best && best.id !== activeSource?.id) {
        qualityBaseSourceRef.current = null;
        pendingQualityFallbackRef.current = null;
        setSelectedQualityOption('auto');
        setActiveSource(prepareSourceWithResume(best, curAbsTime));
      }
    }
    setOpenMenu('none');
  };

  // Filtered Sources Drawer datasets
  const nonTrailerSources = useMemo(
    () => sources.filter((s) => s.format !== 'youtube'),
    [sources]
  );
  const drawerLanguages = useMemo(
    () => getAvailableLanguages(nonTrailerSources),
    [nonTrailerSources]
  );
  const filteredDrawerSources = useMemo(() => {
    return sources.filter((s) => {
      if (!matchesSourceTypeFilter(s, drawerTypeFilter)) return false;
      if (drawerLanguageFilter !== 'All') {
        const tags = extractLanguageTags(s.audioLanguage);
        if (!tags.includes(drawerLanguageFilter)) return false;
      }
      if (!matchesQualityFilter(s, drawerQualityFilter)) return false;
      return true;
    });
  }, [sources, drawerTypeFilter, drawerLanguageFilter, drawerQualityFilter]);

  const hasDrawerFilter =
    drawerTypeFilter !== 'all' ||
    drawerLanguageFilter !== 'All' ||
    drawerQualityFilter !== 'all';

  const resetDrawerFilters = () => {
    setDrawerTypeFilter('all');
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
      style={
        {
          '--player-accent': accent.hex,
          '--player-accent-glow': `rgba(${accent.glowRgb}, 0.36)`,
        } as React.CSSProperties
      }
      className="fixed inset-0 z-50 bg-black select-none flex items-center justify-center overflow-hidden"
    >
      {(activeSource?.format === 'youtube' && !isBengaliSession) || activeSource?.format === 'embed' ? (
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

            <div className="flex items-center gap-2 shrink-0">
              {!isLive && (
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'sources' ? 'none' : 'sources')}
                  aria-label="Open stream sources"
                  className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    openMenu === 'sources'
                      ? 'text-white border-transparent shadow-md'
                      : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                  }`}
                  style={openMenu === 'sources' ? { backgroundColor: accent.hex } : undefined}
                >
                  {sources.length === 0 && isResolvingStreams ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Finding...</span>
                    </>
                  ) : (
                    <>
                      <Server className="h-4 w-4" />
                      <span>Sources ({sources.length})</span>
                    </>
                  )}
                </button>
              )}

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
          </div>

          {activeSource.format === 'youtube' && !isBengaliSession ? (
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
                    <span className="font-medium text-white">This server</span> sets browser security headers (<code className="text-slate-200">X-Frame-Options</code>) that prevent playback inside an embedded frame. Open it directly in your browser or switch to a direct HLS/MP4 server.
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
                    <span>Open in External Tab</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  {sources.some((s) => s.id !== activeSource.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        const curPos = getAbsolutePlaybackPosition();
                        const nextDirect =
                          sources.find((s) => s.id !== activeSource.id && (s.format === 'hls' || s.format === 'mp4')) ||
                          sources.find((s) => s.id !== activeSource.id);
                        if (nextDirect) setActiveSource(prepareSourceWithResume(nextDirect, curPos));
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      <span>Continue</span>
                    </button>
                  )}

                  {!isLive && (
                    <button
                      type="button"
                      onClick={() => setOpenMenu('sources')}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors"
                    >
                      <Server className="h-4 w-4" />
                      <span>Switch Server ({sources.length})</span>
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
            onLoadedData={(e) => {
              setIsBuffering(false);
              tryApplyResumeSeek(e.currentTarget);
            }}
            onCanPlay={(e) => {
              setIsBuffering(false);
              tryApplyResumeSeek(e.currentTarget);
            }}
            onCanPlayThrough={(e) => {
              setIsBuffering(false);
              tryApplyResumeSeek(e.currentTarget);
            }}
            onSeeked={(e) => {
              const absCur = seekOffsetSecondsRef.current + (e.currentTarget.currentTime || 0);
              if (
                pendingResumeTargetRef.current > 3 &&
                Math.abs(absCur - pendingResumeTargetRef.current) <= 4
              ) {
                pendingResumeTargetRef.current = 0;
                resumeSeekAttemptsRef.current = 0;
              }
            }}
            onError={(e) => {
              if (hlsActiveRef.current) return;
              const video = e.currentTarget;
              if (!video.getAttribute('src')) return;
              if (tryAutoRemuxUpgrade(activeSource)) return;
              handlePlaybackFailure(
                activeSource,
                isLive
                  ? 'Playback error loading this live stream. Click Continue to retry or switch channels.'
                  : 'Unable to play this stream directly in the browser.'
              );
            }}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={(e) => {
              const video = e.currentTarget;
              tryApplyResumeSeek(video);
              hasPlayedFramesRef.current = true;
              pendingQualityFallbackRef.current = null;
              setHasFirstFrame(true);
              setIsBuffering(false);
              setIsPlaying(true);
              wakeControls();
              if (isLive && session.liveChannel) {
                markChannelHealth(session.liveChannel.id, true);
              }
              const absCur = seekOffsetSecondsRef.current + (video.currentTime || 0);
              if (
                !isLive &&
                initialResumeToastTargetRef.current > 5 &&
                !resumedToastShownRef.current &&
                (absCur > 5 || seekOffsetSecondsRef.current > 5)
              ) {
                resumedToastShownRef.current = true;
                const noticeSec = Math.floor(initialResumeToastTargetRef.current);
                setResumedNoticeTime(noticeSec);
                window.setTimeout(() => {
                  setResumedNoticeTime((cur) => (cur === noticeSec ? null : cur));
                }, 6000);
              }
            }}
            onPause={(e) => {
              setIsPlaying(false);
              const cur = getAbsolutePlaybackPosition();
              const dur = effectiveDuration > 0 ? effectiveDuration : e.currentTarget.duration;
              if (cur >= 3) {
                resumePositionRef.current = cur;
                persistProgress(cur, dur);
              }
            }}
            onEnded={(e) => {
              if (isLive) return;
              const video = e.currentTarget;
              const cur = Math.max(
                seekOffsetSecondsRef.current + (video.currentTime || 0),
                resumePositionRef.current
              );
              const dur = effectiveDuration > 0 ? effectiveDuration : knownRuntimeRef.current;
              if (dur > 120 && cur > 5 && cur < dur - 25) {
                // Stream connection dropped mid-video; auto-recover from exact stopped timestamp
                resumePositionRef.current = cur;
                persistProgress(cur, dur);
                if (activeSource && prematureReconnectCountRef.current < 3) {
                  prematureReconnectCountRef.current += 1;
                  setIsBuffering(true);
                  if (isServerRemuxUrl(activeSource.url)) {
                    setActiveSource(prepareSourceWithResume(activeSource, cur));
                  } else {
                    pendingResumeTargetRef.current = cur;
                    resumeSeekAttemptsRef.current = 0;
                    setReloadTick((t) => t + 1);
                  }
                  return;
                }
                if (activeSource) {
                  handlePlaybackFailure(activeSource, 'Stream disconnected mid-playback.');
                  return;
                }
              }
              setIsPlaying(false);
            }}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              const rawTime = video.currentTime || 0;
              const computedCurrent = seekOffsetSecondsRef.current + rawTime;

              // Protect saved resume timestamp against initial 0:00 timeupdate events before seek completes
              if (
                !isLive &&
                pendingResumeTargetRef.current > 3 &&
                seekOffsetSecondsRef.current === 0
              ) {
                if (Math.abs(rawTime - pendingResumeTargetRef.current) <= 4) {
                  pendingResumeTargetRef.current = 0;
                  resumeSeekAttemptsRef.current = 0;
                  resumePositionRef.current = computedCurrent;
                } else if (rawTime < 3) {
                  tryApplyResumeSeek(video);
                  return;
                } else {
                  resumePositionRef.current = computedCurrent;
                }
              } else {
                resumePositionRef.current = computedCurrent;
              }

              if (activeSubtitleId !== 'off' && seekOffsetSecondsRef.current > 0) {
                const tracks = Array.from(video.textTracks);
                const tTrack = tracks.find((t) => t.id === activeSubtitleId);
                if (tTrack) {
                  syncOffsetCueText(tTrack, seekOffsetSecondsRef.current, rawTime);
                }
              }

              const now = performance.now();
              if (now - lastUiTimeUpdateRef.current >= 250) {
                lastUiTimeUpdateRef.current = now;
                setIsBuffering(false);
                if (seekPreviewTime === null) {
                  setCurrentTime(computedCurrent);
                }
                if (video.buffered.length > 0) {
                  setBufferedEnd(
                    seekOffsetSecondsRef.current + video.buffered.end(video.buffered.length - 1)
                  );
                }
                // Pick up late-growing stream duration or seekable range when durationchange does not fire
                const finiteVideoDur =
                  Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
                const seekableEnd =
                  video.seekable && video.seekable.length > 0
                    ? video.seekable.end(video.seekable.length - 1)
                    : 0;
                const bestRawDur = Math.max(
                  finiteVideoDur,
                  Number.isFinite(seekableEnd) && seekableEnd > 0 ? seekableEnd : 0
                );
                if (bestRawDur > 0) {
                  applyReportedDuration(bestRawDur);
                }
              }
            }}
            onDurationChange={() => {
              const video = videoRef.current;
              if (video && Number.isFinite(video.duration) && video.duration > 0) {
                applyReportedDuration(video.duration);
              }
              tryApplyResumeSeek(video);
            }}
          >
        {subtitles.map((sub, idx) => {
          const srcUrl = resolvedSubUrls[sub.id];
          if (!srcUrl) return null;
          return (
            <track
              key={`${sub.id}-${idx}`}
              id={sub.id}
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

      {/* Initial Cinema Pre-Buffering HUD (P2P Swarm VOD and Resolving states only — Live TV bypasses pre-buffering entirely) */}
      {!hasFirstFrame &&
        !streamError &&
        !isLive &&
        openMenu === 'none' &&
        ((isActiveP2PTorrent && p2pAttachUrl !== activeSource?.url) ||
          isBuffering ||
          (isResolvingStreams && !activeSource)) && (
          <CinemaPrebufferHUD
            mode={
              isActiveP2PTorrent && p2pAttachUrl !== activeSource?.url
                ? 'p2p'
                : !activeSource && isResolvingStreams
                ? 'resolving'
                : 'direct'
            }
            session={session}
            status={p2pStatus}
            activeSource={activeSource}
            accentHex={accent.hex}
            onCancel={handleClose}
            onSwitchServer={
              sources.length > 1
                ? () => {
                    wakeControls();
                    setOpenMenu('sources');
                  }
                : undefined
            }
            onContinueAnyway={
              isActiveP2PTorrent && activeSource
                ? () => {
                    p2pBypassForSourceRef.current = activeSource.id;
                    setP2pBypassTick((t) => t + 1);
                  }
                : undefined
            }
            hasAlternativeSources={sources.length > 1}
          />
        )}

      {/* Tap-to-Unmute prompt if browser/WebView enforced muted autoplay */}
      {showUnmutePrompt && isMuted && !streamError && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const v = videoRef.current;
            if (v) {
              v.muted = false;
              v.volume = volumeRef.current || 1;
            }
            isMutedRef.current = false;
            setIsMuted(false);
            setShowUnmutePrompt(false);
          }}
          className="player-interactive absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/80 hover:bg-black/95 border border-white/25 text-xs font-semibold text-white flex items-center gap-2 shadow-2xl backdrop-blur-xl transition-transform active:scale-95"
        >
          <VolumeX className="h-4 w-4 text-amber-400" />
          <span>Audio Muted · Tap to Unmute</span>
        </button>
      )}

      {/* Live Backup Feed Auto-Failover Toast */}
      {liveSwitchToast && !streamError && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full liquid-glass-strong text-xs font-semibold text-amber-300 shadow-xl">
          {liveSwitchToast}
        </div>
      )}

      {/* Resumed Playback Position Toast */}
      {resumedNoticeTime !== null && !streamError && !isLive && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="player-interactive absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl liquid-glass-strong shadow-2xl max-w-[92vw]"
        >
          <span className="text-xs font-medium text-slate-200 whitespace-nowrap">
            Resumed from{' '}
            <span className="font-mono-tabular font-bold text-white">
              {formatClock(resumedNoticeTime)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => seekToSeconds(0)}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-white transition-colors whitespace-nowrap"
          >
            Start Over
          </button>
          <button
            type="button"
            onClick={() => setResumedNoticeTime(null)}
            aria-label="Dismiss resume notice"
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tactile Seek Feedback Toast (-10s / +10s) */}
      {seekFeedback && !streamError && (
        <div
          key={seekFeedback.key}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-24 z-30 px-4 py-2 rounded-2xl liquid-glass-strong flex items-center gap-2 text-xs font-mono-tabular font-bold text-white shadow-2xl"
        >
          {seekFeedback.dir === 'back' ? (
            <>
              <RotateCcw className="h-4 w-4 text-white" />
              <span>-{seekFeedback.amount}s</span>
            </>
          ) : (
            <>
              <span>+{seekFeedback.amount}s</span>
              <RotateCw className="h-4 w-4 text-white" />
            </>
          )}
        </div>
      )}

      {/* Compact Mid-Playback Rebuffering Indicator */}
      {hasFirstFrame &&
        isBuffering &&
        !streamError &&
        (!isActiveP2PTorrent || p2pAttachUrl === activeSource?.url) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
            <div className="h-16 w-16 rounded-full liquid-glass-strong flex items-center justify-center shadow-2xl">
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: accent.hex }} />
            </div>
          </div>
        )}

      {/* Swipe Gesture HUD (Brightness / Volume) */}
      {gestureHud && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-5 py-3.5 rounded-2xl liquid-glass-strong flex items-center gap-3 shadow-2xl">
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-xl p-5">
          <div
            className="max-w-md w-full rounded-3xl liquid-glass-strong p-6 text-center space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
            style={{
              background:
                'linear-gradient(180deg, rgba(22, 26, 38, 0.9) 0%, rgba(10, 13, 22, 0.95) 100%)',
            }}
          >
            <div className="mx-auto h-12 w-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center">
              <Server className="h-5 w-5 text-slate-200" />
            </div>
            <div className="space-y-1.5">
              <p className="font-display text-lg font-bold text-white">Stream Unavailable</p>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {streamError}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  p2pBypassForSourceRef.current = null;
                  const curPos = getAbsolutePlaybackPosition();
                  const wantedLang = activeSource?.audioLanguage;
                  const nextAlt =
                    (wantedLang ? selectMostCompatibleSource(sources, failedSourceIdsRef.current, wantedLang, true) : null) ||
                    (wantedLang ? sources.find((s) => s.id !== activeSource?.id && s.audioLanguage === wantedLang) : null) ||
                    selectMostCompatibleSource(sources, failedSourceIdsRef.current, undefined, true) ||
                    sources.find((s) => s.id !== activeSource?.id);
                  if (nextAlt) {
                    setStreamError(null);
                    setActiveSource(prepareSourceWithResume(nextAlt, curPos));
                  } else {
                    setStreamError(null);
                    if (curPos > 3 && activeSource && !isServerRemuxUrl(activeSource.url)) {
                      pendingResumeTargetRef.current = curPos;
                    }
                    setReloadTick((t) => t + 1);
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
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

      {/* Custom Cinema Player Controls Overlay */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-200 ${
          showControls ? 'opacity-100 bg-black/25' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Ambient Scrim & Sleek Header Bar */}
        <div className="bg-gradient-to-b from-black/90 via-black/45 to-transparent px-4 sm:px-7 pt-4 pb-10 flex items-center justify-between gap-3">
          {!isLocked ? (
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close player"
                className="h-11 w-11 flex items-center justify-center rounded-2xl liquid-glass-strong hover:bg-white/20 text-white transition-all active:scale-95 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-xl font-bold tracking-tight text-white truncate">
                  {session.title}
                </h2>
                <p className="text-xs text-slate-300 truncate font-medium">
                  {(() => {
                    const parts: string[] = [];
                    if (session.mediaType === 'tv' && session.seasonNumber && session.episodeNumber) {
                      parts.push(
                        `S${session.seasonNumber} · E${session.episodeNumber}${
                          session.episodeTitle ? ` · ${session.episodeTitle}` : ''
                        }`
                      );
                    }
                    if (activeSource?.audioLanguage) {
                      parts.push(`${activeSource.audioLanguage} Audio`);
                    }
                    const qDisplay =
                      selectedHlsLevel !== -1
                        ? hlsLevels.find((l) => l.index === selectedHlsLevel)?.label
                        : selectedQualityOption !== 'auto'
                        ? selectedQualityOption.toUpperCase()
                        : activeSource?.quality;
                    if (qDisplay) parts.push(qDisplay);
                    if (activeSource?.seeders !== undefined) {
                      parts.push(`${activeSource.seeders} seeders`);
                    }
                    return parts.length > 0 ? parts.join(' · ') : session.subtitle || 'Cinema Stream';
                  })()}
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
                  className="h-10 px-3 rounded-xl liquid-glass-strong hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{videoFit === 'cover' ? 'Fill' : 'Fit'}</span>
                </button>
                {!isLive && (
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === 'sources' ? 'none' : 'sources')}
                    aria-label="Open stream sources"
                    className={`h-10 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 ${
                      openMenu === 'sources'
                        ? 'text-white shadow-lg'
                        : 'liquid-glass-strong hover:bg-white/20 text-white'
                    }`}
                    style={openMenu === 'sources' ? { backgroundColor: accent.hex } : undefined}
                  >
                    {sources.length === 0 && isResolvingStreams ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Finding...</span>
                      </>
                    ) : (
                      <>
                        <Server className="h-4 w-4" />
                        <span>Sources ({sources.length})</span>
                      </>
                    )}
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
              className={`h-10 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 ${
                isLocked
                  ? 'text-white shadow-lg'
                  : 'liquid-glass-strong hover:bg-white/20 text-white'
              }`}
              style={isLocked ? { backgroundColor: accent.hex } : undefined}
            >
              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="hidden sm:inline">{isLocked ? 'Unlock' : 'Lock'}</span>
            </button>
          </div>
        </div>

        {/* Center Hero Transport Controls */}
        {!isLocked && (
          <div className="flex items-center justify-center gap-7 sm:gap-12 px-4">
            {isLive ? (
              <button
                type="button"
                onClick={() => switchLiveChannel(-1)}
                aria-label="Previous live channel"
                className="h-14 w-14 sm:h-16 sm:w-16 flex flex-col items-center justify-center rounded-full liquid-glass-strong hover:bg-white/20 text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] transition-all active:scale-90"
              >
                <SkipBack className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular font-semibold mt-0.5">Prev</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => seekBy(-10)}
                aria-label="Rewind 10 seconds"
                className="h-14 w-14 sm:h-16 sm:w-16 flex flex-col items-center justify-center rounded-full liquid-glass-strong hover:bg-white/20 text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] transition-all active:scale-90"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular font-semibold mt-0.5">10s</span>
              </button>
            )}

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="h-[74px] w-[74px] sm:h-[84px] sm:w-[84px] flex items-center justify-center rounded-full border-2 border-white/30 text-white transition-all hover:scale-105 active:scale-92"
              style={{
                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.22) 0%, ${accent.hex} 62%, ${accent.hex} 100%)`,
                boxShadow: `0 0 42px rgba(${accent.glowRgb}, 0.55), inset 0 1px 1px rgba(255,255,255,0.45)`,
              }}
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 sm:h-9 sm:w-9 fill-current" />
              ) : (
                <Play className="h-8 w-8 sm:h-9 sm:w-9 fill-current ml-1" />
              )}
            </button>

            {isLive ? (
              <button
                type="button"
                onClick={() => switchLiveChannel(1)}
                aria-label="Next live channel"
                className="h-14 w-14 sm:h-16 sm:w-16 flex flex-col items-center justify-center rounded-full liquid-glass-strong hover:bg-white/20 text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] transition-all active:scale-90"
              >
                <SkipForward className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular font-semibold mt-0.5">Next</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="h-14 w-14 sm:h-16 sm:w-16 flex flex-col items-center justify-center rounded-full liquid-glass-strong hover:bg-white/20 text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] transition-all active:scale-90"
              >
                <RotateCw className="h-5 w-5" />
                <span className="text-[10px] font-mono-tabular font-semibold mt-0.5">10s</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom Scrubber & Sleek Single-Row Action Dock */}
        {!isLocked ? (
          <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 sm:px-7 pt-12 pb-5 space-y-3">
            {/* Seek Bar with Floating Scrub Tooltip */}
            {!isLive ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono-tabular font-semibold text-white w-14 text-right shrink-0">
                  {formatClock(displayTime)}
                </span>

                <div className="group relative flex-1 flex items-center h-7">
                  {seekPreviewTime !== null && (
                    <div
                      className="pointer-events-none absolute -top-9 -translate-x-1/2 px-2.5 py-1 rounded-lg liquid-glass-strong text-[11px] font-mono-tabular font-bold text-white shadow-xl whitespace-nowrap"
                      style={{
                        left: `${Math.min(92, Math.max(8, progressPct))}%`,
                      }}
                    >
                      {formatClock(seekPreviewTime)}
                    </div>
                  )}
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/15 overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-white/30 transition-[width] duration-150"
                      style={{ width: `${Math.min(100, bufferedPct)}%` }}
                    />
                  </div>
                  <div
                    className="absolute left-0 h-1.5 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: accent.hex,
                      width: `${Math.min(100, progressPct)}%`,
                      boxShadow: `0 0 12px rgba(${accent.glowRgb}, 0.7)`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={sliderMax}
                    step={0.5}
                    value={Math.min(displayTime, sliderMax)}
                    aria-label="Seek timeline"
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSeekPreviewTime(next);
                      setCurrentTime(next);
                    }}
                    onPointerUp={() => {
                      if (seekPreviewTime !== null) {
                        seekToSeconds(seekPreviewTime);
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    onTouchEnd={() => {
                      if (seekPreviewTime !== null) {
                        seekToSeconds(seekPreviewTime);
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    onKeyUp={() => {
                      if (seekPreviewTime !== null) {
                        seekToSeconds(seekPreviewTime);
                      }
                      setSeekPreviewTime(null);
                      wakeControls();
                    }}
                    className="cinema-range relative z-10 w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowRemainingTime((prev) => !prev)}
                  title="Toggle remaining / total duration"
                  className="text-xs font-mono-tabular text-slate-300 hover:text-white w-14 text-left shrink-0 transition-colors"
                >
                  {showRemainingTime && timelineDuration > displayTime
                    ? `-${formatClock(timelineDuration - displayTime)}`
                    : displayEndClock}
                </button>
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

            {/* Unified Single-Row Control Actions Dock */}
            <div className="flex items-center justify-between gap-2 relative">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] backdrop-blur-xl text-white transition-all active:scale-95"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4.5 w-4.5" />
                  ) : (
                    <Volume2 className="h-4.5 w-4.5" />
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
                  className="hidden md:block w-24 cursor-pointer"
                  style={{ accentColor: accent.hex }}
                />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full py-0.5">
                {!isLive && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'speed' ? 'none' : 'speed')
                    }
                    className={`h-10 px-3 rounded-xl border text-xs font-mono-tabular font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-xl transition-all active:scale-95 ${
                      openMenu === 'speed'
                        ? 'text-white border-transparent shadow-lg'
                        : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.12] text-white'
                    }`}
                    style={openMenu === 'speed' ? { backgroundColor: accent.hex } : undefined}
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
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-xl transition-all active:scale-95 ${
                      openMenu === 'language'
                        ? 'text-white border-transparent shadow-lg'
                        : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.12] text-white'
                    }`}
                    style={openMenu === 'language' ? { backgroundColor: accent.hex } : undefined}
                  >
                    <Languages className="h-4 w-4" />
                    <span className="max-w-[84px] truncate">{currentLanguageDisplay}</span>
                  </button>
                )}

                {subtitles.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'subtitles' ? 'none' : 'subtitles')
                    }
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-xl transition-all active:scale-95 ${
                      activeSubtitleId !== 'off'
                        ? 'bg-[#3B82F6] border-transparent text-white shadow-lg'
                        : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.12] text-white'
                    }`}
                  >
                    <Captions className="h-4 w-4" />
                    <span className="hidden sm:inline">Subtitles</span>
                  </button>
                )}

                {!isLive && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu(openMenu === 'sources' ? 'none' : 'sources')
                    }
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-xl transition-all active:scale-95 ${
                      openMenu === 'sources'
                        ? 'text-white border-transparent shadow-lg'
                        : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.12] text-white'
                    }`}
                    style={openMenu === 'sources' ? { backgroundColor: accent.hex } : undefined}
                  >
                    {sources.length === 0 && isResolvingStreams ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Finding...</span>
                      </>
                    ) : (
                      <>
                        <Server className="h-4 w-4" />
                        <span>Sources ({sources.length})</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === 'quality' ? 'none' : 'quality')
                  }
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-xl transition-all active:scale-95 ${
                    openMenu === 'quality'
                      ? 'text-white border-transparent shadow-lg'
                      : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.12] text-white'
                  }`}
                  style={openMenu === 'quality' ? { backgroundColor: accent.hex } : undefined}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>
                    {selectedHlsLevel !== -1
                      ? hlsLevels.find((l) => l.index === selectedHlsLevel)?.label || 'Quality'
                      : selectedQualityOption !== 'auto'
                      ? selectedQualityOption.toUpperCase()
                      : activeSource?.quality || 'Auto'}
                  </span>
                </button>

                {nativeAndroidBridge.isNativeAndroid() &&
                  activeSource?.url && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          videoRef.current?.pause();
                          void nativeAndroidBridge.openNativeExoPlayer({
                            url: activeSource.url,
                            title: session.title,
                            subtitle:
                              session.mediaType === 'tv' &&
                              session.seasonNumber &&
                              session.episodeNumber
                                ? `S${session.seasonNumber} E${session.episodeNumber}`
                                : activeSource.audioLanguage
                                ? `${activeSource.audioLanguage} Audio`
                                : activeSource.quality || 'Direct Stream',
                            isLive,
                            bufferMb: storageService.getPlayerBufferMb(),
                            fallbackUrls: isLive
                              ? liveFeedsList
                                  .filter((f) => f.streamUrl !== liveFeedsList[activeLiveFeedIdx]?.streamUrl)
                                  .map((f) => f.streamUrl)
                              : sources
                                  .filter(
                                    (s) =>
                                      s.id !== activeSource.id &&
                                      (s.format === 'hls' || s.format === 'mp4')
                                  )
                                  .slice(0, 5)
                                  .map((s) => s.url),
                          });
                        }}
                        aria-label="Open in Native Android ExoPlayer"
                        title="Open in Native Android ExoPlayer"
                        className="h-10 px-2.5 rounded-xl bg-[#E50914]/85 hover:bg-[#E50914] text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all active:scale-95"
                      >
                        <Smartphone className="h-4 w-4" />
                        <span className="hidden sm:inline">ExoPlayer</span>
                      </button>

                      {!isLive && activeSource.format === 'mp4' && (
                        <button
                          type="button"
                          onClick={() =>
                            void nativeAndroidBridge.downloadWithAndroidManager({
                              url: activeSource.url,
                              fileName: `${session.title.replace(/[^a-zA-Z0-9._-]+/g, '_')}.mp4`,
                              title: session.title,
                            })
                          }
                          aria-label="Download with Android DownloadManager"
                          title="Download with Android DownloadManager"
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-white shrink-0 transition-all active:scale-95"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void nativeAndroidBridge.enterPictureInPicture()}
                        aria-label="Picture in Picture"
                        title="Picture in Picture"
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-white shrink-0 transition-all active:scale-95"
                      >
                        <PictureInPicture2 className="h-4 w-4" />
                      </button>
                    </>
                  )}

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-white shrink-0 backdrop-blur-xl transition-all active:scale-95"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Bounded Frosted Popover Menus */}
              {openMenu === 'language' && (
                <div className="player-interactive absolute right-0 bottom-12 w-72 max-w-[calc(100vw-2rem)] rounded-2xl liquid-glass-strong p-2 space-y-1 shadow-2xl z-40 max-h-80 overflow-y-auto touch-auto">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-300 border-b border-white/10">
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
                <div className="player-interactive absolute right-0 bottom-12 w-44 max-w-[calc(100vw-2rem)] rounded-2xl liquid-glass-strong p-2 space-y-1 shadow-2xl z-40 touch-auto">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-300 border-b border-white/10">
                    Playback Speed
                  </p>
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changeSpeed(rate)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono-tabular flex items-center justify-between transition-colors ${
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
                      <span>
                        {rate}x {rate === 1 ? '(Normal)' : ''}
                      </span>
                      {playbackRate === rate && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              )}

              {openMenu === 'subtitles' && (
                <div className="player-interactive absolute right-0 bottom-12 w-60 max-w-[calc(100vw-2rem)] rounded-2xl liquid-glass-strong p-2 space-y-1 max-h-72 overflow-y-auto shadow-2xl z-40 touch-auto">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-300 border-b border-white/10">
                    Subtitles
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubtitleId('off');
                      setOpenMenu('none');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
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
                    <span>Off</span>
                    {activeSubtitleId === 'off' && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                  {subtitles.map((sub, idx) => (
                    <button
                      key={`${sub.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setActiveSubtitleId(sub.id);
                        setOpenMenu('none');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
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
                      <span className="truncate">{sub.label}</span>
                      {activeSubtitleId === sub.id && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {openMenu === 'quality' && (
                <div className="player-interactive absolute right-0 bottom-12 w-72 max-w-[calc(100vw-2rem)] rounded-2xl liquid-glass-strong p-2 space-y-1 max-h-80 overflow-y-auto touch-auto shadow-2xl z-40">
                  <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Video Quality
                    </span>
                    {hlsLevels.length > 0 && (
                      <span className="text-[11px] text-emerald-400 font-mono-tabular">Adaptive</span>
                    )}
                  </div>

                  {hlsLevels.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          selectQualityLevel(-1);
                          setSelectedQualityOption('auto');
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                          selectedHlsLevel === -1
                            ? 'text-white font-semibold shadow-md'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                        style={selectedHlsLevel === -1 ? { backgroundColor: accent.hex } : undefined}
                      >
                        <span>Auto (Adaptive)</span>
                        {selectedHlsLevel === -1 && <Check className="h-4 w-4 text-white" />}
                      </button>
                      {hlsLevels.map((lvl) => {
                        const isActive = selectedHlsLevel === lvl.index;
                        return (
                          <button
                            key={lvl.index}
                            type="button"
                            onClick={() => {
                              selectQualityLevel(lvl.index);
                              setSelectedQualityOption(lvl.label);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between font-mono-tabular transition-colors ${
                              isActive
                                ? 'text-white font-semibold shadow-md'
                                : 'text-slate-200 hover:bg-white/10'
                            }`}
                            style={isActive ? { backgroundColor: accent.hex } : undefined}
                          >
                            <span>{lvl.label}</span>
                            {isActive && <Check className="h-4 w-4 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {QUALITY_PRESETS.map((q) => {
                        const isActive = selectedQualityOption === q.id;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => handleSelectQuality(q.id)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                              isActive
                                ? 'text-white font-semibold shadow-md'
                                : 'text-slate-200 hover:bg-white/10'
                            }`}
                            style={isActive ? { backgroundColor: accent.hex } : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <span>{q.label}</span>
                              <span className="text-[11px] text-slate-300 opacity-80">
                                {q.badge}
                              </span>
                            </div>
                            {isActive && <Check className="h-4 w-4 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pb-7 flex justify-center">
            <button
              type="button"
              onClick={() => setIsLocked(false)}
              className="min-h-[44px] px-5 rounded-full liquid-glass-strong border border-white/25 text-xs font-semibold text-white inline-flex items-center gap-2 shadow-2xl active:scale-95 transition-transform"
            >
              <Unlock className="h-4 w-4" />
              <span>Screen Locked · Tap to Unlock</span>
            </button>
          </div>
        )}
      </div>
    </>
  )}

  {/* In-Player Slide-Over Sources Drawer (available across video, embed, and loading states) */}
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
              {isResolvingStreams
                ? `Searching streams · ${sources.length} ready`
                : `${filteredDrawerSources.length} of ${sources.length} streams`}
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

      {/* Drawer Filters: Type, Language & Quality */}
      {sources.length > 1 && (
        <div className="px-3 py-2.5 border-b border-white/10 bg-black/30 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Filter className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            {(
              [
                { id: 'all', label: 'All Streams', show: true },
                { id: 'direct', label: 'Direct Stream', show: sources.some((s) => getSourceFlags(s).isDirectInstant) },
                { id: 'p2p', label: 'P2P Torrent', show: sources.some((s) => getSourceFlags(s).isP2P) },
              ] as const
            )
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDrawerTypeFilter(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 border transition-colors ${
                    drawerTypeFilter === t.id
                      ? 'bg-white text-slate-900 border-white shadow-sm'
                      : 'bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {drawerLanguages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setDrawerLanguageFilter('All')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 border transition-colors ${
                    drawerLanguageFilter === 'All'
                      ? 'text-white border-transparent'
                      : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                  style={drawerLanguageFilter === 'All' ? { backgroundColor: accent.hex } : undefined}
                >
                  All Audio
                </button>
                {drawerLanguages.map(({ lang }) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setDrawerLanguageFilter(lang)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 border transition-colors ${
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
        {sources.length === 0 && isResolvingStreams ? (
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300 mx-auto" />
            <p className="text-xs text-slate-300">
              Searching live video streams...
            </p>
          </div>
        ) : filteredDrawerSources.length === 0 ? (
          <div className="p-5 rounded-2xl bg-black/40 border border-white/10 text-center space-y-3">
            <p className="text-xs text-slate-300">No streams match the selected filters.</p>
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
                  const curPos = getAbsolutePlaybackPosition();
                  if (curPos > 3) resumePositionRef.current = curPos;
                  userSelectedSourceRef.current = true;
                  p2pBypassForSourceRef.current = null;
                  qualityBaseSourceRef.current = null;
                  pendingQualityFallbackRef.current = null;
                  setSelectedQualityOption('auto');
                  setStreamError(null);
                  setIsBuffering(true);
                  setActiveSource(prepareSourceWithResume(src, curPos));
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
                  <p className="font-display text-xs sm:text-sm font-semibold text-white truncate">
                    {src.audioLanguage ? `${src.audioLanguage} Audio` : 'Original Audio'} · {src.quality || 'HD'}{src.seeders !== undefined ? ` · ${src.seeders} seeders` : ''}
                  </p>
                  {isActive && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  )}
                </div>

                <p className="text-[11px] text-slate-300 truncate">{cleanStreamTitle(src.label)}</p>

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
</div>
  );
};
