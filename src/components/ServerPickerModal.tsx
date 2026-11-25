import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Film,
  Filter,
  Languages,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Tv,
  Volume2,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { bengaliSerialService } from '../services/bengaliSerialService';
import { streamProviderService } from '../services/streamProviderService';
import { useAppState } from '../state/AppContext';
import { StreamSource, SubtitleTrack, THEME_ACCENTS } from '../types/media';
import { MediaPosterImage } from './MediaPosterImage';

import {
  extractLanguageTags,
  getAvailableLanguages,
  getSourceFlags,
  matchesQualityFilter,
  matchesSourceTypeFilter,
  QualityFilter,
  SortMode,
  SourceTypeFilter,
} from '../utils/streamFilters';

function getQualityRank(quality?: string): number {
  const q = (quality || '').toUpperCase();
  if (q.includes('4K') || q.includes('2160')) return 4;
  if (q.includes('1080') || q.includes('FHD')) return 3;
  if (q.includes('720')) return 2;
  if (q.includes('480') || q.includes('360')) return 1;
  return 2;
}

function scoreServerChoice(source: StreamSource, targetTitle: string, preferredLanguage?: string): number {
  const isP2P = source.url.includes('/api/torrent/stream');
  const isRemux = source.url.includes('remux=1');
  const isHls = source.format === 'hls' || source.url.includes('.m3u8');
  let score = 0;

  if (source.isVerified) score += 500;
  if (source.isDirectPlayable !== false && !isP2P) score += 300;
  if (isHls) score += 200;

  if (isRemux) score -= 220;
  if (source.isDirectPlayable === false) score -= 350;
  if (isP2P) score -= 120;

  if (preferredLanguage && preferredLanguage !== 'All') {
    const tags = extractLanguageTags(source.audioLanguage);
    if (tags.includes(preferredLanguage)) {
      score += 450;
    } else {
      score -= 200;
    }
  }

  const cleanTargetWords = targetTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const labelLower = (source.label || '').toLowerCase();
  if (cleanTargetWords.length > 0 && cleanTargetWords.every((w) => labelLower.includes(w))) {
    score += 120;
  }

  score += getQualityRank(source.quality) * 40;

  if (source.seeders && source.seeders > 0) {
    score += Math.min(60, Math.round(source.seeders / 8));
  }

  return score;
}

