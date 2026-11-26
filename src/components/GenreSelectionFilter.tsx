import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, Globe, RotateCcw, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Genre } from '../types/media';

export interface CountryOption {
  code: string;
  label: string;
}

export interface YearOption {
  value: string;
  label: string;
}

export const DISCOVER_COUNTRIES: CountryOption[] = [
  { code: 'all', label: 'All Countries' },
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'BD', label: 'Bangladesh' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'DE', label: 'Germany' },
  { code: 'CA', label: 'Canada' },
  { code: 'CN', label: 'China' },
  { code: 'IT', label: 'Italy' },
  { code: 'TR', label: 'Turkey' },
  { code: 'AU', label: 'Australia' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'TH', label: 'Thailand' },
];

export const DISCOVER_YEARS: YearOption[] = (() => {
  const currentYear = new Date().getFullYear();
  const recentYears: YearOption[] = [];
  for (let y = currentYear; y >= 2018; y -= 1) {
    recentYears.push({ value: String(y), label: String(y) });
  }
  return [
    { value: 'all', label: 'All Years' },
    ...recentYears,
    { value: '2020s', label: '2020s' },
    { value: '2010s', label: '2010s' },
    { value: '2000s', label: '2000s' },
    { value: '1990s', label: '1990s' },
    { value: 'pre1990', label: 'Classic (Pre-1990)' },
  ];
})();

