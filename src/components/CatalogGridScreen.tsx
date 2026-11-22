import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, RotateCcw, Subtitles, Volume2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { CURATED_MOVIES, CURATED_SERIES, TMDB_GENRES } from '../data/curatedCatalog';
import { archiveMovieService } from '../services/archiveMovieService';
import { bengaliSerialService } from '../services/bengaliSerialService';
import { dejavuApiService } from '../services/dejavuApiService';
import { tmdbService } from '../services/tmdbService';
import { useAppState } from '../state/AppContext';
import { Genre, MediaItem, MediaType, THEME_ACCENTS } from '../types/media';
import { MediaCard } from './MediaCard';

interface CatalogGridScreenProps {
  mediaType: MediaType;
}

type SortOption = 'popular' | 'rating' | 'newest';
type LanguageMode = 'all' | 'audio' | 'subtitle';

interface LanguageOption {
  id: string;
  label: string;
  nativeLabel?: string;
}

const BASE_LANGUAGES: LanguageOption[] = [
  { id: 'all', label: 'All Languages' },
  { id: 'en', label: 'English', nativeLabel: 'EN' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { id: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { id: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { id: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { id: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { id: 'fr', label: 'French', nativeLabel: 'Français' },
  { id: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { id: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { id: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { id: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { id: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { id: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
];

const LANGUAGE_NAME_MAP: Record<string, string> = Object.fromEntries(
  BASE_LANGUAGES.map((l) => [l.id, l.label])
);

function formatLangCode(code: string): string {
  const clean = code.trim().toLowerCase();
  if (LANGUAGE_NAME_MAP[clean]) return LANGUAGE_NAME_MAP[clean];
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    return dn.of(clean) || clean.toUpperCase();
  } catch {
    return clean.toUpperCase();
  }
}

function itemMatchesLanguage(
  item: MediaItem,
  lang: string,
  mode: LanguageMode
): boolean {
  if (lang === 'all') return true;
  const target = lang.toLowerCase();
  const orig = (item.originalLanguage || '').trim().toLowerCase();
  const audioSet = new Set(
    [orig, ...(item.audioLanguages || []).map((l) => l.toLowerCase())].filter(Boolean)
  );
  const subSet = new Set(
    (item.subtitleLanguages || []).map((l) => l.toLowerCase()).filter(Boolean)
  );

  // Also check explicit metadata hints in title/overview for subtitle/dub releases
  const metaText = `${item.title} ${item.overview} ${item.archiveIdentifier || ''}`.toLowerCase();
  if (target === 'en' && /\besub\b|\beng[\s._-]*sub|\benglish[\s._-]*sub/.test(metaText)) {
    subSet.add('en');
  }
  if (target === 'hi' && /\bhindi\b/.test(metaText)) {
    if (/\bsub\b/.test(metaText)) subSet.add('hi');
    else audioSet.add('hi');
  }
  if (target === 'bn' && /\bbengali\b|\bbangla\b/.test(metaText)) {
    if (/\bsub\b/.test(metaText)) subSet.add('bn');
    else audioSet.add('bn');
  }

  const matchesAudio = audioSet.has(target);
  const matchesSubtitle =
    subSet.has(target) ||
    (target === 'en' && Boolean(orig) && orig !== 'en') ||
    (target !== 'en' && orig === target && subSet.size === 0);

  if (mode === 'audio') return matchesAudio;
  if (mode === 'subtitle') return matchesSubtitle;
  return matchesAudio || matchesSubtitle;
}

export const CatalogGridScreen: React.FC<CatalogGridScreenProps> = ({ mediaType }) => {
  const { catalogRefreshTick, openServerPicker, themeColor } = useAppState();
  const accent = THEME_ACCENTS[themeColor || 'red'];

  const [items, setItems] = useState<MediaItem[]>(
    mediaType === 'movie' ? CURATED_MOVIES : CURATED_SERIES
  );
  const [languageItems, setLanguageItems] = useState<MediaItem[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [languageMode, setLanguageMode] = useState<LanguageMode>('all');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const [genres, setGenres] = useState<Genre[]>(TMDB_GENRES);
  const [selectedGenre, setSelectedGenre] = useState<number | 'all' | 'archive'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node)
      ) {
        setLangDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [primaryRes, topRes, genreRes, dvTrending, dvLatest, archiveRes] = await Promise.all([
        mediaType === 'movie'
          ? tmdbService.getTrendingMovies()
          : tmdbService.getPopularTvSeries(),
        tmdbService.getTopRated(),
        tmdbService.getGenres(),
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
      setGenres(genreRes);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [mediaType, catalogRefreshTick]);

  useEffect(() => {
    if (selectedLanguage === 'all') {
      setLanguageItems([]);
      return;
    }

    let active = true;
    const loadByLang = async () => {
      setLoading(true);
      const needsAudioFetch = languageMode === 'all' || languageMode === 'audio';
      const isArchiveRegional = selectedLanguage === 'bn' || selectedLanguage === 'hi';

      const [tmdbOrig, tmdbSpoken, archiveLang, bnSubArchive, hiSubArchive, bengaliCatalog] = await Promise.all([
        needsAudioFetch
          ? mediaType === 'movie'
            ? tmdbService.getMoviesByLanguage(selectedLanguage, 'original')
            : tmdbService.getTvByLanguage(selectedLanguage, 'original')
          : Promise.resolve([]),
        languageMode === 'subtitle' && selectedLanguage !== 'en'
          ? mediaType === 'movie'
            ? tmdbService.getMoviesByLanguage(selectedLanguage, 'spoken')
            : tmdbService.getTvByLanguage(selectedLanguage, 'spoken')
          : Promise.resolve([]),
        mediaType === 'movie' && isArchiveRegional
          ? archiveMovieService.fetchLiveArchiveByLanguage(
              selectedLanguage === 'bn' ? 'bengali' : 'hindi',
              12
            )
          : Promise.resolve([]),
        mediaType === 'movie' && languageMode === 'subtitle' && selectedLanguage === 'en'
          ? archiveMovieService.fetchLiveArchiveByLanguage('bengali', 6)
          : Promise.resolve([]),
        mediaType === 'movie' && languageMode === 'subtitle' && selectedLanguage === 'en'
          ? archiveMovieService.fetchLiveArchiveByLanguage('hindi', 6)
          : Promise.resolve([]),
        mediaType === 'tv' && selectedLanguage === 'bn' && needsAudioFetch
          ? bengaliSerialService.getCatalog()
          : Promise.resolve({ zeeBanglaDaily: [], bengaliCartoons: [], updatedAt: 0 }),
      ]);

      if (!active) return;

      const merged = new Map<string, MediaItem>();
      // First keep matching items from the currently loaded movie/series list
      for (const item of items) {
        if (itemMatchesLanguage(item, selectedLanguage, languageMode)) {
          const key = item.archiveIdentifier || item.dejavuId || String(item.id);
          if (!merged.has(key)) merged.set(key, item);
        }
      }

      // Then merge regional Archive, Zee Bangla Daily Serials, and TMDB discoveries for the chosen language
      const bengaliItems = [...bengaliCatalog.zeeBanglaDaily, ...bengaliCatalog.bengaliCartoons];
      for (const item of [...bengaliItems, ...archiveLang, ...bnSubArchive, ...hiSubArchive, ...tmdbOrig, ...tmdbSpoken]) {
        if (item.mediaType !== mediaType) continue;
        // Tag spoken-language TMDB matches when filtering by subtitles
        const enriched: MediaItem =
          languageMode === 'subtitle' &&
          !item.subtitleLanguages?.includes(selectedLanguage)
            ? {
                ...item,
                subtitleLanguages: [
                  ...(item.subtitleLanguages || []),
                  selectedLanguage,
                ],
              }
            : item;
        if (itemMatchesLanguage(enriched, selectedLanguage, languageMode)) {
          const key = enriched.archiveIdentifier || enriched.dejavuId || String(enriched.id);
          if (!merged.has(key)) merged.set(key, enriched);
        }
      }

      setLanguageItems(Array.from(merged.values()));
      setLoading(false);
    };

    void loadByLang();
    return () => {
      active = false;
    };
  }, [selectedLanguage, languageMode, mediaType, items, catalogRefreshTick]);

  // Build available languages including any extra language codes discovered in current list
  const languageOptions = useMemo<LanguageOption[]>(() => {
    const knownIds = new Set(BASE_LANGUAGES.map((l) => l.id));
    const extras: LanguageOption[] = [];
    for (const item of items) {
      const codes = [
        item.originalLanguage,
        ...(item.audioLanguages || []),
        ...(item.subtitleLanguages || []),
      ].filter((c): c is string => Boolean(c));

      for (const raw of codes) {
        const code = raw.trim().toLowerCase();
        if (code && !knownIds.has(code)) {
          knownIds.add(code);
          extras.push({
            id: code,
            label: formatLangCode(code),
            nativeLabel: code.toUpperCase(),
          });
        }
      }
    }
    return [...BASE_LANGUAGES, ...extras];
  }, [items]);

  const currentMatchCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const opt of languageOptions) {
      if (opt.id === 'all') continue;
      counts[opt.id] = items.filter((item) =>
        itemMatchesLanguage(item, opt.id, languageMode)
      ).length;
    }
    return counts;
  }, [items, languageOptions, languageMode]);

  const filteredItems = useMemo(() => {
    const sourceItems = selectedLanguage === 'all' ? items : languageItems;
    const base =
      selectedGenre === 'all'
        ? sourceItems
        : selectedGenre === 'archive'
        ? sourceItems.filter((i) => i.isPublicDomain)
        : sourceItems.filter((i) => i.genreIds.includes(selectedGenre));

    return [...base].sort((a, b) => {
      if (sortBy === 'rating') return b.voteAverage - a.voteAverage;
      if (sortBy === 'newest') {
        return String(b.releaseDate ?? '').localeCompare(String(a.releaseDate ?? ''));
      }
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [items, languageItems, selectedLanguage, selectedGenre, sortBy]);

  const activeLanguageLabel =
    selectedLanguage === 'all'
      ? 'Language'
      : formatLangCode(selectedLanguage);

  const modeBadgeLabel =
    languageMode === 'audio'
      ? 'Audio'
      : languageMode === 'subtitle'
      ? 'Subtitles'
      : 'Audio & Sub';

  const handleQuickPlay = useCallback((item: MediaItem) => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header with Language Filter Dropdown & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {mediaType === 'movie' ? 'Movies' : 'TV Series'}
          </h1>
          {selectedLanguage !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSelectedLanguage('all');
                setLanguageMode('all');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200 text-xs font-semibold hover:bg-sky-500/30 transition-colors"
              aria-label={`Clear ${activeLanguageLabel} filter`}
            >
              <span>
                {activeLanguageLabel} · {modeBadgeLabel}
              </span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Filter Dropdown */}
          <div ref={langDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setLangDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={langDropdownOpen}
              aria-label="Filter by preferred audio or subtitle language"
              className={`min-h-[44px] px-3.5 py-2 rounded-xl liquid-glass flex items-center gap-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedLanguage !== 'all'
                  ? 'text-white border-sky-400/50 bg-sky-500/15'
                  : 'text-slate-200 hover:text-white hover:bg-white/[0.10]'
              }`}
            >
              <Languages
                className={`h-4 w-4 shrink-0 ${
                  selectedLanguage !== 'all' ? 'text-sky-300' : 'text-slate-300'
                }`}
              />
              <span>{activeLanguageLabel}</span>
              {selectedLanguage !== 'all' && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-sky-200 font-bold">
                  {languageMode === 'audio'
                    ? 'Audio'
                    : languageMode === 'subtitle'
                    ? 'Sub'
                    : 'All'}
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                  langDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {langDropdownOpen && (
              <div
                role="listbox"
                aria-label="Preferred audio or subtitle language"
                className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 rounded-2xl liquid-glass-strong p-3 z-30 shadow-2xl space-y-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Audio / Subtitle Language
                  </span>
                  {selectedLanguage !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLanguage('all');
                        setLanguageMode('all');
                        setLangDropdownOpen(false);
                      }}
                      className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Match Mode Switcher: All / Audio / Subtitles */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/45 border border-white/10">
                  {(
                    [
                      { id: 'all', label: 'Audio & Sub', icon: Languages },
                      { id: 'audio', label: 'Audio', icon: Volume2 },
                      { id: 'subtitle', label: 'Subtitles', icon: Subtitles },
                    ] as const
                  ).map((modeOpt) => {
                    const ModeIcon = modeOpt.icon;
                    const active = languageMode === modeOpt.id;
                    return (
                      <button
                        key={modeOpt.id}
                        type="button"
                        onClick={() => setLanguageMode(modeOpt.id)}
                        className={`min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                          active
                            ? 'text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        style={active ? { backgroundColor: accent.hex } : undefined}
                      >
                        <ModeIcon className="h-3 w-3 shrink-0" />
                        <span>{modeOpt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Language Options List */}
                <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
                  {languageOptions.map((lang) => {
                    const isSelected = selectedLanguage === lang.id;
                    const matchCount = currentMatchCounts[lang.id] || 0;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedLanguage(lang.id);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-white/15 text-white font-semibold border border-white/20'
                            : 'text-slate-300 hover:bg-white/[0.08] hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{lang.label}</span>
                          {lang.nativeLabel && (
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {lang.nativeLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {lang.id !== 'all' && matchCount > 0 && (
                            <span className="text-[10px] font-mono-tabular text-slate-400">
                              {matchCount} in list
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-sky-300" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl liquid-glass w-fit">
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
                  onClick={() => setSortBy(opt.id)}
                  className={`relative min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-white font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={`catalog-sort-liquid-${mediaType}`}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                      className="absolute inset-0 rounded-lg bg-white/[0.16] border border-white/30"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Horizontal scrollable genre buttons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedGenre('all')}
          className={`relative min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedGenre === 'all'
              ? 'text-white font-semibold'
              : 'bg-white/[0.05] text-slate-300 border border-white/[0.1] hover:text-white hover:bg-white/[0.09]'
          }`}
        >
          {selectedGenre === 'all' && (
            <motion.span
              layoutId={`catalog-genre-liquid-${mediaType}`}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/30"
            />
          )}
          <span className="relative z-10">All</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedGenre('archive')}
          className={`relative min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedGenre === 'archive'
              ? 'text-white font-semibold'
              : 'bg-white/[0.05] text-slate-300 border border-white/[0.1] hover:text-white hover:bg-white/[0.09]'
          }`}
        >
          {selectedGenre === 'archive' && (
            <motion.span
              layoutId={`catalog-genre-liquid-${mediaType}`}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/30"
            />
          )}
          <span className="relative z-10">Classics</span>
        </button>
        {genres.map((g) => {
          const active = selectedGenre === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGenre(g.id)}
              className={`relative min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'text-white font-semibold'
                  : 'bg-white/[0.05] text-slate-300 border border-white/[0.1] hover:text-white hover:bg-white/[0.09]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`catalog-genre-liquid-${mediaType}`}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/30"
                />
              )}
              <span className="relative z-10">{g.name}</span>
            </button>
          );
        })}
      </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {filteredItems.map((item) => (
            <MediaCard
              key={`${mediaType}-grid-${item.archiveIdentifier || item.id}`}
              item={item}
              onQuickPlay={handleQuickPlay}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl liquid-glass p-10 text-center space-y-3">
          <p className="text-sm text-slate-300">
            No {mediaType === 'movie' ? 'movies' : 'series'} match this genre and language filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedLanguage('all');
              setLanguageMode('all');
              setSelectedGenre('all');
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Continue with All Languages</span>
          </button>
        </div>
      )}
    </div>
  );
};