export const ServerPickerModal: React.FC = () => {
  const {
    serverPickerTarget,
    closeServerPicker,
    startPlayback,
    themeColor,
  } = useAppState();

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchingMore, setIsSearchingMore] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Server Filtering Controls
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recommended');
  const [serverQuery, setServerQuery] = useState<string>('');

  const accent = THEME_ACCENTS[themeColor || 'red'];

  const resetFilters = () => {
    setVerifiedOnly(false);
    setSelectedLanguage('All');
    setSourceTypeFilter('all');
    setQualityFilter('all');
    setSortBy('recommended');
    setServerQuery('');
  };

  useEffect(() => {
    resetFilters();
    setResolveError(null);
    if (!serverPickerTarget) {
      setSources([]);
      setSubtitles([]);
      setLoading(false);
      setIsSearchingMore(false);
      return;
    }

    let active = true;
    setSources([]);
    setSubtitles([]);
    setLoading(true);
    setIsSearchingMore(true);

    if (retryTick > 0) {
      streamProviderService.clearCache();
    }

    const query = {
      tmdbId: serverPickerTarget.mediaId,
      imdbId: serverPickerTarget.imdbId,
      dejavuId: serverPickerTarget.dejavuId,
      archiveIdentifier: serverPickerTarget.archiveIdentifier,
      mediaType: serverPickerTarget.mediaType,
      title: serverPickerTarget.title,
      genreIds: serverPickerTarget.genreIds,
      originalLanguage: serverPickerTarget.originalLanguage,
      releaseYear: serverPickerTarget.releaseYear,
      seasonNumber: serverPickerTarget.seasonNumber,
      episodeNumber: serverPickerTarget.episodeNumber,
      episodeTitle: serverPickerTarget.episodeTitle,
      bengaliSerialSlug: serverPickerTarget.bengaliSerialSlug,
      preferredVideoId: serverPickerTarget.preferredVideoId,
    };

    const unsubscribe = streamProviderService.subscribeAndResolveStreams(
      query,
      (partial, isDone) => {
        if (!active) return;
        const partialSources = partial.sources || [];
        if (partialSources.length > 0) {
          setSources(partialSources);
          setSubtitles(partial.subtitles || []);
          setVerifiedOnly(false);
          setLoading(false);
        } else if (isDone) {
          setSources([]);
          setSubtitles(partial.subtitles || []);
        }
        if (isDone) {
          setLoading(false);
          setIsSearchingMore(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [serverPickerTarget, retryTick]);

  const isBengaliTarget = useMemo(() => {
    if (!serverPickerTarget) return false;
    return (
      bengaliSerialService.isBengaliSerialOrCartoon({
        title: serverPickerTarget.title,
        originalLanguage: serverPickerTarget.originalLanguage,
        bengaliSerialSlug: serverPickerTarget.bengaliSerialSlug,
      }) || (serverPickerTarget.mediaId >= 895000 && serverPickerTarget.mediaId <= 899999)
    );
  }, [serverPickerTarget]);

  const fullMovieSources = useMemo(
    () =>
      sources.filter((s) =>
        isBengaliTarget
          ? s.format !== 'youtube'
          : s.format !== 'youtube' || Boolean(s.isFullEpisode)
      ),
    [sources, isBengaliTarget]
  );
  const trailerSources = useMemo(
    () =>
      isBengaliTarget
        ? []
        : sources.filter((s) => s.format === 'youtube' && !s.isFullEpisode),
    [sources, isBengaliTarget]
  );

  const verifiedDirectCount = useMemo(
    () =>
      fullMovieSources.filter(
        (s) =>
          s.isVerified === true &&
          s.isDirectPlayable !== false &&
          !s.url.includes('/api/torrent/stream')
      ).length,
    [fullMovieSources]
  );

  const availableLanguages = useMemo(
    () => getAvailableLanguages(fullMovieSources),
    [fullMovieSources]
  );

  const hasNuvio = useMemo(
    () => fullMovieSources.some((s) => getSourceFlags(s).isNuvio),
    [fullMovieSources]
  );
  const hasStremio = useMemo(
    () => fullMovieSources.some((s) => getSourceFlags(s).isStremio),
    [fullMovieSources]
  );
  const hasCloudStream = useMemo(
    () => fullMovieSources.some((s) => getSourceFlags(s).isCS),
    [fullMovieSources]
  );
  const hasP2P = useMemo(
    () => fullMovieSources.some((s) => getSourceFlags(s).isP2P),
    [fullMovieSources]
  );
  const hasDirect = useMemo(
    () => fullMovieSources.some((s) => getSourceFlags(s).isDirectInstant),
    [fullMovieSources]
  );

  const filteredFullSources = useMemo(() => {
    const targetTitle = serverPickerTarget?.title || '';
    const q = serverQuery.trim().toLowerCase();

    return fullMovieSources
      .filter((s) => {
        const { isP2P } = getSourceFlags(s);

        if (verifiedOnly) {
          if (!s.isVerified || s.isDirectPlayable === false || isP2P) {
            return false;
          }
        }

        if (selectedLanguage !== 'All') {
          const tags = extractLanguageTags(s.audioLanguage);
          if (!tags.includes(selectedLanguage)) return false;
        }

        if (!matchesSourceTypeFilter(s, sourceTypeFilter)) {
          return false;
        }

        if (!matchesQualityFilter(s, qualityFilter)) {
          return false;
        }

        if (q) {
          const hay = `${s.label} ${s.audioLanguage || ''} ${s.quality}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'quality') {
          const qDiff = getQualityRank(b.quality) - getQualityRank(a.quality);
          if (qDiff !== 0) return qDiff;
          return scoreServerChoice(b, targetTitle, selectedLanguage) - scoreServerChoice(a, targetTitle, selectedLanguage);
        }
        if (sortBy === 'seeders') {
          const sDiff = (b.seeders || 0) - (a.seeders || 0);
          if (sDiff !== 0) return sDiff;
          return scoreServerChoice(b, targetTitle, selectedLanguage) - scoreServerChoice(a, targetTitle, selectedLanguage);
        }
        return scoreServerChoice(b, targetTitle, selectedLanguage) - scoreServerChoice(a, targetTitle, selectedLanguage);
      });
  }, [
    fullMovieSources,
    verifiedOnly,
    selectedLanguage,
    sourceTypeFilter,
    qualityFilter,
    sortBy,
    serverQuery,
    serverPickerTarget?.title,
  ]);

  if (!serverPickerTarget) return null;

  const handleSelectSource = (source: StreamSource) => {
    let adjustedSources = sources;
    if (
      selectedLanguage !== 'All' &&
      source.url.includes('remux=1') &&
      (source.url.includes('/api/stream-proxy') || source.url.includes('/api/torrent/stream'))
    ) {
      const updatedUrl = source.url.includes('&lang=')
        ? source.url.replace(/([?&]lang=)[^&]*/i, `$1${encodeURIComponent(selectedLanguage)}`)
        : `${source.url}&lang=${encodeURIComponent(selectedLanguage)}`;
      adjustedSources = sources.map((s) => (s.id === source.id ? { ...s, url: updatedUrl } : s));
    }

    closeServerPicker();
    startPlayback({
      mediaId: serverPickerTarget.mediaId,
      mediaType: serverPickerTarget.mediaType,
      title: serverPickerTarget.title,
      subtitle: serverPickerTarget.subtitle,
      posterPath: serverPickerTarget.posterPath,
      backdropPath: serverPickerTarget.backdropPath,
      fallbackPoster: serverPickerTarget.fallbackPoster,
      fallbackBackdrop: serverPickerTarget.fallbackBackdrop,
      imdbId: serverPickerTarget.imdbId,
      dejavuId: serverPickerTarget.dejavuId,
      archiveIdentifier: serverPickerTarget.archiveIdentifier,
      genreIds: serverPickerTarget.genreIds,
      originalLanguage: serverPickerTarget.originalLanguage,
      releaseYear: serverPickerTarget.releaseYear,
      runtimeMinutes: serverPickerTarget.runtimeMinutes,
      seasonNumber: serverPickerTarget.seasonNumber,
      episodeNumber: serverPickerTarget.episodeNumber,
      episodeTitle: serverPickerTarget.episodeTitle,
      initialTime: serverPickerTarget.initialTime,
      bengaliSerialSlug: serverPickerTarget.bengaliSerialSlug,
      preferredVideoId: serverPickerTarget.preferredVideoId,
      preferredSourceId: source.id,
      initialSources: adjustedSources,
      initialSubtitles: subtitles,
    });
  };

  const hasActiveFilter =
    verifiedOnly ||
    selectedLanguage !== 'All' ||
    sourceTypeFilter !== 'all' ||
    qualityFilter !== 'all' ||
    serverQuery.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-picker-title"
      onClick={closeServerPicker}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-2xl p-0 sm:p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 35, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[90vh] rounded-t-[2.5rem] sm:rounded-3xl bg-zinc-950/95 border border-white/20 flex flex-col overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-3xl"
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-white/25" />
        </div>

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4 bg-gradient-to-r from-white/[0.05] via-transparent to-transparent">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative h-14 w-10 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-white/20 shadow-lg">
              <MediaPosterImage
                path={serverPickerTarget.posterPath}
                fallbackSrc={serverPickerTarget.fallbackPoster}
                size="w185"
                alt={serverPickerTarget.title}
                titleForFallback={serverPickerTarget.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Zap className="h-3 w-3 inline mr-1 fill-emerald-400" />
                  Select Audio & Quality
                </span>
              </div>
              <h2 id="server-picker-title" className="font-display text-lg sm:text-xl font-bold text-white truncate mt-1">
                {serverPickerTarget.title}
              </h2>
              <p className="text-xs font-medium text-slate-400 truncate">
                {serverPickerTarget.subtitle || (serverPickerTarget.mediaType === 'tv' ? 'TV Series' : 'Movie')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeServerPicker}
            aria-label="Close server picker"
            className="h-11 w-11 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-300 hover:text-white transition-all duration-200 shrink-0 shadow-md active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Streams List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Available Audio Tracks
              </span>
            </div>
            {loading ? (
              <span className="text-xs text-emerald-400 flex items-center gap-2 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                Loading audio tracks...
              </span>
            ) : isSearchingMore ? (
              <span className="text-xs text-emerald-300 flex items-center gap-2 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                Finding streams ({filteredFullSources.length} ready)...
              </span>
            ) : fullMovieSources.length > 0 ? (
              <span className="text-xs font-semibold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                {filteredFullSources.length} audio tracks
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse flex items-center px-4 gap-4">
                  <div className="h-11 w-11 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-white/5" />
                  </div>
                  <div className="h-11 w-24 rounded-xl bg-white/10" />
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-900/80 border border-white/15 text-center space-y-4 shadow-xl">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <Volume2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-white">No Audio Streams Found</p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {resolveError
                    ? resolveError
                    : 'We could not find active audio streams for this title right now. Try retrying or selecting another title.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white inline-flex items-center gap-2 transition-all active:scale-95 shadow-md"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={closeServerPicker}
                  className="h-11 px-6 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg"
                  style={{ backgroundColor: accent.hex }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {fullMovieSources.length > 0 && (
                <div className="space-y-4">
                  {/* Filter & Search Bar */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5 shadow-inner">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-emerald-400" />
                        <span>Filter Audio & Quality</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {verifiedDirectCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setVerifiedOnly((v) => !v)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all shadow-sm ${
                              verifiedOnly
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20'
                                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>HD Verified ({verifiedDirectCount})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Language Filter Row */}
                    {availableLanguages.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                          Audio:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLanguage('All')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                            selectedLanguage === 'All'
                              ? 'text-white border-transparent shadow-md'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                          style={
                            selectedLanguage === 'All'
                              ? { backgroundColor: accent.hex }
                              : undefined
                          }
                        >
                          All Audio
                        </button>
                        {availableLanguages.map(({ lang, count }) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                              selectedLanguage === lang
                                ? 'text-white border-transparent shadow-md'
                                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                            style={
                              selectedLanguage === lang
                                ? { backgroundColor: accent.hex }
                                : undefined
                            }
                          >
                            {lang} ({count})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Filtered Stream List */}
                  {filteredFullSources.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-zinc-900/80 border border-white/15 text-center space-y-3">
                      <Film className="h-8 w-8 text-slate-400 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-base font-bold text-white">No Audio Tracks Match Filter</p>
                        <p className="text-xs text-slate-300 max-w-xs mx-auto">
                          Try selecting another audio language or resetting filters.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white inline-flex items-center gap-2 transition-all active:scale-95"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={closeServerPicker}
                          className="h-10 px-5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-md"
                          style={{ backgroundColor: accent.hex }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredFullSources.map((source, idx) => {
                        const audioLang = source.audioLanguage ? extractLanguageTags(source.audioLanguage)[0] : 'Original Audio';
                        return (
                          <motion.button
                            key={`${source.id}-${idx}`}
                            type="button"
                            whileHover={{ scale: 1.01, y: -2 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleSelectSource(source)}
                            className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-zinc-900/95 to-zinc-900/80 hover:from-zinc-800/95 hover:to-zinc-800/90 border border-white/15 hover:border-emerald-500/50 transition-all flex items-center justify-between gap-4 group shadow-xl hover:shadow-emerald-500/10"
                          >
                            <div className="min-w-0 flex items-center gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 group-hover:bg-emerald-500/25 transition-all shadow-inner">
                                <Volume2 className="h-6 w-6" />
                              </div>
                              <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-display text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                                    {audioLang} Audio
                                  </p>
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                                    {source.quality || '1080p FHD'}
                                  </span>
                                  {source.isVerified && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
                                      HD Verified
                                    </span>
                                  )}
                                  {source.sizeLabel && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tabular font-bold bg-white/10 text-slate-200 border border-white/15">
                                      {source.sizeLabel}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 truncate font-mono-tabular flex items-center gap-2">
                                  <span className="uppercase text-emerald-400 font-semibold">{source.format}</span>
                                  <span className="text-white/30">•</span>
                                  <span className="text-slate-400">High Quality Audio Stream</span>
                                </p>
                              </div>
                            </div>

                            <div
                              className="h-12 px-6 rounded-xl text-white text-xs font-extrabold inline-flex items-center gap-2 shrink-0 shadow-lg group-hover:scale-105 group-hover:shadow-emerald-500/30 transition-all"
                              style={{ backgroundColor: accent.hex }}
                            >
                              <Play className="h-4 w-4 fill-current" />
                              <span>Play</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Official Trailer Servers */}
              {trailerSources.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
                    <Youtube className="h-4 w-4 text-red-500" />
                    <span>Official Studio Trailer</span>
                  </div>

                  <div className="space-y-2.5">
                    {trailerSources.map((source, idx) => (
                      <motion.button
                        key={`${source.id}-${idx}`}
                        type="button"
                        whileHover={{ scale: 1.01, y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSelectSource(source)}
                        className="w-full text-left p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/15 hover:border-red-500/50 transition-all flex items-center justify-between gap-4 group shadow-lg"
                      >
                        <div className="min-w-0 flex items-center gap-3.5">
                          <div className="h-11 w-11 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <Youtube className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="font-display text-sm font-bold text-white truncate group-hover:text-red-300 transition-colors">
                              {source.label}
                            </p>
                            <p className="text-xs text-slate-300 truncate">
                              {source.note || 'Official high-definition trailer'}
                            </p>
                          </div>
                        </div>

                        <div className="h-11 px-5 rounded-xl bg-white/15 group-hover:bg-red-600 border border-white/20 group-hover:border-red-500 text-white text-xs font-bold inline-flex items-center gap-2 shrink-0 transition-all shadow-md">
                          <Play className="h-4 w-4 fill-current" />
                          <span>Watch</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Optimized audio & video streams
          </span>
          <button
            type="button"
            onClick={closeServerPicker}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};
