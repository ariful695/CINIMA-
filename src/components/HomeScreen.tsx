import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  X,
} from 'lucide-react';
import { TMDB_GENRES } from '../data/curatedCatalog';
import { archiveMovieService } from '../services/archiveMovieService';
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

interface CarouselRowProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const CarouselRow: React.FC<CarouselRowProps> = ({ title, children }) => {
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
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
          {title}
        </h2>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            aria-label={`Scroll ${title} left`}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/15 text-slate-200 hover:text-white hover:bg-white/[0.14] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount('right')}
            aria-label={`Scroll ${title} right`}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/15 text-slate-200 hover:text-white hover:bg-white/[0.14] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
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
    openMediaDetails,
    startPlayback,
    isInWatchlist,
    toggleWatchlist,
    openServerPicker,
  } = useAppState();

  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
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
  const [genres, setGenres] = useState<Genre[]>(TMDB_GENRES);
  const [selectedGenreId, setSelectedGenreId] = useState<number>(878);
  const [genreItems, setGenreItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [homeTab, setHomeTab] = useState<'all' | 'movies' | 'series'>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  useEffect(() => {
    let active = true;
    const loadHomeData = async () => {
      setIsLoading(true);
      const [
        moviesRes,
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
      ] = await Promise.all([
        tmdbService.getTrendingMovies(),
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
      ]);

      if (!active) return;
      setTrendingMovies(dvMovies.length > 0 ? dvMovies : moviesRes.items);
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
    const combined = [...trendingMovies.slice(0, 3), ...popularSeries.slice(0, 2)];
    return combined.length > 0 ? combined : topRated.slice(0, 5);
  }, [trendingMovies, popularSeries, topRated]);

  useEffect(() => {
    if (heroSlides.length <= 1 || heroPaused) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroPaused]);

  const activeHero = heroSlides[heroIndex % Math.max(1, heroSlides.length)];
  const heroSaved = activeHero ? isInWatchlist(activeHero.id, activeHero.mediaType) : false;

  const handleHeroPlay = useCallback((item: MediaItem) => {
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
    });
  }, [openServerPicker]);

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

  const heroGenreNames = useMemo(() => {
    if (!activeHero) return '';
    return activeHero.genreIds
      .map((id) => genres.find((g) => g.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(' / ');
  }, [activeHero, genres]);

  return (
    <div className="pb-10 space-y-8">
      {/* Featured Auto-Rotating Hero Banner */}
      {activeHero ? (
        <section
          className="relative w-full min-h-[390px] sm:min-h-[460px] lg:min-h-[520px] overflow-hidden bg-[#0B0D12]"
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
              <MediaPosterImage
                path={activeHero.backdropPath || activeHero.posterPath}
                fallbackSrc={activeHero.fallbackBackdrop || activeHero.fallbackPoster}
                size="w1280"
                alt={`${activeHero.title} backdrop`}
                titleForFallback={activeHero.title}
                className="h-full w-full object-cover"
              />
            </motion.div>
          </AnimatePresence>

          {/* Subtle bottom-left edge scrims so hero artwork stays crisp & vibrant */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07090E]/65 via-[#07090E]/15 to-transparent" />

          {/* Centered Play Button Overlay in the middle of the hero banner */}
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <button
              type="button"
              onClick={() => handleHeroPlay(activeHero)}
              aria-label={`Play ${activeHero.title}`}
              className="pointer-events-auto h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-all active:scale-95 group"
            >
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-current ml-1" />
              </div>
            </button>
          </div>

          <div className="relative z-10 flex flex-col justify-end min-h-[390px] sm:min-h-[460px] lg:min-h-[520px] px-4 sm:px-6 lg:px-8 pb-8 sm:pb-10 max-w-4xl">
            {/* Metadata badges row matching reference screenshot */}
            <div className="flex flex-wrap items-center gap-2">
              {activeHero.releaseDate && (
                <div className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5">
                  <span className="text-slate-400">📅</span>
                  <span>{String(activeHero.releaseDate).slice(0, 4)}</span>
                </div>
              )}
              <div className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5">
                <span className="text-slate-400">🎬</span>
                <span>{activeHero.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
              </div>
              {activeHero.voteAverage > 0 && (
                <div className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 font-mono-tabular">
                  <span className="px-1 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[10px]">IMDb</span>
                  <span>{activeHero.voteAverage.toFixed(1)}/10</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => toggleWatchlist(activeHero)}
                aria-label={heroSaved ? 'In Watchlist' : 'Add to Watchlist'}
                className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all shrink-0"
              >
                {heroSaved ? <Check className="h-4 w-4 text-emerald-400" /> : <span className="text-lg font-bold leading-none">+</span>}
              </button>
            </div>

            {/* Hero Slide Indicators */}
            {heroSlides.length > 1 && (
              <div className="mt-4 flex items-center justify-center sm:justify-start gap-1.5">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={`${slide.mediaType}-${slide.id}`}
                    type="button"
                    onClick={() => setHeroIndex(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === (heroIndex % heroSlides.length)
                        ? 'w-7 bg-white'
                        : 'w-2.5 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}

          </div>
        </section>
      ) : (
        <div className="h-[390px] w-full bg-[#161B26] animate-pulse" />
      )}

      {/* Category Tab Selector (All / Movies / Series) polished */}
      <div className="flex flex-col items-center justify-center pt-2 pb-2">
        <div className="flex items-center gap-10 text-sm sm:text-base font-semibold text-slate-300">
          {(['all', 'movies', 'series'] as const).map((tab) => {
            const active = homeTab === tab;
            const label = tab === 'all' ? 'All' : tab === 'movies' ? 'Movies' : 'Series';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setHomeTab(tab)}
                className={`relative pb-2.5 transition-all uppercase tracking-widest text-xs sm:text-sm ${
                  active ? 'text-white font-black scale-105' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Continue Watching Carousel */}
      {continueWatching.length > 0 && (
        <CarouselRow title="Continue Watching">
          {continueWatching.map((progress) => {
            const ratio =
              progress.duration > 0 ? progress.currentTime / progress.duration : 0.1;
            return (
              <div
                key={progress.key}
                className="relative group shrink-0 w-[232px] sm:w-[272px]"
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
                  className="relative aspect-video overflow-hidden rounded-2xl bg-white/[0.04] border border-white/[0.15] shadow-[0_12px_28px_rgba(0,0,0,0.4)] cursor-pointer"
                >
                  <MediaPosterImage
                    path={progress.backdropPath || progress.posterPath}
                    fallbackSrc={progress.fallbackBackdrop || progress.fallbackPoster}
                    size="w780"
                    alt={progress.title}
                    titleForFallback={progress.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-11 w-11 rounded-full bg-black/55 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white group-hover:bg-[#E50914] group-hover:border-[#E50914] transition-colors">
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
                    className="absolute top-2 right-2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-slate-200 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                    <div
                      className="h-full bg-[#E50914]"
                      style={{ width: `${Math.min(100, Math.max(5, ratio * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 px-0.5">
                  <h3 className="text-sm font-semibold text-slate-100 truncate">
                    {progress.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono-tabular truncate mt-0.5">
                    {progress.mediaType === 'tv' && progress.seasonNumber && progress.episodeNumber
                      ? `S${progress.seasonNumber} E${progress.episodeNumber} · `
                      : ''}
                    {formatRemaining(progress.currentTime, progress.duration)}
                  </p>
                </div>
              </div>
            );
          })}
        </CarouselRow>
      )}



      {/* Top 10 Today Section enhanced & zoomed */}
      <section className="space-y-4">
        <div className="flex flex-col px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 rounded-full bg-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.6)]" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Top 10 today
            </h2>
          </div>
          <p className="text-xs text-slate-400 pl-4">Updated daily · Most watched titles</p>
        </div>

        <div className="flex gap-5 sm:gap-7 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-4 pt-2 scroll-smooth">
          {(trendingMovies.length > 0 ? trendingMovies : topRated).slice(0, 10).map((item, idx) => (
            <div key={`top10-${item.id}`} className="relative shrink-0 flex items-center group cursor-pointer py-2">
              <span className="text-[130px] sm:text-[180px] font-black font-display bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent [-webkit-text-stroke:2px_rgba(229,9,20,0.5)] select-none z-0 -mr-12 sm:-mr-16 translate-y-5 drop-shadow-[0_15px_30px_rgba(0,0,0,0.95)]">
                {idx + 1}
              </span>
              <div className="relative z-10 w-[155px] sm:w-[190px] transition-all duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-2 group-hover:brightness-110">
                <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular TV Series Carousel */}
      <CarouselRow title="Popular TV Series">
        {isLoading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="shrink-0 w-[132px] sm:w-[152px] aspect-[2/3] rounded-2xl liquid-glass liquid-skeleton"
              />
            ))
          : popularSeries.map((item) => (
              <div key={`tv-${item.id}`} className="shrink-0 w-[132px] sm:w-[152px]">
                <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
              </div>
            ))}
      </CarouselRow>

      {/* Top Rated Carousel */}
      <CarouselRow title="Top Rated">
        {topRated.map((item) => (
          <div key={`top-${item.mediaType}-${item.id}`} className="shrink-0 w-[132px] sm:w-[152px]">
            <MediaCard item={item} posterOnly onQuickPlay={handleHeroPlay} />
          </div>
        ))}
      </CarouselRow>

      {/* Browse by Genre */}
      <section className="space-y-4">
        <div className="px-4 sm:px-6 lg:px-8 space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
            Browse by Genre
          </h2>

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
                className="shrink-0 w-[132px] sm:w-[152px]"
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
