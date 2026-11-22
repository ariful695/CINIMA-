import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Play,
  Plus,
  Tv,
  X,
} from 'lucide-react';
import { TMDB_GENRES } from '../data/curatedCatalog';
import { archiveMovieService } from '../services/archiveMovieService';
import { bengaliSerialService } from '../services/bengaliSerialService';
import { dejavuApiService } from '../services/dejavuApiService';
import { tmdbService } from '../services/tmdbService';
import { useAppState } from '../state/AppContext';
import { Genre, MediaItem, WatchProgressItem } from '../types/media';
import { AnimatePresence, motion } from 'motion/react';
import { MediaCard } from './MediaCard';
import { MediaPosterImage } from './MediaPosterImage';

function formatRemaining(currentTime: number, duration: number): string {
  const remaining = Math.max(0, Math.floor((duration - currentTime) / 60));
  if (remaining <= 1) return '1m left';
  if (remaining >= 60) {
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;
    return `${h}h ${m}m left`;
  }
  return `${remaining}m left`;
}

function isInCinemas(releaseDate?: string): boolean {
  if (!releaseDate) return false;
  const ts = Date.parse(releaseDate);
  if (!Number.isFinite(ts)) return false;
  const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return diffDays >= -14 && diffDays <= 75;
}

interface CarouselRowProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

const CarouselRow: React.FC<CarouselRowProps> = ({
  title,
  subtitle,
  rightAction,
  children,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = Math.max(320, el.clientWidth * 0.78);
    el.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-3.5">
      <div className="flex items-start justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-5 rounded-full bg-[#E50914] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 pl-3.5 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rightAction}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              aria-label={`Scroll ${title} left`}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/15 text-slate-200 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              aria-label={`Scroll ${title} right`}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/15 text-slate-200 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-2 scroll-smooth"
      >
        {children}
      </div>
    </section>
  );
};

