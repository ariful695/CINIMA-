import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  Download,
  ListPlus,
  Loader2,
  Play,
  Share2,
  User,
} from 'lucide-react';
import { bengaliSerialService, BengaliEpisodeItem } from '../services/bengaliSerialService';
import { dejavuApiService } from '../services/dejavuApiService';
import { streamProviderService } from '../services/streamProviderService';
import { getTmdbImageUrl, tmdbService } from '../services/tmdbService';
import { useAppState } from '../state/AppContext';
import {
  Episode,
  MediaDetails,
  MediaItem,
  MediaType,
  SeasonDetails,
  THEME_ACCENTS,
} from '../types/media';
import { MediaCard } from './MediaCard';
import { MediaPosterImage } from './MediaPosterImage';

interface MediaDetailsScreenProps {
  mediaId: number;
  mediaType: MediaType;
  seedItem?: MediaItem;
}

type DetailsTab = 'episodes' | 'details' | 'similar';

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return 'Feature';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLanguageCode(code?: string): string {
  if (!code) return 'EN';
  return code.trim().toUpperCase();
}

export const MediaDetailsScreen: React.FC<MediaDetailsScreenProps> = ({
  mediaId,
  mediaType,
  seedItem,
}) => {
  const {
    closeMediaDetails,
    startPlayback,
    isInWatchlist,
    toggleWatchlist,
    continueWatching,
    openServerPicker,
    themeColor,
  } = useAppState();

  const accent = THEME_ACCENTS[themeColor || 'red'];

  const seedItemRef = useRef(seedItem);
  seedItemRef.current = seedItem;

  const makeOptimisticDetails = (seed?: MediaItem): MediaDetails | null => {
    if (!seed) return null;
    return {
      ...seed,
      runtime: seed.mediaType === 'movie' ? null : null,
      genres: [],
      cast: [],
      similar: [],
      seasons:
        seed.mediaType === 'tv'
          ? [
              {
                id: 1,
                seasonNumber: 1,
                name: 'Season 1',
                episodeCount: 8,
                posterPath: null,
              },
            ]
          : undefined,
      numberOfSeasons: seed.mediaType === 'tv' ? 1 : undefined,
    };
  };

  const [details, setDetails] = useState<MediaDetails | null>(() => makeOptimisticDetails(seedItem));
  const [loading, setLoading] = useState(() => !seedItem);
  const [loadFailed, setLoadFailed] = useState(false);
  const [logoCandidateIdx, setLogoCandidateIdx] = useState(0);
  const [logoLoadedUrl, setLogoLoadedUrl] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailsTab>(
    mediaType === 'tv' ? 'episodes' : 'details'
  );
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [resolvingAction, setResolvingAction] = useState<'trailer' | 'download' | null>(null);
  const seasonMenuRef = useRef<HTMLDivElement>(null);

  const loadDetailsData = useCallback(async (signal?: { active: boolean }) => {
    const currentSeed = seedItemRef.current;
    setLoadFailed(false);
    if (!currentSeed) {
      setLoading(true);
    }

    if (currentSeed?.archiveIdentifier) {
      setDetails({
        ...currentSeed,
        runtime: currentSeed.mediaType === 'movie' ? 95 : 30,
        genres: [],
        cast: [],
        similar: [],
        seasons:
          currentSeed.mediaType === 'tv'
            ? [
                {
                  id: 1,
                  seasonNumber: 1,
                  name: 'Season 1',
                  episodeCount: 8,
                  posterPath: null,
                },
              ]
            : undefined,
        numberOfSeasons: currentSeed.mediaType === 'tv' ? 1 : undefined,
      });
      setSelectedSeason(1);
      setLoading(false);
      return;
    }

    if (currentSeed?.bengaliSerialSlug || (mediaId >= 895000 && mediaId <= 899999)) {
      setDetails({
        ...currentSeed!,
        id: mediaId,
        mediaType: 'tv',
        title: currentSeed?.title || 'Zee Bangla Serial',
        overview: currentSeed?.overview || 'Daily Bengali serial streaming.',
        posterPath: currentSeed?.posterPath ?? null,
        backdropPath: currentSeed?.backdropPath ?? null,
        releaseDate: currentSeed?.releaseDate || '',
        voteAverage: currentSeed?.voteAverage || 8.4,
        genreIds: currentSeed?.genreIds || [18, 10751],
        runtime: 22,
        genres: currentSeed?.title?.toLowerCase().includes('gopal')
          ? [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }]
          : [{ id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }],
        cast: [],
        similar: [],
        seasons: [
          {
            id: 1,
            seasonNumber: 1,
            name: 'Daily & Full Episodes',
            episodeCount: 18,
            posterPath: null,
          },
        ],
        numberOfSeasons: 1,
      });
      setSelectedSeason(1);
      setLoading(false);
      return;
    }

    if (currentSeed?.dejavuId) {
      const dejavuDetails = await dejavuApiService.getDetails(
        currentSeed.dejavuId,
        mediaType,
        currentSeed
      );
      if (signal && !signal.active) return;

      if (dejavuDetails) {
        setDetails(dejavuDetails);
        setSelectedSeason(dejavuDetails.seasons?.[0]?.seasonNumber ?? 1);
        setLoading(false);
        return;
      }

      setDetails({
        ...currentSeed,
        runtime: null,
        genres: [],
        cast: [],
        similar: [],
        seasons: undefined,
        numberOfSeasons: undefined,
      });
      setSelectedSeason(1);
      setLoading(false);
      return;
    }

    const data = await tmdbService.getMediaDetails(mediaId, mediaType);
    if (signal && !signal.active) return;
    if (data) {
      setDetails(data);
      const firstSeason = data.seasons?.[0]?.seasonNumber ?? 1;
      setSelectedSeason(firstSeason);
    } else if (currentSeed) {
      setDetails(makeOptimisticDetails(currentSeed));
    } else {
      setLoadFailed(true);
    }
    setLoading(false);
  }, [mediaId, mediaType]);

  useEffect(() => {
    const currentSeed = seedItemRef.current;
    setDetails(makeOptimisticDetails(currentSeed));
    setLoading(!currentSeed);
    setLoadFailed(false);
    setSeasonDetails(null);
    setActiveTab(mediaType === 'tv' ? 'episodes' : 'details');
    setSeasonDropdownOpen(false);
    setLogoCandidateIdx(0);
    setLogoLoadedUrl(null);
    setLogoLoadError(false);

    const signal = { active: true };
    void loadDetailsData(signal);
    return () => {
      signal.active = false;
    };
  }, [mediaId, mediaType, loadDetailsData]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (seasonMenuRef.current && !seasonMenuRef.current.contains(e.target as Node)) {
        setSeasonDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (seasonDropdownOpen) setSeasonDropdownOpen(false);
        else closeMediaDetails();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [seasonDropdownOpen, closeMediaDetails]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 2800);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  const isCustomTvSource = Boolean(
    seedItemRef.current?.dejavuId ||
      details?.dejavuId ||
      seedItemRef.current?.archiveIdentifier ||
      details?.archiveIdentifier
  );

  useEffect(() => {
    if (mediaType !== 'tv') return;

    if (isCustomTvSource) {
      const currentDetails = details;
      const currentSeed = seedItemRef.current;
      const epCount =
        currentDetails?.seasons?.find((s) => s.seasonNumber === selectedSeason)?.episodeCount || 8;
      const seriesTitle = currentDetails?.title || currentSeed?.title || 'Series';
      setSeasonDetails({
        seasonNumber: selectedSeason,
        name: `Season ${selectedSeason}`,
        episodes: Array.from({ length: epCount }, (_, idx) => {
          const epNum = idx + 1;
          return {
            id: selectedSeason * 1000 + epNum,
            episodeNumber: epNum,
            seasonNumber: selectedSeason,
            name: `Episode ${epNum}`,
            overview: `${seriesTitle} — Season ${selectedSeason}, Episode ${epNum}.`,
            stillPath: currentDetails?.backdropPath || currentSeed?.backdropPath || null,
            airDate: currentDetails?.releaseDate || '',
            runtime: currentDetails?.runtime || 45,
          };
        }),
      });
      setLoadingSeason(false);
      return;
    }

    let active = true;
    const loadSeason = async () => {
      setLoadingSeason(true);
      const currentTitle = seedItemRef.current?.title || details?.title || '';
      const isBengali =
        Boolean(seedItemRef.current?.bengaliSerialSlug || details?.bengaliSerialSlug) ||
        bengaliSerialService.isBengaliSerialOrCartoon({
          title: currentTitle,
          originalLanguage: seedItemRef.current?.originalLanguage || details?.originalLanguage,
          bengaliSerialSlug: seedItemRef.current?.bengaliSerialSlug || details?.bengaliSerialSlug,
        });

      if (isBengali && currentTitle) {
        const bengaliSeason = await bengaliSerialService.getEpisodes(currentTitle, selectedSeason);
        if (active && bengaliSeason.episodes.length > 0) {
          setSeasonDetails(bengaliSeason);
          setLoadingSeason(false);
          return;
        }
      }

      const season = await tmdbService.getSeasonDetails(mediaId, selectedSeason);
      if (active) {
        setSeasonDetails(season);
        setLoadingSeason(false);
      }
    };
    void loadSeason();
    return () => {
      active = false;
    };
    // Intentionally omit full `details` object to avoid redundant TMDB season fetches when full details resolve
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, mediaType, selectedSeason, isCustomTvSource]);

  const saved = details ? isInWatchlist(details.id, details.mediaType) : false;

  const existingProgress = continueWatching.find(
    (item) => item.mediaId === mediaId && item.mediaType === mediaType
  );

  const handlePlayMovie = () => {
    if (!details) return;
    openServerPicker({
      mediaId: details.id,
      mediaType: details.mediaType,
      title: details.title,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      fallbackPoster: details.fallbackPoster,
      fallbackBackdrop: details.fallbackBackdrop,
      imdbId: details.imdbId,
      dejavuId: details.dejavuId || seedItem?.dejavuId,
      archiveIdentifier: details.archiveIdentifier || seedItem?.archiveIdentifier,
      genreIds: details.genreIds?.length ? details.genreIds : details.genres.map((g) => g.id),
      originalLanguage: details.originalLanguage,
      releaseYear: details.releaseDate ? parseInt(details.releaseDate.slice(0, 4), 10) || undefined : undefined,
      initialTime:
        existingProgress && existingProgress.mediaType === 'movie'
          ? existingProgress.currentTime
          : 0,
    });
  };

  const handlePlayEpisode = (episode: Episode) => {
    if (!details) return;
    const bEp = episode as BengaliEpisodeItem;
    const epProgress = continueWatching.find(
      (p) =>
        p.mediaId === details.id &&
        p.mediaType === 'tv' &&
        p.seasonNumber === episode.seasonNumber &&
        p.episodeNumber === episode.episodeNumber
    );
    openServerPicker({
      mediaId: details.id,
      mediaType: 'tv',
      title: details.title,
      subtitle: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.name}`,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      fallbackPoster: details.fallbackPoster,
      fallbackBackdrop: bEp.fallbackStill || details.fallbackBackdrop,
      imdbId: details.imdbId,
      dejavuId: details.dejavuId || seedItem?.dejavuId,
      archiveIdentifier: details.archiveIdentifier || seedItem?.archiveIdentifier,
      genreIds: details.genreIds?.length ? details.genreIds : details.genres.map((g) => g.id),
      originalLanguage: details.originalLanguage,
      releaseYear: details.releaseDate ? parseInt(details.releaseDate.slice(0, 4), 10) || undefined : undefined,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.name,
      initialTime: epProgress?.currentTime || 0,
      bengaliSerialSlug: details.bengaliSerialSlug || seedItem?.bengaliSerialSlug,
      preferredVideoId: bEp.videoId,
    });
  };

  const handlePrimaryPlay = () => {
    if (!details) return;
    if (details.mediaType === 'tv') {
      const firstEp = seasonDetails?.episodes?.[0];
      if (firstEp) {
        handlePlayEpisode(firstEp);
      } else {
        openServerPicker({
          mediaId: details.id,
          mediaType: 'tv',
          title: details.title,
          subtitle: `Season ${selectedSeason} · Episode 1`,
          posterPath: details.posterPath,
          backdropPath: details.backdropPath,
          fallbackPoster: details.fallbackPoster,
          fallbackBackdrop: details.fallbackBackdrop,
          imdbId: details.imdbId,
          dejavuId: details.dejavuId || seedItem?.dejavuId,
          archiveIdentifier: details.archiveIdentifier || seedItem?.archiveIdentifier,
          genreIds: details.genreIds?.length ? details.genreIds : details.genres.map((g) => g.id),
          originalLanguage: details.originalLanguage,
          releaseYear: details.releaseDate ? parseInt(details.releaseDate.slice(0, 4), 10) || undefined : undefined,
          seasonNumber: selectedSeason,
          episodeNumber: 1,
          bengaliSerialSlug: details.bengaliSerialSlug || seedItem?.bengaliSerialSlug,
        });
      }
      return;
    }
    handlePlayMovie();
  };

  const handleShare = async () => {
    if (!details) return;
    const shareText = `Watch ${details.title} on KinoStream`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: details.title,
          text: shareText,
          url: window.location.href,
        });
        return;
      }
    } catch {
      // Fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${shareText} — ${window.location.href}`);
      setActionFeedback('Share link copied');
    } catch {
      setActionFeedback('Share ready in browser bar');
    }
  };

  const handleWatchTrailer = async () => {
    if (!details || resolvingAction) return;
    setResolvingAction('trailer');
    try {
      const videos = await tmdbService.getMediaVideos(details.id, details.mediaType);
      const trailer =
        videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
        videos.find((v) => v.site === 'YouTube');

      if (trailer) {
        startPlayback({
          mediaId: details.id,
          mediaType: details.mediaType,
          title: `${details.title} — Trailer`,
          subtitle: trailer.name || 'Official Trailer',
          posterPath: details.posterPath,
          backdropPath: details.backdropPath,
          fallbackPoster: details.fallbackPoster,
          fallbackBackdrop: details.fallbackBackdrop,
          initialSources: [
            {
              id: `trailer-${trailer.key}`,
              providerName: 'Official Trailer',
              label: trailer.name || 'Official Trailer',
              quality: '1080p HD',
              url: `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`,
              format: 'youtube',
              audioLanguage: formatLanguageCode(details.originalLanguage),
              isDefault: true,
              isDirectPlayable: true,
            },
          ],
        });
      } else {
        setActionFeedback('No official YouTube trailer found — opening servers');
        handlePrimaryPlay();
      }
    } catch {
      setActionFeedback('Unable to load trailer right now');
    } finally {
      setResolvingAction(null);
    }
  };

  const handleDownloadDirect = async () => {
    if (!details || resolvingAction) return;
    setResolvingAction('download');
    try {
      const query = {
        tmdbId: details.id,
        imdbId: details.imdbId,
        dejavuId: details.dejavuId || seedItem?.dejavuId,
        archiveIdentifier: details.archiveIdentifier || seedItem?.archiveIdentifier,
        mediaType: details.mediaType,
        title: details.title,
        seasonNumber: details.mediaType === 'tv' ? selectedSeason : undefined,
        episodeNumber: details.mediaType === 'tv' ? 1 : undefined,
      };
      const res =
        details.mediaType === 'tv'
          ? await streamProviderService.resolveEpisodeStreams(query)
          : await streamProviderService.resolveMovieStreams(query);

      const mp4Source = res.sources.find((s) => s.format === 'mp4' && s.url.startsWith('http'));
      if (mp4Source) {
        const a = document.createElement('a');
        a.href = mp4Source.url;
        a.download = `${details.title.replace(/[^\w\s-]/g, '').trim() || 'video'}.mp4`;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setActionFeedback(`Starting MP4 download (${mp4Source.providerName})`);
      } else {
        setActionFeedback('Select a stream server below');
        handlePrimaryPlay();
      }
    } catch {
      handlePrimaryPlay();
    } finally {
      setResolvingAction(null);
    }
  };

  const episodeCount =
    seasonDetails?.episodes?.length ??
    details?.seasons?.find((s) => s.seasonNumber === selectedSeason)?.episodeCount ??
    0;

  const yearText = details?.releaseDate ? String(details.releaseDate).slice(0, 4) : 'TBA';
  const seasonOrRuntimeText =
    details?.mediaType === 'tv'
      ? `${details.numberOfSeasons || details.seasons?.length || 1} ${
          (details.numberOfSeasons || details.seasons?.length || 1) === 1 ? 'Season' : 'Seasons'
        }`
      : formatRuntime(details?.runtime ?? null);
  const genreText = details?.genres?.length
    ? details.genres.map((g) => g.name).slice(0, 3).join(', ')
    : details?.mediaType === 'tv'
    ? 'Series'
    : 'Feature Film';

  const logoCandidateUrls = useMemo(() => {
    const paths =
      details?.logoPaths && details.logoPaths.length > 0
        ? details.logoPaths
        : details?.logoPath
        ? [details.logoPath]
        : [];
    const urls: string[] = [];
    for (const p of paths) {
      const cleanPath = (p || '').trim();
      if (!cleanPath) continue;
      const preferredUrl = getTmdbImageUrl(
        cleanPath,
        cleanPath.toLowerCase().endsWith('.svg') ? 'original' : 'w500'
      );
      if (preferredUrl && !urls.includes(preferredUrl)) {
        urls.push(preferredUrl);
      }
    }
    return urls;
  }, [details?.logoPath, details?.logoPaths]);

  const logoUrl =
    !logoLoadError && logoCandidateIdx < logoCandidateUrls.length
      ? logoCandidateUrls[logoCandidateIdx]
      : null;

  const isCurrentLogoLoaded = Boolean(logoUrl && logoLoadedUrl === logoUrl);

  const advanceLogoCandidate = useCallback(() => {
    if (logoCandidateIdx + 1 < logoCandidateUrls.length) {
      setLogoCandidateIdx((idx) => idx + 1);
      setLogoLoadedUrl(null);
    } else {
      setLogoLoadError(true);
    }
  }, [logoCandidateIdx, logoCandidateUrls.length]);

  useEffect(() => {
    if (!logoUrl) return;
    // Handle cached browser image synchronously so already-cached logos show immediately
    const imgEl = logoImgRef.current;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setLogoLoadedUrl(logoUrl);
      return;
    }
    // Guard against stalled image CDN so logo never stays stuck invisible
    const stallTimer = window.setTimeout(() => {
      advanceLogoCandidate();
    }, 2600);
    return () => {
      window.clearTimeout(stallTimer);
    };
  }, [logoUrl, advanceLogoCandidate]);

  const [splashActive, setSplashActive] = useState(true);

  useEffect(() => {
    setSplashActive(true);
    const splashTimer = window.setTimeout(() => {
      setSplashActive(false);
    }, 2000);
    return () => {
      window.clearTimeout(splashTimer);
    };
  }, [mediaId, mediaType]);

  return (
    <div className="fixed inset-0 z-40 bg-[#07090E] overflow-y-auto">
      {/* 2-Second Logo Splash Overlay */}
      {splashActive && (
        <div
          onClick={() => setSplashActive(false)}
          className="fixed inset-0 z-50 bg-[#05070B] flex flex-col items-center justify-center p-6 cursor-pointer select-none"
        >
          {/* Backdrop image */}
          <div className="absolute inset-0 overflow-hidden opacity-50">
            <MediaPosterImage
              path={details?.backdropPath || seedItem?.backdropPath || details?.posterPath || seedItem?.posterPath}
              fallbackSrc={details?.fallbackBackdrop || seedItem?.fallbackBackdrop}
              size="w1280"
              alt=""
              className="h-full w-full object-cover scale-105 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/75 to-[#05070B]/50" />
          </div>

          {/* Centered Logo (Only Logo, No Name) */}
          <div className="relative z-10 flex flex-col items-center justify-center max-w-lg px-4 text-center">
            {logoUrl ? (
              <img
                key={logoUrl}
                src={logoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="max-h-40 sm:max-h-56 w-auto max-w-[320px] sm:max-w-[460px] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.95)] transition-opacity duration-300"
              />
            ) : (
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.95)] [text-wrap:balance]">
                {details?.title || seedItem?.title || 'KinoStream'}
              </h1>
            )}
          </div>
        </div>
      )}
      {/* Floating Top-Left Back Button over Full-Bleed Backdrop */}
      <button
        type="button"
        onClick={closeMediaDetails}
        aria-label="Go back"
        className="fixed top-4 left-4 z-50 h-11 w-11 rounded-full bg-black/65 border border-white/15 text-white hover:bg-black/85 active:scale-95 transition-all flex items-center justify-center shadow-lg"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="fixed top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-[#111520]/95 border border-white/20 text-xs font-semibold text-white shadow-xl">
          {actionFeedback}
        </div>
      )}

      {loading || !details ? (
        loadFailed ? (
          <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-4">
            <p className="text-sm text-slate-300">Could not load details for this title right now.</p>
            <button
              type="button"
              onClick={() => void loadDetailsData()}
              className="min-h-[42px] px-5 py-2 rounded-full bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6 pb-16">
            <div className="w-full h-[360px] sm:h-[440px] liquid-skeleton" />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
              <div className="h-9 w-64 rounded-lg liquid-skeleton" />
              <div className="h-5 w-48 rounded-lg liquid-skeleton" />
              <div className="h-12 w-full rounded-full liquid-skeleton" />
              <div className="h-24 w-full rounded-xl liquid-skeleton" />
            </div>
          </div>
        )
      ) : (
        <div className="pb-20">
          {/* Full-Bleed Top Hero Artwork */}
          <div className="relative w-full h-[360px] sm:h-[440px] lg:h-[500px] overflow-hidden bg-[#0B0E16]">
            <MediaPosterImage
              path={details.backdropPath || details.posterPath}
              fallbackSrc={details.fallbackBackdrop || details.fallbackPoster}
              size="w1280"
              alt={details.title}
              titleForFallback={details.title}
              className="h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/35 to-black/25" />
          </div>

          {/* Primary Title, Metadata, Play CTA, Quick Actions & Overview */}
          <div className="relative z-10 -mt-12 sm:-mt-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            {/* Official Title Logo or Stylized Display Title */}
            {logoUrl ? (
              <div className="relative pt-1 min-h-[64px] sm:min-h-[84px] flex items-center gap-4 flex-wrap">
                <img
                  key={logoUrl}
                  ref={logoImgRef}
                  src={logoUrl}
                  alt={details.title}
                  referrerPolicy="no-referrer"
                  loading="eager"
                  decoding="async"
                  onLoad={() => setLogoLoadedUrl(logoUrl)}
                  onError={advanceLogoCandidate}
                  className="max-h-20 sm:max-h-28 w-auto max-w-[270px] sm:max-w-[380px] object-contain object-left drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)]"
                />
                <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white/90 [text-wrap:balance] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                  {details.title}
                </h1>
              </div>
            ) : (
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white [text-wrap:balance] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                {details.title}
              </h1>
            )}

            {/* Clean Typographic Metadata Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
              <span className="font-mono-tabular">{yearText}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{seasonOrRuntimeText}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-300">{genreText}</span>
            </div>

            {/* Compact Info Chips Row matching reference layout */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-[11px] font-semibold text-slate-200 uppercase">
                {details.mediaType === 'tv' ? 'Series' : 'Movie'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-[11px] font-semibold text-slate-200">
                HD
              </span>
              {details.voteAverage > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-[11px] font-semibold text-amber-300 font-mono-tabular">
                  TMDB {details.voteAverage.toFixed(1)}
                </span>
              )}
              {details.originalLanguage && (
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-[11px] font-semibold text-sky-300 uppercase">
                  {formatLanguageCode(details.originalLanguage)}
                </span>
              )}
            </div>

            {/* Primary High-Contrast Pill Play Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handlePrimaryPlay}
                className="w-full sm:w-auto sm:min-w-[280px] min-h-[50px] px-7 py-3 rounded-full bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] active:scale-[0.98] transition-all"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {details.mediaType === 'tv'
                    ? `Play S${selectedSeason} · E1`
                    : existingProgress && existingProgress.currentTime > 15
                    ? 'Resume Movie'
                    : 'Play'}
                </span>
              </button>
            </div>

            {/* 5 Quick-Action Icon Buttons Row */}
            <div className="grid grid-cols-5 gap-2 pt-1 max-w-xl">
              <button
                type="button"
                onClick={() => toggleWatchlist(details)}
                className="flex flex-col items-center gap-1.5 group focus-visible:outline-none"
              >
                <span
                  className={`h-12 w-12 rounded-2xl border flex items-center justify-center transition-colors ${
                    saved
                      ? 'bg-white text-slate-950 border-white'
                      : 'bg-white/[0.06] border-white/10 text-slate-200 group-hover:bg-white/[0.12] group-hover:text-white'
                  }`}
                >
                  {saved ? <Check className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-full">
                  {saved ? 'Saved' : 'Watchlist'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleWatchlist(details);
                  setActionFeedback(saved ? 'Removed from Playlist' : 'Saved to Playlist');
                }}
                className="flex flex-col items-center gap-1.5 group focus-visible:outline-none"
              >
                <span className="h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 text-slate-200 group-hover:bg-white/[0.12] group-hover:text-white flex items-center justify-center transition-colors">
                  <ListPlus className="h-5 w-5" />
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-full">
                  Playlist
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadDirect()}
                disabled={resolvingAction === 'download'}
                className="flex flex-col items-center gap-1.5 group focus-visible:outline-none disabled:opacity-60"
              >
                <span className="h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 text-slate-200 group-hover:bg-white/[0.12] group-hover:text-white flex items-center justify-center transition-colors">
                  {resolvingAction === 'download' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-full">
                  Download
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex flex-col items-center gap-1.5 group focus-visible:outline-none"
              >
                <span className="h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 text-slate-200 group-hover:bg-white/[0.12] group-hover:text-white flex items-center justify-center transition-colors">
                  <Share2 className="h-5 w-5" />
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-full">
                  Share
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleWatchTrailer()}
                disabled={resolvingAction === 'trailer'}
                className="flex flex-col items-center gap-1.5 group focus-visible:outline-none disabled:opacity-60"
              >
                <span className="h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 text-slate-200 group-hover:bg-white/[0.12] group-hover:text-white flex items-center justify-center transition-colors">
                  {resolvingAction === 'trailer' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Clapperboard className="h-5 w-5" />
                  )}
                </span>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-full">
                  Trailer
                </span>
              </button>
            </div>

            {/* Synopsis */}
            {details.overview && (
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1">
                {details.overview}
              </p>
            )}

            {/* Horizontal Underline Tab Navigation */}
            <div className="border-b border-white/[0.10] pt-2 flex items-center gap-6 overflow-x-auto no-scrollbar">
              {details.mediaType === 'tv' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('episodes')}
                  className={`min-h-[44px] pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'episodes'
                      ? 'text-white border-white'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  Episodes
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`min-h-[44px] pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'details'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                Details &amp; Cast
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('similar')}
                className={`min-h-[44px] pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'similar'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                More like this
              </button>
            </div>

            {/* TAB 1: Episodes (TV Series) */}
            {details.mediaType === 'tv' && activeTab === 'episodes' && (
              <section className="space-y-4 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {details.seasons && details.seasons.length > 0 ? (
                      <div ref={seasonMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setSeasonDropdownOpen((prev) => !prev)}
                          aria-haspopup="listbox"
                          aria-expanded={seasonDropdownOpen}
                          className="min-h-[42px] px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.13] border border-white/15 text-sm font-semibold text-white inline-flex items-center gap-2 transition-colors"
                        >
                          <span>
                            {details.seasons.find((s) => s.seasonNumber === selectedSeason)?.name ||
                              `Season ${selectedSeason}`}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-slate-300 transition-transform ${
                              seasonDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {seasonDropdownOpen && (
                          <div
                            role="listbox"
                            className="absolute left-0 mt-2 w-56 rounded-2xl liquid-glass-strong p-2 z-30 shadow-2xl space-y-1 max-h-64 overflow-y-auto"
                          >
                            {details.seasons.map((season) => {
                              const active = season.seasonNumber === selectedSeason;
                              return (
                                <button
                                  key={season.id}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onClick={() => {
                                    setSelectedSeason(season.seasonNumber);
                                    setSeasonDropdownOpen(false);
                                  }}
                                  className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-medium transition-colors ${
                                    active
                                      ? 'bg-white/15 text-white font-semibold'
                                      : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                                  }`}
                                >
                                  <span>{season.name}</span>
                                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                                    {season.episodeCount} eps
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="px-4 py-2 rounded-full bg-white/[0.08] border border-white/15 text-sm font-semibold text-white">
                        Season {selectedSeason}
                      </span>
                    )}

                    <span className="text-xs font-mono-tabular text-slate-400">
                      {episodeCount} {episodeCount === 1 ? 'ep' : 'eps'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrimaryPlay}
                    className="min-h-[42px] px-4 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Play</span>
                  </button>
                </div>

                {loadingSeason ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-xl liquid-skeleton" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(seasonDetails?.episodes || []).map((ep) => {
                      const epProgress = continueWatching.find(
                        (p) =>
                          p.mediaId === details.id &&
                          p.mediaType === 'tv' &&
                          p.seasonNumber === ep.seasonNumber &&
                          p.episodeNumber === ep.episodeNumber
                      );
                      const ratio =
                        epProgress && epProgress.duration > 0
                          ? epProgress.currentTime / epProgress.duration
                          : 0;

                      return (
                        <div
                          key={ep.id}
                          onClick={() => handlePlayEpisode(ep)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handlePlayEpisode(ep);
                            }
                          }}
                          className="w-full text-left p-2 sm:p-3 rounded-2xl hover:bg-white/[0.04] transition-colors flex items-center gap-3.5 sm:gap-4 cursor-pointer group"
                        >
                          {/* Episode 16:9 Thumbnail */}
                          <div className="relative shrink-0 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden bg-[#111520] border border-white/[0.08]">
                            <MediaPosterImage
                              path={ep.stillPath}
                              fallbackSrc={
                                (ep as BengaliEpisodeItem).fallbackStill ||
                                details.fallbackBackdrop ||
                                details.fallbackPoster
                              }
                              size="w500"
                              alt={`Episode ${ep.episodeNumber}: ${ep.name}`}
                              titleForFallback={`E${ep.episodeNumber}`}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="h-9 w-9 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white">
                                <Play className="h-4 w-4 fill-current ml-0.5" />
                              </div>
                            </div>
                            {ratio > 0 && (
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                                <div
                                  className="h-full"
                                  style={{
                                    backgroundColor: accent.hex,
                                    width: `${Math.min(100, ratio * 100)}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                              {ep.episodeNumber}. {ep.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-snug">
                              {ep.overview}
                            </p>
                            <p className="text-[11px] font-mono-tabular text-slate-500">
                              {ep.runtime ? `${ep.runtime}m` : '45m'}
                              {ep.airDate ? ` · ${ep.airDate}` : ''}
                            </p>
                          </div>

                          {/* Quick Play / Server Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayEpisode(ep);
                            }}
                            aria-label={`Play ${ep.episodeNumber}. ${ep.name}`}
                            className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07] hover:bg-white/[0.16] border border-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                          >
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: Details & Cast */}
            {activeTab === 'details' && (
              <section className="space-y-8 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl liquid-glass p-4 sm:p-5 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Release Year</span>
                    <p className="font-medium text-white font-mono-tabular">{yearText}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">
                      {details.mediaType === 'tv' ? 'Seasons' : 'Runtime'}
                    </span>
                    <p className="font-medium text-white">{seasonOrRuntimeText}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Genres</span>
                    <p className="font-medium text-white">{genreText}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Original Language</span>
                    <p className="font-medium text-white uppercase">
                      {formatLanguageCode(details.originalLanguage)}
                    </p>
                  </div>
                  {details.status && (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Status</span>
                      <p className="font-medium text-white">{details.status}</p>
                    </div>
                  )}
                  {details.tagline && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-xs text-slate-400">Tagline</span>
                      <p className="italic text-slate-200">{details.tagline}</p>
                    </div>
                  )}
                </div>

                {details.cast.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-white">Cast</h2>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                      {details.cast.map((person) => {
                        const avatarUrl = getTmdbImageUrl(person.profilePath, 'w185');
                        return (
                          <div
                            key={person.id}
                            className="shrink-0 w-24 sm:w-28 flex flex-col items-start"
                          >
                            <div className="w-24 sm:w-28 aspect-square rounded-2xl overflow-hidden bg-[#161B26] border border-white/[0.08] flex items-center justify-center">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={person.name}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-8 w-8 text-slate-500" />
                              )}
                            </div>
                            <p className="mt-2 text-xs font-semibold text-slate-100 truncate w-full">
                              {person.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate w-full">
                              {person.character}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: More like this */}
            {activeTab === 'similar' && (
              <section className="pt-2">
                {details.similar.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
                    {details.similar.map((sim) => (
                      <MediaCard
                        key={`sim-${sim.mediaType}-${sim.id}`}
                        item={sim}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl liquid-glass p-8 text-center text-sm text-slate-400">
                    No similar titles found for {details.title}.
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
