import React from 'react';
import { Bookmark, Check, Play, Star } from 'lucide-react';
import { useCardActions } from '../state/AppContext';
import { MediaItem, THEME_ACCENTS } from '../types/media';
import { MediaPosterImage } from './MediaPosterImage';

interface MediaCardProps {
  item: MediaItem;
  aspect?: 'poster' | 'landscape';
  progressRatio?: number;
  subtitleLine?: string;
  onQuickPlay?: (item: MediaItem) => void;
  posterOnly?: boolean;
  topRightBadge?: React.ReactNode;
}

const LANGUAGE_FALLBACK: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  es: 'Spanish',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  zh: 'Chinese',
  cn: 'Chinese',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  th: 'Thai',
  tr: 'Turkish',
};

function formatLanguageLabel(code?: string): string {
  const clean = (code || 'en').trim().toLowerCase();
  if (LANGUAGE_FALLBACK[clean]) return LANGUAGE_FALLBACK[clean];
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    const resolved = dn.of(clean);
    if (resolved) return resolved;
  } catch {
    // Fallback to uppercase code
  }
  return clean.toUpperCase();
}

export const MediaCard: React.FC<MediaCardProps> = React.memo(({
  item,
  aspect = 'poster',
  progressRatio,
  subtitleLine,
  onQuickPlay,
  posterOnly = false,
  topRightBadge,
}) => {
  const { openMediaDetails, watchlistKeys, toggleWatchlist, openServerPicker, themeColor } = useCardActions();
  const accent = THEME_ACCENTS[themeColor || 'red'];
  const saved = watchlistKeys.has(`${item.mediaType}:${item.id}`);
  const mediaTypeName = item.mediaType === 'tv' ? 'Series' : 'Movie';
  const displaySubtitle = subtitleLine || mediaTypeName;
  const languageLabel = formatLanguageLabel(item.originalLanguage);

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlist(item);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(item);
    } else {
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
    }
  };

  return (
    <article className="group w-full perf-card transition-transform duration-150 ease-out hover:-translate-y-1 active:scale-[0.98]">
      <div
        onClick={() => openMediaDetails(item.id, item.mediaType, item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openMediaDetails(item.id, item.mediaType, item);
          }
        }}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] rounded-2xl"
      >
        <div
          className={`relative overflow-hidden rounded-2xl bg-[#111520] border border-white/[0.14] shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-all duration-150 group-hover:border-white/35 ${
            aspect === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'
          }`}
        >
          <MediaPosterImage
            path={aspect === 'landscape' ? item.backdropPath || item.posterPath : item.posterPath}
            fallbackSrc={
              aspect === 'landscape'
                ? item.fallbackBackdrop || item.fallbackPoster
                : item.fallbackPoster || item.fallbackBackdrop
            }
            size={aspect === 'landscape' ? 'w780' : 'w500'}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />

          {topRightBadge && (
            <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
              {topRightBadge}
            </div>
          )}

          {/* Only render overlays, labels, badges, and controls when posterOnly is false */}
          {!posterOnly && (
            <>
              {/* Bottom Dark Gradient Scrim for Overlaid Text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

              {/* Top-Left Corner Language Label */}
              <div className="absolute top-2.5 left-2.5 max-w-[76px] px-2 py-0.5 rounded-full bg-black/80 border border-white/20 text-white text-[10px] font-bold tracking-wide truncate shadow-md pointer-events-none">
                {languageLabel}
              </div>

              {/* Top-Right Rating Badge */}
              {item.voteAverage > 0 && (
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/80 border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 shadow-md">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{item.voteAverage.toFixed(1)}</span>
                </div>
              )}

              {/* Top-Right Watchlist Toggle (below rating when present) */}
              <button
                type="button"
                onClick={handleWatchlistClick}
                aria-label={saved ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
                className={`absolute ${
                  item.voteAverage > 0 ? 'top-9' : 'top-2.5'
                } right-2.5 min-h-[28px] min-w-[28px] flex items-center justify-center rounded-full bg-black/70 border border-white/25 text-white transition-opacity duration-150 ${
                  saved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                }`}
              >
                {saved ? <Check className="h-3.5 w-3.5 text-[#3B82F6]" /> : <Bookmark className="h-3.5 w-3.5" />}
              </button>

              {/* Bottom Overlay: Play button + Title + Series/Movie Subtitle */}
              <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-xs sm:text-sm font-bold text-white leading-tight truncate drop-shadow-sm">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-300/90 tracking-wide mt-0.5 truncate">
                    {displaySubtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePlayClick}
                  aria-label={`Play ${item.title}`}
                  className="h-9 w-9 shrink-0 rounded-full bg-black/75 border border-white/30 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                  style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = accent.hex;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.75)';
                  }}
                >
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                </button>
              </div>

              {/* Continue watching progress bar */}
              {typeof progressRatio === 'number' && progressRatio > 0 && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: accent.hex,
                      width: `${Math.min(100, Math.max(4, progressRatio * 100))}%`,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
});