export const HomeScreen: React.FC = () => {
  const {
    catalogRefreshTick,
    continueWatching,
    removeWatchProgress,
    clearWatchHistory,
    openMediaDetails,
    startPlayback,
    isInWatchlist,
    toggleWatchlist,
    openServerPicker,
  } = useAppState();

  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingToday, setTrendingToday] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [publicDomainMovies, setPublicDomainMovies] = useState<MediaItem[]>(() =>
    archiveMovieService.getCuratedPublicDomainMovies()
  );
  const [bengaliMovies, setBengaliMovies] = useState<MediaItem[]>(() =>
    archiveMovieService.getCuratedRegionalMovies('bn')
  );
  const [hindiMovies, setHindiMovies] = useState<MediaItem[]>(() =>
    archiveMovieService.getCuratedRegionalMovies('hi')
  );
  const [publicDomainSeries, setPublicDomainSeries] = useState<MediaItem[]>(() =>
    archiveMovieService.getCuratedPublicDomainSeries()
  );
  const [zeeBanglaDaily, setZeeBanglaDaily] = useState<MediaItem[]>([]);
  const [bengaliCartoons, setBengaliCartoons] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>(TMDB_GENRES);
  const [selectedGenreId, setSelectedGenreId] = useState<number>(878);
  const [genreItems, setGenreItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [homeTab, setHomeTab] = useState<'all' | 'movies' | 'series'>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroLogos, setHeroLogos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let active = true;
    const loadHomeData = async () => {
      setIsLoading(true);
      const [
        moviesRes,
        todayRes,
        tvRes,
        topRes,
        genreList,
        dvMovies,
        dvTv,
        dvLatestMovies,
        archiveMovies,
        archiveSeries,
        bnArchive,
        hiArchive,
        bnTmdb,
        hiTmdb,
        bengaliCatalog,
      ] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getTrendingToday(),
        tmdbService.getPopularTvSeries(),
        tmdbService.getTopRated(),
        tmdbService.getGenres(),
        dejavuApiService.isConfigured() ? dejavuApiService.getTrendingMovies() : Promise.resolve([]),
        dejavuApiService.isConfigured() ? dejavuApiService.getTrendingTvShows() : Promise.resolve([]),
        dejavuApiService.isConfigured() ? dejavuApiService.getLatestMovies() : Promise.resolve([]),
        archiveMovieService.fetchLivePublicDomainMovies(),
        archiveMovieService.fetchLivePublicDomainSeries(),
        archiveMovieService.fetchLiveArchiveByLanguage('bengali', 10),
        archiveMovieService.fetchLiveArchiveByLanguage('hindi', 10),
        tmdbService.getMoviesByLanguage('bn'),
        tmdbService.getMoviesByLanguage('hi'),
        bengaliSerialService.getCatalog(),
      ]);

      if (!active) return;
      setTrendingMovies(dvMovies.length > 0 ? dvMovies : moviesRes.items);
      setTrendingToday(todayRes.length > 0 ? todayRes : moviesRes.items);
      setPopularSeries(dvTv.length > 0 ? dvTv : tvRes.items);
      setTopRated(
        dvLatestMovies.length > 0
          ? [...dvLatestMovies, ...(moviesRes.isLive ? topRes.items : [])]
          : topRes.items
      );
      if (archiveMovies.length > 0) setPublicDomainMovies(archiveMovies);
      if (archiveSeries.length > 0) setPublicDomainSeries(archiveSeries);
      setBengaliMovies([...bnArchive, ...bnTmdb]);
      setHindiMovies([...hiArchive, ...hiTmdb]);
      setZeeBanglaDaily(bengaliCatalog.zeeBanglaDaily);
      setBengaliCartoons(bengaliCatalog.bengaliCartoons);
      setGenres(genreList);
      if (genreList.length > 0 && !genreList.some((g) => g.id === selectedGenreId)) {
        setSelectedGenreId(genreList[0].id);
      }
      setIsLoading(false);
    };

    void loadHomeData();
    return () => {
      active = false;
    };
  }, [catalogRefreshTick]);

  useEffect(() => {
    let active = true;
    const loadGenre = async () => {
      const items = await tmdbService.getByGenre(selectedGenreId);
      if (active) setGenreItems(items);
    };
    void loadGenre();
    return () => {
      active = false;
    };
  }, [selectedGenreId, catalogRefreshTick]);

  const heroSlides = useMemo(() => {
    if (homeTab === 'movies') {
      return trendingMovies.length > 0
        ? trendingMovies.slice(0, 6)
        : topRated.filter((i) => i.mediaType === 'movie').slice(0, 6);
    }
    if (homeTab === 'series') {
      return popularSeries.length > 0
        ? popularSeries.slice(0, 6)
        : topRated.filter((i) => i.mediaType === 'tv').slice(0, 6);
    }
    const mixed: MediaItem[] = [];
    const maxLen = Math.max(trendingMovies.length, popularSeries.length);
    for (let i = 0; i < maxLen && mixed.length < 6; i += 1) {
      if (popularSeries[i]) mixed.push(popularSeries[i]);
      if (mixed.length < 6 && trendingMovies[i]) mixed.push(trendingMovies[i]);
    }
    return mixed.length > 0 ? mixed : topRated.slice(0, 6);
  }, [homeTab, trendingMovies, popularSeries, topRated]);

  useEffect(() => {
    if (heroSlides.length <= 1 || heroPaused) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroPaused]);

  const activeHero = heroSlides[heroIndex % Math.max(1, heroSlides.length)];
  const activeHeroKey = activeHero ? `${activeHero.mediaType}:${activeHero.id}` : '';
  const activeHeroLogo = activeHeroKey ? heroLogos[activeHeroKey] : null;
  const heroSaved = activeHero ? isInWatchlist(activeHero.id, activeHero.mediaType) : false;

  // Fetch official title logo for current hero slide (cached in tmdbService)
  useEffect(() => {
    if (!activeHero) return;
    const key = `${activeHero.mediaType}:${activeHero.id}`;
    if (key in heroLogos) return;
    let active = true;
    tmdbService.getMediaLogo(activeHero.id, activeHero.mediaType).then((logoUrl) => {
      if (active) {
        setHeroLogos((prev) => ({ ...prev, [key]: logoUrl }));
      }
    });
    return () => {
      active = false;
    };
  }, [activeHero, heroLogos]);

  const handleHeroPlay = useCallback(
    (item: MediaItem) => {
      openServerPicker({
        mediaId: item.id,
        mediaType: item.mediaType,
        title: item.title,
        subtitle: item.mediaType === 'tv' ? 'Season 1 · Episode 1' : undefined,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        fallbackPoster: item.fallbackPoster,
        fallbackBackdrop: item.fallbackBackdrop,
        imdbId: item.imdbId,
        dejavuId: item.dejavuId,
        archiveIdentifier: item.archiveIdentifier,
        genreIds: item.genreIds,
        originalLanguage: item.originalLanguage,
        releaseYear: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4), 10) || undefined : undefined,
        seasonNumber: item.mediaType === 'tv' ? 1 : undefined,
        episodeNumber: item.mediaType === 'tv' ? 1 : undefined,
        bengaliSerialSlug: item.bengaliSerialSlug,
      });
    },
    [openServerPicker]
  );

  const handleResumeItem = (progress: WatchProgressItem) => {
    startPlayback({
      mediaId: progress.mediaId,
      mediaType: progress.mediaType,
      title: progress.title,
      subtitle:
        progress.mediaType === 'tv' && progress.seasonNumber && progress.episodeNumber
          ? `S${progress.seasonNumber} E${progress.episodeNumber}${
              progress.episodeTitle ? ` · ${progress.episodeTitle}` : ''
            }`
          : undefined,
      posterPath: progress.posterPath,
      backdropPath: progress.backdropPath,
      fallbackPoster: progress.fallbackPoster,
      fallbackBackdrop: progress.fallbackBackdrop,
      seasonNumber: progress.seasonNumber,
      episodeNumber: progress.episodeNumber,
      episodeTitle: progress.episodeTitle,
      initialTime: progress.currentTime,
    });
  };

  const filteredContinueWatching = useMemo(() => {
    if (homeTab === 'movies') return continueWatching.filter((i) => i.mediaType === 'movie');
    if (homeTab === 'series') return continueWatching.filter((i) => i.mediaType === 'tv');
    return continueWatching;
  }, [continueWatching, homeTab]);

  const top10Items = useMemo(() => {
    const pool =
      homeTab === 'series'
        ? popularSeries
        : homeTab === 'movies'
        ? trendingMovies
        : trendingToday.length > 0
        ? trendingToday
        : trendingMovies;
    return (pool.length > 0 ? pool : topRated).slice(0, 10);
  }, [homeTab, trendingToday, trendingMovies, popularSeries, topRated]);

  const trendingTodayItems = useMemo(() => {
    const base = trendingToday.length > 0 ? trendingToday : trendingMovies;
    if (homeTab === 'movies') return base.filter((i) => i.mediaType === 'movie');
    if (homeTab === 'series') return base.filter((i) => i.mediaType === 'tv');
    return base;
  }, [homeTab, trendingToday, trendingMovies]);

  const topRatedFiltered = useMemo(() => {
    if (homeTab === 'movies') return topRated.filter((i) => i.mediaType === 'movie');
    if (homeTab === 'series') return topRated.filter((i) => i.mediaType === 'tv');
    return topRated;
  }, [homeTab, topRated]);

  return (
    <div className="pb-12 space-y-8 bg-[#050609]">
      {/* Featured Full-Bleed Auto-Rotating Hero Banner */}
      {activeHero ? (
        <section
          className="relative w-full min-h-[470px] sm:min-h-[540px] lg:min-h-[580px] overflow-hidden bg-[#050609]"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeHero.mediaType}-${activeHero.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              {/* Mobile portrait framing matches screenshot hero proportions */}
              <div className="sm:hidden h-full w-full">
                <MediaPosterImage
                  path={activeHero.posterPath || activeHero.backdropPath}
                  fallbackSrc={activeHero.fallbackPoster || activeHero.fallbackBackdrop}
                  size="w780"
                  alt={`${activeHero.title} artwork`}
                  titleForFallback={activeHero.title}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              {/* Tablet & Desktop cinematic widescreen backdrop */}
              <div className="hidden sm:block h-full w-full">
                <MediaPosterImage
                  path={activeHero.backdropPath || activeHero.posterPath}
                  fallbackSrc={activeHero.fallbackBackdrop || activeHero.fallbackPoster}
                  size="w1280"
                  alt={`${activeHero.title} backdrop`}
                  titleForFallback={activeHero.title}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Top & Bottom Cinema Contrast Scrims */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050609] via-[#050609]/55 to-transparent pointer-events-none" />
          <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-[#050609]/85 via-[#050609]/25 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-end min-h-[470px] sm:min-h-[540px] lg:min-h-[580px] px-4 sm:px-6 lg:px-8 pt-20 pb-5 sm:pb-8 max-w-2xl lg:max-w-3xl">
            {/* Title Logo PNG (when available) or crisp display title */}
            <div className="mb-3.5">
              {activeHeroLogo ? (
                <img
                  src={activeHeroLogo}
                  alt={activeHero.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[76px] sm:max-h-[96px] max-w-[240px] sm:max-w-[340px] w-auto object-contain object-left drop-shadow-[0_6px_20px_rgba(0,0,0,0.85)]"
                />
              ) : (
                <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.06] text-balance drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
                  {activeHero.title}
                </h1>
              )}
            </div>

            {/* Metadata Chips Row (Year · Type · IMDb Rating) */}
            <div className="flex flex-wrap items-center gap-2">
              {activeHero.releaseDate && (
                <div className="px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 text-xs font-medium text-slate-100 inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-300" />
                  <span className="font-mono-tabular">{String(activeHero.releaseDate).slice(0, 4)}</span>
                </div>
              )}
              <div className="px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 text-xs font-medium text-slate-100 inline-flex items-center gap-1.5">
                {activeHero.mediaType === 'tv' ? (
                  <Tv className="h-3.5 w-3.5 text-slate-300" />
                ) : (
                  <Film className="h-3.5 w-3.5 text-slate-300" />
                )}
                <span>{activeHero.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
              </div>
              {activeHero.voteAverage > 0 && (
                <div className="px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 font-mono-tabular">
                  <span className="px-1.5 py-0.5 rounded bg-[#F5C518] text-slate-950 font-black text-[10px] leading-none tracking-tight">
                    IMDb
                  </span>
                  <span>{activeHero.voteAverage.toFixed(1)}/10</span>
                </div>
              )}
            </div>

            {/* Primary Hero CTA Row (Play + Details + Watchlist +) */}
            <div className="mt-4 flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => handleHeroPlay(activeHero)}
                className="min-h-[46px] flex-1 sm:flex-none sm:min-w-[168px] px-7 rounded-full bg-white hover:bg-slate-100 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Play</span>
              </button>

              <button
                type="button"
                onClick={() => openMediaDetails(activeHero.id, activeHero.mediaType, activeHero)}
                className="min-h-[46px] px-6 rounded-full bg-white/[0.12] hover:bg-white/[0.2] backdrop-blur-md border border-white/25 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Info className="h-4 w-4" />
                <span>Details</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWatchlist(activeHero)}
                aria-label={heroSaved ? `Remove ${activeHero.title} from Watchlist` : `Add ${activeHero.title} to Watchlist`}
                className="h-[46px] w-[46px] shrink-0 rounded-full bg-white/[0.12] hover:bg-white/[0.2] backdrop-blur-md border border-white/25 text-white flex items-center justify-center active:scale-[0.98] transition-all"
              >
                {heroSaved ? <Check className="h-4 w-4 text-emerald-400" /> : <Plus className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Centered Hero Carousel Dash Indicators */}
          {heroSlides.length > 1 && (
            <div className="relative z-10 pb-3 flex items-center justify-center gap-1.5">
              {heroSlides.map((slide, idx) => (
                <button
                  key={`${slide.mediaType}-${slide.id}`}
                  type="button"
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-[3px] rounded-full transition-all ${
                    idx === heroIndex % heroSlides.length
                      ? 'w-7 bg-white'
                      : 'w-5 bg-white/30 hover:bg-white/55'
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="h-[470px] w-full bg-[#121620] animate-pulse" />
      )}

      {/* Centered Editorial Serif Category Switcher (All / Movies / Series) */}
      <div className="flex flex-col items-center justify-center pt-1">
        <div className="flex items-center gap-10 sm:gap-14">
          {(['all', 'movies', 'series'] as const).map((tab) => {
            const active = homeTab === tab;
            const label = tab === 'all' ? 'All' : tab === 'movies' ? 'Movies' : 'Series';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setHomeTab(tab);
                  setHeroIndex(0);
                }}
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                className={`relative pb-3.5 text-base sm:text-lg transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <span>{label}</span>
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Continue Watching Carousel */}
      {filteredContinueWatching.length > 0 && (
        <CarouselRow
          title="Continue Watching"
          rightAction={
            <button
              type="button"
              onClick={clearWatchHistory}
              className="min-h-[36px] px-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          }
        >
          {filteredContinueWatching.map((progress) => {
            const ratio =
              progress.duration > 0 ? progress.currentTime / progress.duration : 0.1;
            const isSeries = progress.mediaType === 'tv';
            return (
              <div
                key={progress.key}
                className="relative group shrink-0 w-[244px] sm:w-[288px]"
              >
                <div
                  onClick={() => handleResumeItem(progress)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleResumeItem(progress);
                    }
                  }}
                  className="relative aspect-video overflow-hidden rounded-2xl bg-[#111520] border border-white/[0.12] shadow-[0_12px_28px_rgba(0,0,0,0.45)] cursor-pointer"
                >
                  <MediaPosterImage
                    path={progress.backdropPath || progress.posterPath}
                    fallbackSrc={progress.fallbackBackdrop || progress.fallbackPoster}
                    size="w780"
                    alt={progress.title}
                    titleForFallback={progress.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />

                  {/* Top-left Type / Episode Badge matching screenshot */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white inline-flex items-center gap-1.5 pointer-events-none">
                    {isSeries ? (
                      <Tv className="h-3 w-3 text-slate-200" />
                    ) : (
                      <Film className="h-3 w-3 text-slate-200" />
                    )}
                    <span className="font-mono-tabular">
                      {isSeries
                        ? `S${progress.seasonNumber || 1} · E${progress.episodeNumber || 1}`
                        : 'Movie'}
                    </span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-11 w-11 rounded-full bg-black/60 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white group-hover:bg-[#E50914] group-hover:border-[#E50914] transition-colors">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWatchProgress(progress.key);
                    }}
                    aria-label={`Remove ${progress.title} from Continue Watching`}
                    className="absolute top-2 right-2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full bg-black/65 backdrop-blur-md text-slate-200 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <div
                      className="h-full bg-[#E50914]"
                      style={{ width: `${Math.min(100, Math.max(5, ratio * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 px-0.5 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {progress.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0">
                    {formatRemaining(progress.currentTime, progress.duration)}
                  </span>
                </div>
              </div>
            );
          })}
        </CarouselRow>
      )}

      {/* Top 10 today Section */}
      <section className="space-y-3.5">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-5 rounded-full bg-[#E50914] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
              Top 10 today
            </h2>
          </div>
          <p className="text-xs text-slate-400 pl-3.5 mt-0.5">Updated daily</p>
        </div>

        <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-2 pt-1 scroll-smooth">
          {top10Items.map((item, idx) => {
            const theatrical = item.mediaType === 'movie' && isInCinemas(item.releaseDate);
            return (
              <div
                key={`top10-${item.mediaType}-${item.id}`}
                className="relative shrink-0 flex items-end group py-1"
              >
                <span
                  aria-hidden="true"
                  className={`font-display font-black select-none leading-[0.82] z-0 ${
                    idx === 0
                      ? 'text-[116px] sm:text-[148px] text-[#7A1E1E]/60 -mr-7 sm:-mr-9 translate-y-2'
                      : 'text-[124px] sm:text-[156px] text-[#7A1E1E]/65 -mr-8 sm:-mr-10 translate-y-2'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="relative z-10 w-[162px] sm:w-[194px] transition-transform duration-200 ease-out group-hover:scale-[1.03]">
                  <MediaCard
                    item={item}
                    posterOnly
                    onQuickPlay={handleHeroPlay}
                    topRightBadge={
                      theatrical ? (
                        <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-bold tracking-wider text-white inline-flex items-center gap-1.5 uppercase shadow-md">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#E50914]" />
                          <span>IN CINEMAS</span>
                        </span>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trending Today Section */}
      {trendingTodayItems.length > 0 && (
        <CarouselRow title="Trending Today" subtitle="Top trending titles today">
          {trendingTodayItems.map((item) => (
            <div key={`today-${item.mediaType}-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Zee Bangla Daily Serials Carousel */}
      {homeTab !== 'movies' && zeeBanglaDaily.length > 0 && (
        <CarouselRow title="Zee Bangla Daily Serials">
          {zeeBanglaDaily.map((item) => (
            <div key={`zb-${item.bengaliSerialSlug || item.id}`} className="shrink-0 w-[196px] sm:w-[228px]">
              <MediaCard
                item={item}
                aspect="landscape"
                subtitleLine={item.latestEpisodeLabel || 'Zee Bangla Daily'}
                onQuickPlay={handleHeroPlay}
              />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Bengali Cartoons & Family */}
      {homeTab !== 'movies' && bengaliCartoons.length > 0 && (
        <CarouselRow title="Bengali Cartoons & Family">
          {bengaliCartoons.map((item) => (
            <div key={`bntoon-${item.bengaliSerialSlug || item.id}`} className="shrink-0 w-[196px] sm:w-[228px]">
              <MediaCard
                item={item}
                aspect="landscape"
                subtitleLine={item.latestEpisodeLabel || 'Bengali Cartoon'}
                onQuickPlay={handleHeroPlay}
              />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Popular TV Series Carousel */}
      {homeTab !== 'movies' && (
        <CarouselRow title="Popular TV Series">
          {isLoading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="shrink-0 w-[142px] sm:w-[164px] aspect-[2/3] rounded-2xl liquid-glass liquid-skeleton"
                />
              ))
            : popularSeries.map((item) => (
                <div key={`tv-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
                  <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
                </div>
              ))}
        </CarouselRow>
      )}

      {/* Regional & Classic Highlights when Movies tab or All tab is active */}
      {homeTab !== 'series' && hindiMovies.length > 0 && (
        <CarouselRow title="Hindi Cinema">
          {hindiMovies.slice(0, 14).map((item) => (
            <div key={`hi-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {homeTab !== 'series' && bengaliMovies.length > 0 && (
        <CarouselRow title="Bengali Cinema">
          {bengaliMovies.slice(0, 14).map((item) => (
            <div key={`bn-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Top Rated Carousel */}
      {topRatedFiltered.length > 0 && (
        <CarouselRow title="Top Rated">
          {topRatedFiltered.map((item) => (
            <div key={`top-${item.mediaType}-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Public Domain Archive Classics */}
      {homeTab === 'movies' && publicDomainMovies.length > 0 && (
        <CarouselRow title="Open Archive Classics">
          {publicDomainMovies.slice(0, 12).map((item) => (
            <div key={`pd-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {homeTab === 'series' && publicDomainSeries.length > 0 && (
        <CarouselRow title="Classic Broadcast Series">
          {publicDomainSeries.slice(0, 12).map((item) => (
            <div key={`pds-${item.id}`} className="shrink-0 w-[142px] sm:w-[164px]">
              <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
            </div>
          ))}
        </CarouselRow>
      )}

      {/* Browse by Genre */}
      <section className="space-y-4">
        <div className="px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-5 rounded-full bg-[#E50914] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
              Browse by Genre
            </h2>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {genres.map((genre) => {
              const active = genre.id === selectedGenreId;
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => setSelectedGenreId(genre.id)}
                  className={`relative min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-white'
                      : 'bg-white/[0.05] text-slate-300 border border-white/[0.10] hover:text-white hover:bg-white/[0.10]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="home-genre-liquid"
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                      className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/30"
                    />
                  )}
                  <span className="relative z-10">{genre.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-2">
          {genreItems.length > 0 ? (
            genreItems.map((item) => (
              <div
                key={`genre-${selectedGenreId}-${item.mediaType}-${item.id}`}
                className="shrink-0 w-[142px] sm:w-[164px]"
              >
                <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-slate-400">
              No titles in this genre.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
