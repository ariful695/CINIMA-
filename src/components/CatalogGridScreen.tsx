import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { CURATED_MOVIES, CURATED_SERIES, TMDB_GENRES } from '../data/curatedCatalog';
import { archiveMovieService } from '../services/archiveMovieService';
import { dejavuApiService } from '../services/dejavuApiService';
import { tmdbService } from '../services/tmdbService';
import { useAppState } from '../state/AppContext';
import { Genre, MediaItem, MediaType, THEME_ACCENTS } from '../types/media';
import {
  DISCOVER_COUNTRIES,
  DISCOVER_YEARS,
  GenreSelectionFilter,
} from './GenreSelectionFilter';
import { MediaCard } from './MediaCard';

interface CatalogGridScreenProps {
  mediaType: MediaType;
}

type SortOption = 'popular' | 'rating' | 'newest';

export const CatalogGridScreen: React.FC<CatalogGridScreenProps> = ({ mediaType }) => {
  const { catalogRefreshTick, openServerPicker, themeColor } = useAppState();
  const accent = THEME_ACCENTS[themeColor || 'red'];

  const [items, setItems] = useState<MediaItem[]>(
    mediaType === 'movie' ? CURATED_MOVIES : CURATED_SERIES
  );
  const [discoverItems, setDiscoverItems] = useState<MediaItem[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [genres, setGenres] = useState<Genre[]>(TMDB_GENRES);
  const [selectedGenre, setSelectedGenre] = useState<number | 'all' | 'archive'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedGenre('all');
    setSelectedCountry('all');
    setSelectedYear('all');
    setDiscoverPage(1);
  }, [mediaType]);

  // Load initial catalog items (Archive + Dejavu + Trending/Popular + Top Rated)
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [primaryRes, topRes, dvTrending, dvLatest, archiveRes] = await Promise.all([
        mediaType === 'movie'
          ? tmdbService.getTrendingMovies()
          : tmdbService.getPopularTvSeries(),
        tmdbService.getTopRated(),
        dejavuApiService.isConfigured()
          ? mediaType === 'movie'
            ? dejavuApiService.getTrendingMovies()
            : dejavuApiService.getTrendingTvShows()
          : Promise.resolve([]),
        dejavuApiService.isConfigured()
          ? mediaType === 'movie'
            ? dejavuApiService.getLatestMovies()
            : dejavuApiService.getLatestTvShows()
          : Promise.resolve([]),
        mediaType === 'movie'
          ? archiveMovieService.fetchLivePublicDomainMovies()
          : archiveMovieService.fetchLivePublicDomainSeries(),
      ]);

      if (!active) return;

      const dejavuItems = [...dvTrending, ...dvLatest];
      const mergedMap = new Map<string, MediaItem>();

      const sourcePool = [
        ...archiveRes,
        ...(dejavuItems.length > 0 ? dejavuItems : []),
        ...(primaryRes.isLive ? primaryRes.items : []),
        ...topRes.items,
      ];

      for (const item of sourcePool) {
        if (item.mediaType === mediaType) {
          const key = item.archiveIdentifier || item.dejavuId || String(item.id);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, item);
          }
        }
      }
      const resolved = Array.from(mergedMap.values());
      setItems(
        resolved.length > 0
          ? resolved
          : mediaType === 'movie'
          ? CURATED_MOVIES
          : CURATED_SERIES
      );
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [mediaType, catalogRefreshTick]);

  // Load TMDB genres matching the current mediaType (movie / tv)
  useEffect(() => {
    let active = true;
    void tmdbService.getGenresByType(mediaType).then((genreRes) => {
      if (!active) return;
      setGenres(genreRes);
      setSelectedGenre((prev) =>
        typeof prev === 'number' && !genreRes.some((g) => g.id === prev) ? 'all' : prev
      );
    });
    return () => {
      active = false;
    };
  }, [mediaType, catalogRefreshTick]);

  const isDiscoverActive =
    selectedGenre !== 'archive' &&
    (typeof selectedGenre === 'number' ||
      selectedCountry !== 'all' ||
      selectedYear !== 'all' ||
      sortBy !== 'popular' ||
      discoverPage > 1);

  // Query TMDB Discover API whenever category, country, year, sort, or page is active
  useEffect(() => {
    if (!isDiscoverActive) {
      setDiscoverItems([]);
      setDiscoverTotalPages(1);
      return;
    }

    let active = true;
    const runDiscover = async () => {
      if (discoverPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const genreId = typeof selectedGenre === 'number' ? selectedGenre : null;
      const discoverRes = await tmdbService.discoverCatalog({
        type: mediaType,
        genreId,
        year: selectedYear,
        country: selectedCountry,
        sortBy,
        page: discoverPage,
      });

      if (!active) return;

      setDiscoverItems((prev) => {
        if (discoverPage === 1) return discoverRes.items;
        const nextMap = new Map<string, MediaItem>();
        for (const existing of prev) {
          const k = `${existing.mediaType}-${existing.archiveIdentifier || existing.dejavuId || existing.id}`;
          nextMap.set(k, existing);
        }
        for (const item of discoverRes.items) {
          const k = `${item.mediaType}-${item.archiveIdentifier || item.dejavuId || item.id}`;
          if (!nextMap.has(k)) nextMap.set(k, item);
        }
        return Array.from(nextMap.values());
      });
      setDiscoverTotalPages(discoverRes.totalPages);
      setLoading(false);
      setLoadingMore(false);
    };

    void runDiscover();
    return () => {
      active = false;
    };
  }, [
    isDiscoverActive,
    mediaType,
    selectedGenre,
    selectedCountry,
    selectedYear,
    sortBy,
    discoverPage,
    catalogRefreshTick,
  ]);

  const filteredItems = useMemo(() => {
    if (isDiscoverActive) {
      return discoverItems;
    }

    const base =
      selectedGenre === 'archive'
        ? items.filter((i) => {
            if (!i.isPublicDomain) return false;
            if (selectedYear !== 'all') {
              const y = parseInt((i.releaseDate || '').slice(0, 4), 10);
              if (selectedYear === '2020s') return y >= 2020 && y <= 2029;
              if (selectedYear === '2010s') return y >= 2010 && y <= 2019;
              if (selectedYear === '2000s') return y >= 2000 && y <= 2009;
              if (selectedYear === '1990s') return y >= 1990 && y <= 1999;
              if (selectedYear === 'pre1990') return y > 0 && y < 1990;
              return String(y) === selectedYear;
            }
            return true;
          })
        : items;

    return [...base].sort((a, b) => {
      if (sortBy === 'rating') return b.voteAverage - a.voteAverage;
      if (sortBy === 'newest') {
        return String(b.releaseDate ?? '').localeCompare(String(a.releaseDate ?? ''));
      }
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [isDiscoverActive, discoverItems, items, selectedGenre, selectedYear, sortBy]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (selectedGenre === 'archive') {
      labels.push('Classics');
    } else if (typeof selectedGenre === 'number') {
      const g = genres.find((item) => item.id === selectedGenre);
      if (g) labels.push(g.name);
    }
    if (selectedCountry !== 'all') {
      const c = DISCOVER_COUNTRIES.find((item) => item.code === selectedCountry);
      labels.push(c ? c.label : selectedCountry);
    }
    if (selectedYear !== 'all') {
      const y = DISCOVER_YEARS.find((item) => item.value === selectedYear);
      labels.push(y ? y.label : selectedYear);
    }
    return labels;
  }, [selectedGenre, genres, selectedCountry, selectedYear]);

  const resetAllFilters = useCallback(() => {
    setSelectedGenre('all');
    setSelectedCountry('all');
    setSelectedYear('all');
    setSortBy('popular');
    setDiscoverPage(1);
  }, []);

  const handleQuickPlay = useCallback(
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
        releaseYear: item.releaseDate
          ? parseInt(item.releaseDate.slice(0, 4), 10) || undefined
          : undefined,
        seasonNumber: item.mediaType === 'tv' ? 1 : undefined,
        episodeNumber: item.mediaType === 'tv' ? 1 : undefined,
      });
    },
    [openServerPicker]
  );

  const headingTitle = mediaType === 'movie' ? 'Movies' : 'TV Series';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5 overflow-x-clip">
      {/* Header with Clean Title & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {headingTitle}
        </h1>

        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-xl liquid-glass w-full sm:w-auto">
          {(
            [
              { id: 'popular', label: 'Trending' },
              { id: 'rating', label: 'Top Rated' },
              { id: 'newest', label: 'Newest' },
            ] as const
          ).map((opt) => {
            const active = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSortBy(opt.id);
                  setDiscoverPage(1);
                }}
                className={`relative min-h-[38px] px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium text-center transition-colors whitespace-nowrap ${
                  active ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`catalog-sort-liquid-${mediaType}`}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="absolute inset-0 rounded-lg bg-white/[0.15] border border-white/25 shadow-sm"
                  />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Genre, Country & Year Selection Filter (TMDB Discover API) */}
      <GenreSelectionFilter
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreChange={(nextGenre) => {
          setSelectedGenre(nextGenre);
          setDiscoverPage(1);
        }}
        selectedCountry={selectedCountry}
        onCountryChange={(nextCountry) => {
          setSelectedCountry(nextCountry);
          setDiscoverPage(1);
        }}
        selectedYear={selectedYear}
        onYearChange={(nextYear) => {
          setSelectedYear(nextYear);
          setDiscoverPage(1);
        }}
        accentHex={accent.hex}
        layoutPrefix={`catalog-${mediaType}`}
        activeFilterLabels={activeFilterLabels}
        onResetAll={resetAllFilters}
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[2/3] rounded-2xl liquid-glass liquid-skeleton"
            />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {filteredItems.map((item) => (
              <MediaCard
                key={`${item.mediaType}-grid-${item.archiveIdentifier || item.id}`}
                item={item}
                onQuickPlay={handleQuickPlay}
              />
            ))}
          </div>

          {selectedGenre !== 'archive' &&
            (!isDiscoverActive || discoverPage < discoverTotalPages) && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    if (isDiscoverActive) {
                      setDiscoverPage((prev) => prev + 1);
                    } else {
                      setDiscoverItems(items);
                      setDiscoverPage(2);
                    }
                  }}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl liquid-glass hover:bg-white/[0.12] border border-white/20 text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <span>Load More Results</span>
                  )}
                </button>
              </div>
            )}
        </div>
      ) : (
        <div className="rounded-2xl liquid-glass p-10 text-center space-y-3">
          <p className="text-sm text-slate-300">
            No {mediaType === 'movie' ? 'movies' : 'series'} match your current filters.
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}
    </div>
  );
};