interface GenreSelectionFilterProps {
  genres: Genre[];
  selectedGenre: number | 'all' | 'archive';
  onGenreChange: (genre: number | 'all' | 'archive') => void;
  selectedCountry: string;
  onCountryChange: (country: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  accentHex: string;
  layoutPrefix: string;
  activeFilterLabels?: string[];
  onResetAll?: () => void;
}

export const GenreSelectionFilter: React.FC<GenreSelectionFilterProps> = ({
  genres,
  selectedGenre,
  onGenreChange,
  selectedCountry,
  onCountryChange,
  selectedYear,
  onYearChange,
  accentHex,
  layoutPrefix,
  activeFilterLabels = [],
  onResetAll,
}) => {
  const [openMenu, setOpenMenu] = useState<'none' | 'country' | 'year'>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu('none');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeCountryLabel = useMemo(() => {
    const found = DISCOVER_COUNTRIES.find((c) => c.code === selectedCountry);
    return found ? found.label : selectedCountry;
  }, [selectedCountry]);

  const activeYearLabel = useMemo(() => {
    const found = DISCOVER_YEARS.find((y) => y.value === selectedYear);
    return found ? found.label : selectedYear;
  }, [selectedYear]);

  return (
    <section
      ref={containerRef}
      aria-label="Browse filters by country, year, and category"
      className="relative rounded-2xl liquid-glass p-3 sm:p-4 space-y-3"
    >
      {/* Country & Year Row — anchored cleanly so popovers never clip on mobile edges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="relative grid grid-cols-2 sm:flex sm:items-center gap-2.5">
          {/* Country Dropdown */}
          <div className="sm:relative">
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === 'country' ? 'none' : 'country'))}
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'country'}
              aria-label="Filter by country"
              className={`w-full sm:w-auto sm:min-w-[164px] min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold transition-all duration-150 ${
                selectedCountry !== 'all'
                  ? 'text-white bg-white/[0.12] border border-white/30 shadow-sm'
                  : 'text-slate-200 bg-white/[0.045] border border-white/[0.1] hover:text-white hover:bg-white/[0.08]'
              }`}
              style={
                selectedCountry !== 'all'
                  ? { borderColor: `${accentHex}88`, boxShadow: `0 0 0 1px ${accentHex}33 inset` }
                  : undefined
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Globe
                  className="h-4 w-4 shrink-0"
                  style={selectedCountry !== 'all' ? { color: accentHex } : undefined}
                />
                <span className="truncate">
                  {selectedCountry === 'all' ? 'Country' : activeCountryLabel}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                  openMenu === 'country' ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {openMenu === 'country' && (
              <div
                role="listbox"
                aria-label="Select origin country"
                className="absolute left-0 right-0 sm:right-auto sm:w-64 top-full mt-2 rounded-2xl liquid-glass-strong p-2.5 z-40 shadow-[0_24px_60px_rgba(0,0,0,0.75)] space-y-1.5"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Origin Country
                  </span>
                  {selectedCountry !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        onCountryChange('all');
                        setOpenMenu('none');
                      }}
                      className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                  {DISCOVER_COUNTRIES.map((country) => {
                    const isSelected = selectedCountry === country.code;
                    return (
                      <button
                        key={country.code}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onCountryChange(country.code);
                          setOpenMenu('none');
                        }}
                        className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-white/[0.16] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{country.label}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {country.code !== 'all' && (
                            <span className="text-[11px] font-mono-tabular text-slate-400">
                              {country.code}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentHex }} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Year Dropdown */}
          <div className="sm:relative">
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === 'year' ? 'none' : 'year'))}
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'year'}
              aria-label="Filter by release year"
              className={`w-full sm:w-auto sm:min-w-[144px] min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold transition-all duration-150 ${
                selectedYear !== 'all'
                  ? 'text-white bg-white/[0.12] border border-white/30 shadow-sm'
                  : 'text-slate-200 bg-white/[0.045] border border-white/[0.1] hover:text-white hover:bg-white/[0.08]'
              }`}
              style={
                selectedYear !== 'all'
                  ? { borderColor: `${accentHex}88`, boxShadow: `0 0 0 1px ${accentHex}33 inset` }
                  : undefined
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <Calendar
                  className="h-4 w-4 shrink-0"
                  style={selectedYear !== 'all' ? { color: accentHex } : undefined}
                />
                <span className="truncate">
                  {selectedYear === 'all' ? 'Year' : activeYearLabel}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                  openMenu === 'year' ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {openMenu === 'year' && (
              <div
                role="listbox"
                aria-label="Select release year"
                className="absolute left-0 right-0 sm:right-auto sm:w-56 top-full mt-2 rounded-2xl liquid-glass-strong p-2.5 z-40 shadow-[0_24px_60px_rgba(0,0,0,0.75)] space-y-1.5"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Release Year
                  </span>
                  {selectedYear !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        onYearChange('all');
                        setOpenMenu('none');
                      }}
                      className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                  {DISCOVER_YEARS.map((yr) => {
                    const isSelected = selectedYear === yr.value;
                    return (
                      <button
                        key={yr.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onYearChange(yr.value);
                          setOpenMenu('none');
                        }}
                        className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-white/[0.16] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        <span className="font-mono-tabular truncate">{yr.label}</span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentHex }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unboxed Active Filters Summary & Reset */}
        {activeFilterLabels.length > 0 && onResetAll && (
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-300">
            <span className="truncate">{activeFilterLabels.join(' · ')}</span>
            <button
              type="button"
              onClick={onResetAll}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-white font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Category / Genre Horizontal Strip */}
      <div className="pt-2.5 border-t border-white/[0.07]">
        <div
          role="tablist"
          aria-label="Categories and genres"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedGenre === 'all'}
            onClick={() => onGenreChange('all')}
            className={`relative min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedGenre === 'all'
                ? 'text-white font-semibold'
                : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:text-white hover:bg-white/[0.09]'
            }`}
          >
            {selectedGenre === 'all' && (
              <motion.span
                layoutId={`${layoutPrefix}-genre`}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="absolute inset-0 rounded-xl border border-white/25"
                style={{
                  background: `linear-gradient(135deg, ${accentHex}e6 0%, ${accentHex}99 100%)`,
                  boxShadow: `0 6px 18px ${accentHex}40`,
                }}
              />
            )}
            <span className="relative z-10">All Categories</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedGenre === 'archive'}
            onClick={() => onGenreChange('archive')}
            className={`relative min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              selectedGenre === 'archive'
                ? 'text-white font-semibold'
                : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:text-white hover:bg-white/[0.09]'
            }`}
          >
            {selectedGenre === 'archive' && (
              <motion.span
                layoutId={`${layoutPrefix}-genre`}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="absolute inset-0 rounded-xl border border-white/25"
                style={{
                  background: `linear-gradient(135deg, ${accentHex}e6 0%, ${accentHex}99 100%)`,
                  boxShadow: `0 6px 18px ${accentHex}40`,
                }}
              />
            )}
            <Sparkles className="relative z-10 h-3.5 w-3.5 shrink-0 opacity-85" />
            <span className="relative z-10">Classics</span>
          </button>

          {genres.map((g) => {
            const active = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onGenreChange(g.id)}
                className={`relative min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white font-semibold'
                    : 'bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:text-white hover:bg-white/[0.09]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`${layoutPrefix}-genre`}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="absolute inset-0 rounded-xl border border-white/25"
                    style={{
                      background: `linear-gradient(135deg, ${accentHex}e6 0%, ${accentHex}99 100%)`,
                      boxShadow: `0 6px 18px ${accentHex}40`,
                    }}
                  />
                )}
                <span className="relative z-10">{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
