import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Download,
  Film,
  Filter,
  HardDrive,
  Info,
  Languages,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Tv,
  X,
  Youtube,
} from 'lucide-react';
import { motion } from 'motion/react';
import { streamProviderService } from '../services/streamProviderService';
import { useAppState } from '../state/AppContext';
import { StreamSource, SubtitleTrack, THEME_ACCENTS } from '../types/media';
import { MediaPosterImage } from './MediaPosterImage';

import {
  extractLanguageTags,
  getAvailableLanguages,
  getAvailableProviders,
  getCanonicalProviderName,
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
  
  // Prioritize servers with valid HLS stream headers/format to prevent incorrect language playback
  if (isHls) score += 200;

  if (isRemux) score -= 220;
  if (source.isDirectPlayable === false) score -= 350;
  if (isP2P) score -= 120;

  // Language metadata matching (e.g. user-preferred 'Hindi' tags)
  if (preferredLanguage && preferredLanguage !== 'All') {
    const tags = extractLanguageTags(source.audioLanguage);
    if (tags.includes(preferredLanguage)) {
      score += 450;
    } else {
      score -= 200;
    }
  }

  // Title relevance boost
  const cleanTargetWords = targetTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const labelLower = (source.label || '').toLowerCase();
  if (cleanTargetWords.length > 0 && cleanTargetWords.every((w) => labelLower.includes(w))) {
    score += 120;
  }

  // Stream resolution / Quality ranking bonus
  score += getQualityRank(source.quality) * 40;

  // Seeders bonus for P2P
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
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recommended');
  const [serverQuery, setServerQuery] = useState<string>('');

  const accent = THEME_ACCENTS[themeColor || 'red'];

  const resetFilters = () => {
    setVerifiedOnly(false);
    setSelectedLanguage('All');
    setSelectedProvider('All');
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

    const resolve = async () => {
      try {
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

        const handleProgress = (partial: { sources?: StreamSource[]; subtitles?: SubtitleTrack[] }) => {
          if (!active) return;
          const partialSources = partial.sources || [];
          if (partialSources.length > 0) {
            setSources(partialSources);
            setSubtitles(partial.subtitles || []);
            setVerifiedOnly(false);
            setLoading(false);
          }
        };

        const res =
          serverPickerTarget.mediaType === 'tv'
            ? await streamProviderService.resolveEpisodeStreams(query, { onProgress: handleProgress })
            : await streamProviderService.resolveMovieStreams(query, { onProgress: handleProgress });

        if (!active) return;
        const loadedSources = res.sources || [];
        setSources(loadedSources);
        setSubtitles(res.subtitles || []);
        setVerifiedOnly(false);
      } catch (err) {
        if (!active) return;
        setResolveError(err instanceof Error ? err.message : 'Unable to probe stream servers.');
      } finally {
        if (active) {
          setLoading(false);
          setIsSearchingMore(false);
        }
      }
    };

    void resolve();
    return () => {
      active = false;
    };
  }, [serverPickerTarget, retryTick]);

  const fullMovieSources = useMemo(
    () => sources.filter((s) => s.format !== 'youtube' || Boolean(s.isFullEpisode)),
    [sources]
  );
  const trailerSources = useMemo(
    () => sources.filter((s) => s.format === 'youtube' && !s.isFullEpisode),
    [sources]
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

  const availableProviders = useMemo(
    () => getAvailableProviders(fullMovieSources),
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

        if (selectedProvider !== 'All') {
          if (getCanonicalProviderName(s) !== selectedProvider) return false;
        }

        if (!matchesSourceTypeFilter(s, sourceTypeFilter)) {
          return false;
        }

        if (!matchesQualityFilter(s, qualityFilter)) {
          return false;
        }

        if (q) {
          const hay = `${s.providerName} ${s.extensionName || ''} ${s.label} ${s.audioLanguage || ''} ${s.quality}`.toLowerCase();
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
    selectedProvider,
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
    selectedProvider !== 'All' ||
    sourceTypeFilter !== 'all' ||
    qualityFilter !== 'all' ||
    serverQuery.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-picker-title"
      onClick={closeServerPicker}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[88vh] rounded-t-3xl sm:rounded-2xl liquid-glass-strong border border-white/20 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/[0.10] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-9 rounded-lg overflow-hidden shrink-0 bg-[#161B26] border border-white/10">
              <MediaPosterImage
                path={serverPickerTarget.posterPath}
                fallbackSrc={serverPickerTarget.fallbackPoster}
                size="w185"
                alt={serverPickerTarget.title}
                titleForFallback={serverPickerTarget.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 id="server-picker-title" className="font-display text-base sm:text-lg font-bold text-white truncate">
                {serverPickerTarget.title}
              </h2>
              <p className="text-xs text-slate-300 truncate">
                {serverPickerTarget.subtitle || (serverPickerTarget.mediaType === 'tv' ? 'TV Series' : 'Movie')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeServerPicker}
            aria-label="Close server picker"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Streams List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300 tracking-wide">
              CHOOSE VERIFIED SERVER BEFORE PLAYING
            </p>
            {loading ? (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                Probing live streams...
              </span>
            ) : isSearchingMore ? (
              <span className="text-[11px] text-emerald-300 flex items-center gap-1.5 font-mono-tabular">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                Searching more servers ({filteredFullSources.length} ready)...
              </span>
            ) : fullMovieSources.length > 0 ? (
              <span className="text-[11px] text-slate-400 font-mono-tabular">
                {filteredFullSources.length} of {fullMovieSources.length} shown
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-18 rounded-xl liquid-skeleton" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="p-6 rounded-xl bg-black/40 border border-white/10 text-center space-y-3">
              <Server className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">No Direct Stream Found</p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {resolveError
                    ? resolveError
                    : 'This title currently has no reachable stream mirror. You can retry probing or try another title.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={closeServerPicker}
                  className="min-h-[42px] px-5 py-2 rounded-xl text-xs font-semibold text-white transition-transform active:scale-95 shadow-lg"
                  style={{ backgroundColor: accent.hex }}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {fullMovieSources.length > 0 && (
                <div className="space-y-3">
                  {/* Server Filter Bar */}
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Server Filtering</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {verifiedDirectCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setVerifiedOnly((v) => !v)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border inline-flex items-center gap-1 transition-colors ${
                              verifiedOnly
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span>Verified Direct ({verifiedDirectCount})</span>
                          </button>
                        )}

                        <select
                          aria-label="Sort servers"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortMode)}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-black/50 text-slate-200 border border-white/15 focus:outline-none"
                        >
                          <option value="recommended">Best Match</option>
                          <option value="quality">Highest Quality</option>
                          {hasP2P && <option value="seeders">Most Seeders</option>}
                        </select>
                      </div>
                    </div>

                    {/* Quick Search Filter when multiple servers exist */}
                    {fullMovieSources.length > 4 && (
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={serverQuery}
                          onChange={(e) => setServerQuery(e.target.value)}
                          placeholder="Filter by server, title, or extension..."
                          className="w-full h-8 pl-8 pr-7 rounded-lg bg-black/45 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-white/30"
                        />
                        {serverQuery && (
                          <button
                            type="button"
                            onClick={() => setServerQuery('')}
                            aria-label="Clear server filter"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Source Type & Quality Filters */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {(
                        [
                          { id: 'all', label: 'All Types', show: true },
                          { id: 'direct', label: 'Direct Stream', show: hasDirect },
                          { id: 'nuvio', label: 'Nuvio', show: hasNuvio },
                          { id: 'stremio', label: 'Stremio', show: hasStremio },
                          { id: 'cloudstream', label: 'CloudStream', show: hasCloudStream },
                          { id: 'p2p', label: 'Torrent P2P', show: hasP2P },
                        ] as const
                      )
                        .filter((t) => t.show)
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSourceTypeFilter(t.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                              sourceTypeFilter === t.id
                                ? 'bg-white text-slate-900 border-white'
                                : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}

                      <span className="h-4 w-px bg-white/10 shrink-0 mx-0.5" />

                      {(
                        [
                          { id: 'all', label: 'Any Quality' },
                          { id: '4k', label: '4K' },
                          { id: '1080p', label: '1080p' },
                          { id: '720p', label: '720p' },
                          { id: '480p', label: '480p' },
                        ] as const
                      ).map((qOpt) => (
                        <button
                          key={qOpt.id}
                          type="button"
                          onClick={() => setQualityFilter(qOpt.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                            qualityFilter === qOpt.id
                              ? 'bg-sky-500/25 text-sky-200 border-sky-400/50'
                              : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-slate-200'
                          }`}
                        >
                          {qOpt.label}
                        </button>
                      ))}
                    </div>

                    {/* Provider Filter Row */}
                    {availableProviders.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                        <Server className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-0.5" />
                        <button
                          type="button"
                          onClick={() => setSelectedProvider('All')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                            selectedProvider === 'All'
                              ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                              : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          All Providers
                        </button>
                        {availableProviders.map(({ name, count }) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setSelectedProvider(name)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                              selectedProvider === name
                                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                                : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {name} ({count})
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Language Filter Row */}
                    {availableLanguages.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                        <Languages className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-0.5" />
                        <button
                          type="button"
                          onClick={() => setSelectedLanguage('All')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                            selectedLanguage === 'All'
                              ? 'text-white border-transparent'
                              : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                          style={
                            selectedLanguage === 'All'
                              ? { backgroundColor: accent.hex }
                              : undefined
                          }
                        >
                          All Languages
                        </button>
                        {availableLanguages.map(({ lang, count }) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-colors ${
                              selectedLanguage === lang
                                ? 'text-white border-transparent'
                                : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10'
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

                  {/* Filtered Server List */}
                  {filteredFullSources.length === 0 ? (
                    <div className="p-5 rounded-xl bg-black/40 border border-white/10 text-center space-y-3">
                      <Film className="h-7 w-7 text-slate-400 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">No Servers Match Current Filters</p>
                        <p className="text-xs text-slate-300">
                          Try resetting filters or disabling Verified Direct to view P2P and fallback servers.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={closeServerPicker}
                          className="min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-transform active:scale-95"
                          style={{ backgroundColor: accent.hex }}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFullSources.map((source, idx) => {
                        const isP2P = source.url.includes('/api/torrent/stream');
                        const isCS = Boolean(source.extensionName) || source.id.startsWith('cs-');
                        return (
                          <button
                            key={`${source.id}-${idx}`}
                            type="button"
                            onClick={() => handleSelectSource(source)}
                            className="w-full text-left p-3.5 rounded-xl bg-black/40 hover:bg-white/[0.08] border border-white/15 hover:border-white/35 transition-all flex items-center justify-between gap-3 group"
                          >
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-white/[0.08] flex items-center justify-center shrink-0 text-slate-200 group-hover:text-white">
                                {isCS ? (
                                  <Download className="h-4 w-4 text-blue-400" />
                                ) : source.id.startsWith('stremio-') ? (
                                  <Boxes className="h-4 w-4 text-purple-400" />
                                ) : source.format === 'hls' ? (
                                  <Tv className="h-4 w-4" />
                                ) : (
                                  <HardDrive className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-white truncate">
                                    {source.providerName}
                                  </p>
                                  {source.isVerified && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-0.5 uppercase">
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      Verified
                                    </span>
                                  )}
                                  {source.audioLanguage && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                      {extractLanguageTags(source.audioLanguage)[0]}
                                    </span>
                                  )}
                                  {isCS && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                                      {source.extensionName || 'CloudStream'}
                                    </span>
                                  )}
                                  {isP2P && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                                      P2P
                                    </span>
                                  )}
                                  {source.url.includes('remux=1') && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                                      Remux
                                    </span>
                                  )}
                                  {source.sizeLabel && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-semibold bg-white/10 text-slate-200 border border-white/15">
                                      {source.sizeLabel}
                                    </span>
                                  )}
                                  {source.seeders !== undefined && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                      {source.seeders} seeders
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 truncate mt-0.5 font-mono-tabular">
                                  {source.quality} · {source.format.toUpperCase()}
                                  {source.label ? ` · ${source.label}` : ''}
                                </p>
                              </div>
                            </div>

                            <span
                              className="min-h-[40px] px-3.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-md group-hover:scale-105 transition-transform"
                              style={{ backgroundColor: accent.hex }}
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Play</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notice when only trailers exist for a modern copyrighted movie */}
              {fullMovieSources.length === 0 && trailerSources.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" />
                  <p className="leading-relaxed">
                    Only the official studio trailer is currently available for this title. You can watch the trailer below or go back to browse another release.
                  </p>
                </div>
              )}

              {/* Official Trailer Servers */}
              {trailerSources.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <Youtube className="h-3.5 w-3.5 text-red-500" />
                    <span>Official Studio Trailer</span>
                  </div>

                  <div className="space-y-2">
                    {trailerSources.map((source, idx) => (
                      <button
                        key={`${source.id}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSource(source)}
                        className="w-full text-left p-3.5 rounded-xl bg-black/40 hover:bg-white/[0.08] border border-white/15 hover:border-white/35 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                            <Youtube className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {source.label}
                            </p>
                            <p className="text-xs text-slate-300 truncate mt-0.5">
                              {source.note || 'Official high-definition trailer'}
                            </p>
                          </div>
                        </div>

                        <span className="min-h-[40px] px-3.5 rounded-xl bg-white/15 group-hover:bg-white/25 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors">
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Watch Trailer</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs text-slate-400">
          <span>Verified direct streams prioritized</span>
          <button
            type="button"
            onClick={closeServerPicker}
            className="text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};
