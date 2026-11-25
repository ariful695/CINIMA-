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
} from 'lucide-react';
import { bengaliSerialService } from '../services/bengaliSerialService';
import {
  resolveSubtitleTrackUrl,
  streamProviderService,
} from '../services/streamProviderService';
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
  fileSize?: number;
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

    // 3. Direct HTTPS or same-origin proxy protocol (prefer instant CDN streams over slower P2P swarm startup)
    if (url.includes('/api/torrent/stream')) {
      score -= 1800;
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

const P2PPrebufferHUD: React.FC<{
  status: P2PPrebufferStatus | null;
  activeSource: StreamSource;
  accentHex: string;
  onCancel: () => void;
  onSwitchServer?: () => void;
  onContinueAnyway: () => void;
  hasAlternativeSources: boolean;
}> = ({
  status,
  activeSource,
  accentHex,
  onCancel,
  onSwitchServer,
  onContinueAnyway,
  hasAlternativeSources,
}) => {
  const [displayPct, setDisplayPct] = useState(0);
  const targetPct = status?.progressPct ?? 0;
  const currentPctRef = useRef(0);

  useEffect(() => {
    let animId: number;
    const update = () => {
      const diff = targetPct - currentPctRef.current;
      if (Math.abs(diff) > 0.1) {
        currentPctRef.current += diff * 0.18;
        const rounded = Math.round(Math.min(100, Math.max(0, currentPctRef.current)));
        setDisplayPct((prev) => (prev !== rounded ? rounded : prev));
        animId = requestAnimationFrame(update);
      } else {
        currentPctRef.current = targetPct;
        const rounded = Math.round(targetPct);
        setDisplayPct((prev) => (prev !== rounded ? rounded : prev));
      }
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [targetPct]);

  const targetBytes = status?.targetBytes || 1048576;
  const prebufferedBytes = status?.prebufferedBytes || 0;
  const remainingBytes = Math.max(0, targetBytes - prebufferedBytes);
  const bytesPerSec = Math.max(1, (status?.speedKbps || 0) * 1024);
  const etaSec =
    status?.speedKbps && status.speedKbps > 10 ? Math.ceil(remainingBytes / bytesPerSec) : null;

  const mbPre = (prebufferedBytes / (1024 * 1024)).toFixed(1);
  const mbTarget = (targetBytes / (1024 * 1024)).toFixed(1);
  const speedStr =
    status && status.speedKbps >= 1024
      ? `${(status.speedKbps / 1024).toFixed(1)} MB/s`
      : `${status?.speedKbps || 0} KB/s`;

  const clampedPct = Math.min(100, Math.max(0, displayPct));
  const ringCircumference = 251.2;
  const strokeDashoffset = ringCircumference * (1 - clampedPct / 100);
  const stageLabel = !status?.ready
    ? 'Connecting to P2P swarm'
    : !status.headReady
    ? 'Fetching stream header atom'
    : 'Pre-buffering initial playback window';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="player-interactive absolute inset-0 z-[25] flex items-center justify-center p-4 transition-opacity duration-150"
      style={{ backgroundColor: 'rgba(5, 7, 12, 0.78)' }}
    >
      <div
        className="relative max-w-md w-full rounded-3xl border border-white/15 backdrop-blur-2xl p-5 sm:p-6 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden"
        style={{ backgroundColor: 'rgba(11, 15, 25, 0.86)' }}
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: accentHex }}
        />

        {/* Radial Progress Ring & Source Header */}
        <div className="relative flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
              <defs>
                <linearGradient id="p2pHudRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={accentHex} />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="6"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="url(#p2pHudRingGradient)"
                strokeWidth="6"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold font-mono-tabular text-white leading-none">
                {Math.round(clampedPct)}%
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-400 mt-1">
                {mbPre} MB
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.08] text-sky-300 border border-sky-400/25">
                P2P Stream
              </span>
              <span className="text-xs text-slate-300 font-mono-tabular">
                {activeSource.quality || 'Auto'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white truncate">
              {activeSource.providerName}
            </h3>
            <p className="text-xs text-slate-300 truncate">
              {status?.fileName || activeSource.label}
            </p>
            <p className="text-xs text-slate-400 truncate">{stageLabel}</p>
          </div>
        </div>

        {/* Live Speed & ETA Telemetry Bar */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-xs font-mono-tabular">
          <div className="flex items-center gap-2 text-slate-200">
            <Gauge className="h-4 w-4 text-sky-400 shrink-0" />
            <span className="font-semibold">{speedStr}</span>
          </div>
          <div className="text-slate-400">
            {mbPre} / {mbTarget} MB
          </div>
          <div className="font-semibold text-emerald-300">
            {etaSec !== null ? `~${etaSec}s left` : 'Syncing...'}
          </div>
        </div>

        {/* Swarm Metrics */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-1">
            <div className="text-sm font-bold font-mono-tabular text-white">
              {status?.peers ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Peers</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-1">
            <div className="text-sm font-bold font-mono-tabular text-emerald-400">
              {status?.seeders ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Seeds</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-1">
            <div
              className={`text-sm font-bold ${
                status?.headReady ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {status?.headReady ? 'Ready' : 'Wait'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Header</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-1">
            <div
              className={`text-sm font-bold ${
                status?.tailReady ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              {status?.tailReady ? 'Ready' : 'Wait'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Index</div>
          </div>
        </div>

        {/* Action Controls (44px+ Touch Targets) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] text-xs font-semibold text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            {hasAlternativeSources && onSwitchServer && (
              <button
                type="button"
                onClick={onSwitchServer}
                className="min-h-[44px] flex-1 sm:flex-initial px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Server className="h-4 w-4" />
                <span>Switch Server</span>
              </button>
            )}
            <button
              type="button"
              onClick={onContinueAnyway}
              className="min-h-[44px] flex-1 sm:flex-initial px-5 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform"
              style={{ backgroundColor: accentHex }}
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Play Now</span>
            </button>
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
  const userLockedLanguageRef = useRef<boolean>(false);
  const userSelectedSourceRef = useRef<boolean>(false);
  const hasPlayedFramesRef = useRef<boolean>(false);
  const p2pBypassForSourceRef = useRef<string | null>(null);
  const mountGenRef = useRef<number>(0);
  const resumePositionRef = useRef<number>(
    session.initialTime && session.initialTime > 3 ? session.initialTime : 0
  );
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
  const [isResolvingStreams, setIsResolvingStreams] = useState(session.mediaType !== 'live');
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveSwitchToast, setLiveSwitchToast] = useState<string | null>(null);
  const [activeLiveFeedIdx, setActiveLiveFeedIdx] = useState(0);
  const failedLiveUrlsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
  }, [playbackRate, isMuted, volume]);

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
    setProbedDurationSeconds(initialDur);
    if (initialDur > 0) setDuration(initialDur);

    if (activeSource?.url && !isLive && activeSource.format !== 'hls' && !activeSource.url.includes('remux=1')) {
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
              setDuration(parsed);
            }
          }
        })
        .catch(() => {});
      return () => {
        probeActive = false;
      };
    }
  }, [activeSource?.id, activeSource?.url, activeSource?.format, isLive, session.runtimeMinutes]);

  const effectiveDuration =
    Number.isFinite(duration) && duration > 0
      ? duration
      : probedDurationSeconds > 0
      ? probedDurationSeconds
      : session.runtimeMinutes && session.runtimeMinutes > 0
      ? session.runtimeMinutes * 60
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
    resumePositionRef.current =
      session.initialTime && session.initialTime > 3 ? session.initialTime : 0;
    setCurrentTime(resumePositionRef.current);
    setActiveLiveFeedIdx(0);
    failedLiveUrlsRef.current.clear();
    setLiveSwitchToast(null);
  }, [sessionKey, session.initialTime]);

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
    userLockedLanguageRef.current = false;
    userSelectedSourceRef.current = Boolean(session.preferredSourceId);
    hasPlayedFramesRef.current = false;
    p2pBypassForSourceRef.current = null;
    setIsResolvingStreams(!isLive);
    setShowUnmutePrompt(false);
    setStreamError(null);
    setIsBuffering(true);
    setDrawerTypeFilter('all');
    setDrawerProviderFilter('All');
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

      const currentActive = activeSourceRef.current;
      const bestNow = selectBestPlayableSource(
        allowedSources,
        failedSourceIdsRef.current,
        session.preferredSourceId,
        isDone
      );

      if (!currentActive || (isBengaliSession && currentActive.format === 'youtube')) {
        if (bestNow) {
          setActiveSource(bestNow);
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
      } else if (!userSelectedSourceRef.current && !hasPlayedFramesRef.current && bestNow) {
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
          setActiveSource(bestNow);
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
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError')) {
        try {
          video.muted = true;
          isMutedRef.current = true;
          setIsMuted(true);
          setShowUnmutePrompt(true);
          const mutedPromise = video.play();
          playPromiseRef.current = mutedPromise;
          await mutedPromise;
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
      const cur = seekOffsetSecondsRef.current + (video.currentTime || 0);
      const dur = effectiveDuration > 0 ? effectiveDuration : video.duration;
      persistProgress(cur, dur);
    },
    [effectiveDuration, persistProgress]
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
        const currentCh = liveFeedsList[activeLiveFeedIdx] || session.liveChannel;
        markChannelHealth(currentCh.id, false);
        failedLiveUrlsRef.current.add(currentCh.streamUrl);

        if (liveFeedsList.length > 1) {
          const nextIdx = liveFeedsList.findIndex(
            (feed, idx) => idx !== activeLiveFeedIdx && !failedLiveUrlsRef.current.has(feed.streamUrl)
          );
          if (nextIdx >= 0) {
            setLiveSwitchToast(
              `Feed ${activeLiveFeedIdx + 1} unavailable · Switching to backup feed ${nextIdx + 1}...`
            );
            window.setTimeout(() => setLiveSwitchToast(null), 2400);
            setActiveLiveFeedIdx(nextIdx);
            return;
          }
        }
      }
      if (source && !isLive) {
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
            (!userLockedLanguageRef.current &&
            (!source.audioLanguage || source.audioLanguage === 'Original')
              ? selectMostCompatibleSource(pool, failedSourceIdsRef.current, undefined, true) ||
                selectMostCompatibleSource(pool, failedSourceIdsRef.current, undefined, false)
              : null);
          if (anyLangFallback && anyLangFallback.id !== source.id) {
            setActiveSource(anyLangFallback);
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
    [isLive, isBengaliSession, session.liveChannel, liveFeedsList, activeLiveFeedIdx, markChannelHealth]
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
    const prebufferMb = Number(parsedUrl.searchParams.get('prebufferMb') || 5);

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
      targetBytes: Math.max(2, Math.min(30, prebufferMb)) * 1024 * 1024,
      headReady: false,
      tailReady: false,
      progressPct: 0,
      readyToPlay: false,
    });

    const controller = new AbortController();
    const startTimeMs = Date.now();
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
        const elapsedMs = Date.now() - startTimeMs;
        const hasDirectMirrors = sourcesRef.current.some(
          (s) => !s.url.includes('/api/torrent/stream') && !failedSourceIdsRef.current.has(s.id)
        );
        if (
          data.readyToPlay ||
          (data.headReady && (data.prebufferedBytes >= 1024 * 1024 || elapsedMs >= 3500))
        ) {
          stopTimers();
          setP2pAttachUrl(activeSource.url);
          return;
        }
        // Fail fast if swarm has zero reachable peers and alternative direct servers exist
        if (elapsedMs >= 4500 && data.peers === 0 && hasDirectMirrors) {
          stopTimers();
          controller.abort();
          handlePlaybackFailure(
            activeSource,
            'No P2P peers found. Switching to instant direct server.'
          );
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
        'P2P torrent swarm has too few peers or timed out while pre-buffering. Click Play Now or switch to a direct server.'
      );
    }, 15000);

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
        const elapsedMs = Date.now() - startTimeMs;
        if (
          data.readyToPlay ||
          (data.headReady && (data.prebufferedBytes >= 1024 * 1024 || elapsedMs >= 3500))
        ) {
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

    const hasServerSeekParam = /[?&]ss=\d+/i.test(activeSource.url);
    const startTime =
      !hasServerSeekParam && resumePositionRef.current > 3 ? resumePositionRef.current : 0;

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
      if (
        !isLive &&
        startTime > 0 &&
        (video.duration > startTime + 2 || effectiveDuration > startTime + 2)
      ) {
        video.currentTime = startTime;
      }
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
    const isRemuxSrc = activeSource.url.includes('remux=1');
    const stallBudgetMs = hasAltLiveFeeds
      ? 1500
      : hasAltVodMirrors
      ? isRemuxSrc
        ? 11500
        : 7500
      : isRemuxSrc
      ? 16000
      : 11000;

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
    }, stallBudgetMs);

    let retryCount = 0;
    let triedNativeFallback = false;

    const onDirectVideoError = () => {
      if (cancelled || hlsActiveRef.current) return;
      if (!video.getAttribute('src')) return;
      clearStallTimer();
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
        startPosition: !isLive && startTime > 3 ? startTime : -1,
        backBufferLength: 60,
        maxBufferSize: bufferMb * 1024 * 1024,
        maxBufferLength: hlsMaxLen,
        maxMaxBufferLength: hlsMaxMaxLen,
        manifestLoadingTimeOut: isLive && liveFeedsList.length > 1 ? 3500 : 7500,
        fragLoadingTimeOut: isLive && liveFeedsList.length > 1 ? 4500 : 10000,
        manifestLoadingMaxRetry: isLive && liveFeedsList.length > 1 ? 0 : 1,
        levelLoadingMaxRetry: isLive && liveFeedsList.length > 1 ? 0 : 1,
        fragLoadingMaxRetry: isLive && liveFeedsList.length > 1 ? 1 : 2,
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
          setDuration(totalDur);
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
  }, [activeSource, p2pAttachUrl, isActiveP2PTorrent, isLive, liveFeedsList.length, safePlay, reloadTick, handlePlaybackFailure]);

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

  // Auto-save playback progress every 5 seconds (batched writes)
  useEffect(() => {
    if (isLive) return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const cur = seekOffsetSecondsRef.current + (video?.currentTime || 0);
      const dur = effectiveDuration > 0 ? effectiveDuration : (video?.duration || 0);
      if (video && !video.paused && dur > 0) {
        persistProgress(cur, dur);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isLive, effectiveDuration, persistProgress]);

  // Ongoing playback stall detector: auto-switch VOD server after 4s or Live feed after 1.5s
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

    const timeoutMs = isLive ? 1500 : 25000;
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
      void safePlay(video);
    } else {
      void safePause(video);
    }
    wakeControls();
  }, [safePlay, safePause, wakeControls]);

  const seekToSeconds = useCallback(
    (rawTarget: number) => {
      const video = videoRef.current;
      if (!video || isLive) return;
      const maxDuration = effectiveDuration > 0 ? effectiveDuration : Infinity;
      const target = Math.min(maxDuration, Math.max(0, rawTarget));
      resumePositionRef.current = target;

      if (activeSource?.url.includes('remux=1')) {
        const baseUrl = activeSource.url.replace(/[?&]ss=\d+/gi, '').replace(/\?&/, '?');
        const sep = baseUrl.includes('?') ? '&' : '?';
        const seekUrl = `${baseUrl}${sep}ss=${Math.floor(target)}`;
        seekOffsetSecondsRef.current = Math.floor(target);
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
      const current = seekOffsetSecondsRef.current + (videoRef.current?.currentTime || currentTime);
      seekToSeconds(current + delta);
    },
    [currentTime, seekToSeconds]
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
    const dur = effectiveDuration > 0 ? effectiveDuration : (video?.duration || 0);
    if (video && dur > 0) {
      persistProgress(seekOffsetSecondsRef.current + (video.currentTime || 0), dur);
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    void nativeAndroidBridge.setPlayerFullscreen(false, false);
    closePlayback();
  }, [closePlayback, effectiveDuration, persistProgress]);

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
  const progressPct = effectiveDuration > 0 ? (displayTime / effectiveDuration) * 100 : 0;
  const bufferedPct = effectiveDuration > 0 ? (bufferedEnd / effectiveDuration) * 100 : 0;

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
    const curAbsTime =
      seekOffsetSecondsRef.current + (videoRef.current?.currentTime || 0) ||
      resumePositionRef.current;
    if (curAbsTime > 0) {
      resumePositionRef.current = curAbsTime;
    }

    if (opt.type === 'hls-track' && typeof opt.trackIndex === 'number') {
      selectAudioTrack(opt.trackIndex);
    } else if (opt.type === 'remux-lang' && opt.targetLang && activeSource) {
      let nextUrl = activeSource.url.includes('lang=')
        ? activeSource.url.replace(/([?&]lang=)[^&]*/i, `$1${encodeURIComponent(opt.targetLang)}`)
        : `${activeSource.url}&lang=${encodeURIComponent(opt.targetLang)}`;
      if (nextUrl.includes('/api/stream-proxy') && curAbsTime > 4) {
        nextUrl = nextUrl.includes('ss=')
          ? nextUrl.replace(/([?&]ss=)[^&]*/i, `$1${Math.floor(curAbsTime)}`)
          : `${nextUrl}&ss=${Math.floor(curAbsTime)}`;
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
        let targetSrc = best;
        if (targetSrc.url.includes('remux=1') && curAbsTime > 4) {
          const base = targetSrc.url.replace(/[?&]ss=\d+/gi, '').replace(/\?&/, '?');
          const sep = base.includes('?') ? '&' : '?';
          targetSrc = { ...targetSrc, url: `${base}${sep}ss=${Math.floor(curAbsTime)}` };
        }
        setActiveSource(targetSrc);
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
              hasPlayedFramesRef.current = true;
              setIsBuffering(false);
              setIsPlaying(true);
              wakeControls();
              if (isLive && session.liveChannel) {
                markChannelHealth(session.liveChannel.id, true);
              }
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              const rawTime = video.currentTime || 0;
              const computedCurrent = seekOffsetSecondsRef.current + rawTime;
              resumePositionRef.current = computedCurrent;

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
              }
            }}
            onDurationChange={() => {
              const video = videoRef.current;
              if (video && Number.isFinite(video.duration) && video.duration > 0) {
                if (!activeSource?.url.includes('remux=1') || duration === 0) {
                  setDuration(video.duration);
                }
              }
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

      {/* P2P Sequential Pre-Buffering 60fps HUD */}
      {isActiveP2PTorrent && p2pAttachUrl !== activeSource?.url && !streamError && activeSource && (
        <P2PPrebufferHUD
          status={p2pStatus}
          activeSource={activeSource}
          accentHex={accent.hex}
          onCancel={handleClose}
          onSwitchServer={sources.length > 1 ? () => setOpenMenu('sources') : undefined}
          onContinueAnyway={() => {
            p2pBypassForSourceRef.current = activeSource.id;
            setP2pBypassTick((t) => t + 1);
          }}
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
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-black/80 border border-white/20 text-xs font-semibold text-amber-300 shadow-xl">
          {liveSwitchToast}
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
                {!isLive && (
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
                    max={effectiveDuration || 100}
                    step={0.5}
                    value={displayTime}
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

                <span className="text-xs font-mono-tabular text-slate-400 w-14">
                  {formatClock(effectiveDuration)}
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

                {!isLive && (
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
                                : activeSource.providerName,
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
                        className="min-h-[40px] px-2.5 rounded-lg bg-[#E50914]/85 hover:bg-[#E50914] text-xs font-semibold text-white inline-flex items-center gap-1.5"
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
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void nativeAndroidBridge.enterPictureInPicture()}
                        aria-label="Picture in Picture"
                        title="Picture in Picture"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white"
                      >
                        <PictureInPicture2 className="h-4 w-4" />
                      </button>
                    </>
                  )}

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
                            const curPos =
                              seekOffsetSecondsRef.current + (videoRef.current?.currentTime || 0) ||
                              resumePositionRef.current;
                            if (curPos > 0) resumePositionRef.current = curPos;
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
                ? `Searching providers · ${sources.length} ready`
                : `${filteredDrawerSources.length} of ${sources.length} servers`}
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
        {sources.length === 0 && isResolvingStreams ? (
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300 mx-auto" />
            <p className="text-xs text-slate-300">
              Searching PlavioHD, Nuvio & Stremio providers...
            </p>
          </div>
        ) : filteredDrawerSources.length === 0 ? (
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
                  const curPos =
                    seekOffsetSecondsRef.current + (videoRef.current?.currentTime || 0) ||
                    resumePositionRef.current;
                  if (curPos > 0) resumePositionRef.current = curPos;
                  userSelectedSourceRef.current = true;
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
</div>
  );
};
