import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, User, X } from 'lucide-react';
import { TMDB_GENRES } from '../data/curatedCatalog';
import { archiveMovieService } from '../services/archiveMovieService';
import { dejavuApiService } from '../services/dejavuApiService';
import { storageService } from '../services/storageService';
import { getTmdbImageUrl, tmdbService } from '../services/tmdbService';
import { useAppState } from '../state/AppContext';
import { Genre, MediaItem, PersonSearchResult } from '../types/media';
import { MediaPosterImage } from './MediaPosterImage';

type SearchTypeFilter = 'all' | 'movie' | 'tv';
type OpenDropdown = 'none' | 'type' | 'genre' | 'year';

const YEAR_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Year' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
  { value: '2010s', label: '2010s' },
  { value: '2000s', label: '2000s' },
  { value: 'Classic', label: 'Classic (< 2000)' },
];

const TYPE_OPTIONS: Array<{ value: SearchTypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'Series' },
];

export const SearchScreen: React.FC = () => {
  const { openMediaDetails, catalogRefreshTick } = useAppState();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [typeFilter, setTypeFilter] = useState<SearchTypeFilter>('all');
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>('none');

  const [genres, setGenres] = useState<Genre[]>(TMDB_GENRES);
  const [trendingToday, setTrendingToday] = useState<MediaItem[]>([]);
  const [discoverResults, setDiscoverResults] = useState<MediaItem[]>([]);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void tmdbService.getGenres().then(setGenres);
  }, []);

  // Load Trending Today on mount and refresh
  useEffect(() => {
    let active = true;
    const loadTrending = async () => {
      setLoading(true);
      const items = await tmdbService.getTrendingToday();
      if (active) {
        setTrendingToday(items);
        setLoading(false);
      }
    };
    void loadTrending();
    return () => {
      active = false;
    };
  }, [catalogRefreshTick]);

  // Close dropdown menus on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown('none');
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown('none');
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Debounce search query (350ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Run multi-search when query is present
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setPeople([]);
      return;
    }

    let active = true;
    const runSearch = async () => {
      setLoading(true);
      const [tmdbData, dejavuResults, archiveResults] = await Promise.all([
        tmdbService.searchMulti(debouncedQuery),
        dejavuApiService.search(debouncedQuery),
        archiveMovieService.searchArchiveMovies(debouncedQuery),
      ]);
      if (!active) return;

      const mergedMap = new Map<string, MediaItem>();
      for (const item of [...dejavuResults, ...tmdbData.moviesAndShows, ...archiveResults]) {
        const key = `${item.mediaType}-${item.title.toLowerCase().trim()}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      }

      setSearchResults(Array.from(mergedMap.values()));
      setPeople(tmdbData.people);
      storageService.addRecentSearch(debouncedQuery);
      setLoading(false);
    };

    void runSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const hasFilters =
    typeFilter !== 'all' || selectedGenreId !== null || selectedYear !== null;

  // Fetch filtered discovery items when dropdown filters are active without a search query
  useEffect(() => {
    if (debouncedQuery || !hasFilters) {
      setDiscoverResults([]);
      return;
    }

    let active = true;
    const runDiscover = async () => {
      setLoading(true);
      const items = await tmdbService.discoverFiltered({
        type: typeFilter,
        genreId: selectedGenreId,
        year: selectedYear,
      });
      if (active) {
        setDiscoverResults(items);
        setLoading(false);
      }
    };

    void runDiscover();
    return () => {
      active = false;
    };
  }, [debouncedQuery, hasFilters, typeFilter, selectedGenreId, selectedYear]);

  const displayedItems = useMemo(() => {
    if (debouncedQuery) {
      return searchResults.filter((item) => {
        if (typeFilter !== 'all' && item.mediaType !== typeFilter) return false;
        if (selectedGenreId && !item.genreIds.includes(selectedGenreId)) return false;
        if (selectedYear) {
          const y = parseInt(String(item.releaseDate ?? '').slice(0, 4), 10);
          if (selectedYear === '2010s') return y >= 2010 && y <= 2019;
          if (selectedYear === '2000s') return y >= 2000 && y <= 2009;
          if (selectedYear === 'Classic') return y > 0 && y < 2000;
          return String(y) === selectedYear;
        }
        return true;
      });
    }

    if (hasFilters) {
      return discoverResults;
    }

    return trendingToday;
  }, [
    debouncedQuery,
    searchResults,
    hasFilters,
    discoverResults,
    trendingToday,
    typeFilter,
    selectedGenreId,
    selectedYear,
  ]);

  const selectedTypeLabel =
    TYPE_OPTIONS.find((t) => t.value === typeFilter)?.label || 'All types';
  const selectedGenreLabel =
    genres.find((g) => g.id === selectedGenreId)?.name || 'Genre';
  const selectedYearLabel =
    YEAR_OPTIONS.find((y) => y.value === selectedYear)?.label || 'Year';

  const sectionTitle = debouncedQuery
    ? `RESULTS FOR "${debouncedQuery.toUpperCase()}"`
    : hasFilters
    ? 'FILTERED RESULTS'
    : 'TRENDING TODAY';

  return (
    <div className="min-h-screen bg-[#07090E] max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-28 space-y-6">
      {/* Bold Two-Line Editorial Header */}
      <h1 className="font-display text-[32px] sm:text-4xl font-extrabold tracking-tight text-white leading-[1.06]">
        Find
        <br />
        something.
      </h1>

      {/* Search Input & Filter Dropdowns */}
      <div className="space-y-3.5" ref={filterBarRef}>
        <div className="relative">
          <Search className="h-4.5 w-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Movies, series, anime"
            aria-label="Movies, series, anime"
            className="w-full min-h-[48px] pl-11 pr-11 rounded-2xl bg-[#141418] border border-white/[0.12] text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-white/30 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 3 Filter Dropdown Buttons (All types | Genre | Year) */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Type Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenDropdown(openDropdown === 'type' ? 'none' : 'type')
              }
              className={`w-full min-h-[42px] px-3 sm:px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-1.5 transition-colors ${
                typeFilter !== 'all'
                  ? 'bg-white text-slate-950 border-white font-semibold'
                  : 'bg-[#141418] hover:bg-[#1B1B21] border-white/[0.12] text-slate-300'
              }`}
            >
              <span className="truncate">{selectedTypeLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>

            {openDropdown === 'type' && (
              <div className="absolute left-0 top-12 w-44 rounded-2xl bg-[#16161C] border border-white/15 p-1.5 shadow-2xl z-30 space-y-0.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTypeFilter(opt.value);
                      setOpenDropdown('none');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                      typeFilter === opt.value
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {typeFilter === opt.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Genre Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenDropdown(openDropdown === 'genre' ? 'none' : 'genre')
              }
              className={`w-full min-h-[42px] px-3 sm:px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-1.5 transition-colors ${
                selectedGenreId !== null
                  ? 'bg-white text-slate-950 border-white font-semibold'
                  : 'bg-[#141418] hover:bg-[#1B1B21] border-white/[0.12] text-slate-300'
              }`}
            >
              <span className="truncate">{selectedGenreLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>

            {openDropdown === 'genre' && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-12 w-52 max-h-72 overflow-y-auto rounded-2xl bg-[#16161C] border border-white/15 p-1.5 shadow-2xl z-30 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGenreId(null);
                    setOpenDropdown('none');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                    selectedGenreId === null
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <span>All Genres</span>
                  {selectedGenreId === null && <Check className="h-3.5 w-3.5" />}
                </button>
                {genres.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGenreId(g.id);
                      setOpenDropdown('none');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                      selectedGenreId === g.id
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    {selectedGenreId === g.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenDropdown(openDropdown === 'year' ? 'none' : 'year')
              }
              className={`w-full min-h-[42px] px-3 sm:px-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-1.5 transition-colors ${
                selectedYear !== null
                  ? 'bg-white text-slate-950 border-white font-semibold'
                  : 'bg-[#141418] hover:bg-[#1B1B21] border-white/[0.12] text-slate-300'
              }`}
            >
              <span className="truncate">{selectedYearLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>

            {openDropdown === 'year' && (
              <div className="absolute right-0 top-12 w-48 max-h-72 overflow-y-auto rounded-2xl bg-[#16161C] border border-white/15 p-1.5 shadow-2xl z-30 space-y-0.5">
                {YEAR_OPTIONS.map((yr) => (
                  <button
                    key={yr.label}
                    type="button"
                    onClick={() => {
                      setSelectedYear(yr.value);
                      setOpenDropdown('none');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                      selectedYear === yr.value
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span>{yr.value === null ? 'All Years' : yr.label}</span>
                    {selectedYear === yr.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* People Strip (when searching without filters) */}
      {debouncedQuery && people.length > 0 && typeFilter === 'all' && !selectedGenreId && !selectedYear && (
        <section className="space-y-2.5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
            PEOPLE
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {people.slice(0, 8).map((person) => {
              const imgUrl = getTmdbImageUrl(person.profilePath, 'w185');
              return (
                <div
                  key={person.id}
                  className="shrink-0 w-44 p-2.5 rounded-2xl bg-[#141418] border border-white/[0.10] flex items-center gap-2.5"
                >
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={person.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {person.knownForTitles[0] || person.knownForDepartment}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ranked / Filtered Media List */}
      <section className="pt-1">
        <div className="flex items-center justify-between border-b border-white/[0.10] pb-3">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase truncate">
            {sectionTitle}
          </h2>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setSelectedGenreId(null);
                setSelectedYear(null);
              }}
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-white/[0.06]">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="py-3.5 flex items-center gap-4">
                <div className="w-9 h-7 rounded bg-white/[0.06] animate-pulse shrink-0" />
                <div className="w-14 sm:w-16 aspect-[2/3] rounded-xl bg-white/[0.08] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-white/[0.05] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedItems.length > 0 ? (
          <div className="divide-y divide-white/[0.07]">
            {displayedItems.map((item, idx) => {
              const rankText = String(idx + 1).padStart(2, '0');
              const yearText = item.releaseDate ? String(item.releaseDate).slice(0, 4) : '';
              const typeText = item.mediaType === 'tv' ? 'Series' : 'Movie';
              const metaParts = [typeText, yearText, '1080p'].filter(Boolean);

              return (
                <button
                  key={`${item.mediaType}-${item.id}-${idx}`}
                  type="button"
                  onClick={() => openMediaDetails(item.id, item.mediaType, item)}
                  className="w-full py-3.5 flex items-center gap-3.5 sm:gap-4 text-left hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors rounded-xl px-1 -mx-1"
                >
                  <span
                    className={`w-8 sm:w-10 shrink-0 font-display text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${
                      idx < 2 ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {rankText}
                  </span>

                  <div className="w-12 sm:w-14 aspect-[2/3] rounded-xl overflow-hidden bg-[#141418] border border-white/[0.10] shrink-0">
                    <MediaPosterImage
                      path={item.posterPath}
                      fallbackSrc={item.fallbackPoster || item.fallbackBackdrop}
                      size="w185"
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 truncate">
                      {metaParts.join(' · ')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-300">
              {debouncedQuery
                ? `No results found for "${debouncedQuery}".`
                : 'No titles match the selected filters.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setSelectedGenreId(null);
                  setSelectedYear(null);
                }}
                className="text-xs font-semibold text-white underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
