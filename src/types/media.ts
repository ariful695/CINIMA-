export type MediaType = 'movie' | 'tv';

export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  voteAverage: number;
  genreIds: number[];
  originalLanguage?: string;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  popularity?: number;
  imdbId?: string;
  /** Optional Dejavu-API item id when resolved from Dejavu-API */
  dejavuId?: string;
  /** Optional Internet Archive identifier (e.g., night_of_the_living_dead) */
  archiveIdentifier?: string;
  /** Optional flag marking classic archive feature film / show */
  isPublicDomain?: boolean;
  /** Optional local fallback artwork when no TMDB poster is loaded */
  fallbackPoster?: string;
  fallbackBackdrop?: string;
  /** Optional Zee Bangla / Bengali serial slug & latest episode label */
  bengaliSerialSlug?: string;
  latestEpisodeLabel?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface Episode {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string;
  runtime: number | null;
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
  airDate?: string;
}

export interface SeasonDetails {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

export interface MediaDetails extends MediaItem {
  runtime: number | null;
  tagline?: string;
  status?: string;
  logoPath?: string | null;
  logoPaths?: string[];
  genres: Genre[];
  cast: CastMember[];
  similar: MediaItem[];
  seasons?: SeasonSummary[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
}

export interface PersonSearchResult {
  id: number;
  name: string;
  knownForDepartment: string;
  profilePath: string | null;
  knownForTitles: string[];
}

export interface MultiSearchResults {
  moviesAndShows: MediaItem[];
  people: PersonSearchResult[];
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  format: 'vtt' | 'srt';
}

export interface StreamSource {
  id: string;
  providerName: string;
  label: string;
  quality: string;
  url: string;
  format: 'hls' | 'mp4' | 'youtube' | 'embed';
  isDefault?: boolean;
  audioLanguage?: string;
  sizeLabel?: string;
  seeders?: number;
  note?: string;
  isDirectPlayable?: boolean;
  isVerified?: boolean;
  extensionName?: string;
  /** Marks YouTube/embed sources that are full episodes (not studio trailers) */
  isFullEpisode?: boolean;
  thumbnailUrl?: string;
}

export interface StreamResolutionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
}

export type LiveCategory = 'All' | 'News' | 'Sports' | 'Entertainment' | 'Movies';

export interface LiveChannel {
  id: string;
  name: string;
  group: Exclude<LiveCategory, 'All'> | string;
  logo?: string;
  streamUrl: string;
  playlistId: string;
  playlistName: string;
  isLive: boolean;
  tvgId?: string;
  country?: string;
  language?: string;
}

export interface M3UPlaylistSource {
  id: string;
  name: string;
  url: string;
  rawContent?: string;
  enabled: boolean;
  channelCount?: number;
  lastSyncedAt?: string;
}

export interface JsonStreamEndpoint {
  id: string;
  name: string;
  urlTemplate: string;
  format: 'hls' | 'mp4' | 'json' | 'embed';
  enabled: boolean;
}

export interface WatchProgressItem {
  key: string;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  fallbackPoster?: string;
  fallbackBackdrop?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export type NavTab = 'home' | 'movies' | 'series' | 'live' | 'search' | 'library';

export type ThemeColor = 'red' | 'purple' | 'blue';

export interface ThemeAccentConfig {
  hex: string;
  name: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  glowRgb: string;
}

export const THEME_ACCENTS: Record<ThemeColor, ThemeAccentConfig> = {
  red: {
    hex: '#E50914',
    name: 'Red (Classic)',
    bgClass: 'bg-[#E50914]',
    textClass: 'text-[#E50914]',
    borderClass: 'border-[#E50914]/40',
    glowRgb: '229, 9, 20',
  },
  purple: {
    hex: '#8B5CF6',
    name: 'Purple (Neon)',
    bgClass: 'bg-[#8B5CF6]',
    textClass: 'text-[#8B5CF6]',
    borderClass: 'border-[#8B5CF6]/40',
    glowRgb: '139, 92, 246',
  },
  blue: {
    hex: '#3B82F6',
    name: 'Blue (Cyber)',
    bgClass: 'bg-[#3B82F6]',
    textClass: 'text-[#3B82F6]',
    borderClass: 'border-[#3B82F6]/40',
    glowRgb: '59, 130, 246',
  },
};

export type SportCategory = 'all' | 'International' | 'League' | 'Domestic' | 'Women';

export type SportsEventStatus = 'live' | 'upcoming' | 'recent';

export interface SportsBroadcastChannel {
  id: string;
  name: string;
  quality?: '4K' | 'FHD' | 'HD' | 'SD';
  streamUrl: string;
  logo?: string;
  country?: string;
  playlistName?: string;
  isVerifiedPlayable: boolean;
}

export interface SportsTeam {
  id?: number;
  name: string;
  shortName: string;
  flagUrl?: string;
  score?: string;
  accentColor?: string;
}

export interface SportsEvent {
  id: string;
  matchId?: number;
  matchType: string;
  leagueName: string;
  matchDesc: string;
  formatLabel?: string;
  status: SportsEventStatus;
  stateText: string;
  statusSummary: string;
  startTimeMs: number;
  endTimeMs?: number;
  venue?: string;
  team1: SportsTeam;
  team2: SportsTeam;
  channels: SportsBroadcastChannel[];
}

export interface ProviderToggles {
  torrentio: boolean;
  nuvio: boolean;
  meteor: boolean;
  torrentsdb: boolean;
  hdhub: boolean;
  notorrent: boolean;
  peerflix: boolean;
  cloudstream: boolean;
  dejavu: boolean;
  cinemeta: boolean;
  opensubtitles: boolean;
  bengali_serials: boolean;
  [key: string]: boolean;
}

export interface PlayerSession {
  mediaId: number;
  mediaType: MediaType | 'live';
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  fallbackPoster?: string;
  fallbackBackdrop?: string;
  imdbId?: string;
  dejavuId?: string;
  archiveIdentifier?: string;
  genreIds?: number[];
  originalLanguage?: string;
  releaseYear?: number;
  runtimeMinutes?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  initialTime?: number;
  preferredSourceId?: string;
  liveChannel?: LiveChannel;
  initialSources?: StreamSource[];
  initialSubtitles?: SubtitleTrack[];
  bengaliSerialSlug?: string;
  preferredVideoId?: string;
}

export interface ServerPickerTarget {
  mediaId: number;
  mediaType: MediaType;
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  fallbackPoster?: string;
  fallbackBackdrop?: string;
  imdbId?: string;
  dejavuId?: string;
  archiveIdentifier?: string;
  genreIds?: number[];
  originalLanguage?: string;
  releaseYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  initialTime?: number;
  isPublicDomain?: boolean;
  bengaliSerialSlug?: string;
  preferredVideoId?: string;
}

export interface StremioStream {
  url?: string;
  ytId?: string;
  externalUrl?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  title?: string;
  name?: string;
  description?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
}

export interface StremioStreamResponse {
  streams?: StremioStream[];
}

export interface StremioManifest {
  id: string;
  name: string;
  version?: string;
  description?: string;
  resources?: Array<string | { name: string; types?: string[]; idPrefixes?: string[] }>;
  types?: string[];
  idPrefixes?: string[];
  catalogs?: Array<{ type: string; id: string; name?: string }>;
  logo?: string;
}

export interface StremioAddonConfig {
  id: string;
  name: string;
  manifestUrl: string;
  baseUrl: string;
  enabled: boolean;
  description?: string;
  version?: string;
  logo?: string;
  addedAt?: number;
}

export interface KinoApiConfig {
  tmdbBaseUrl?: string;
  tmdbImageBase?: string;
  defaultTmdbApiKey?: string;
  defaultStreamEndpoints?: JsonStreamEndpoint[];
  defaultStremioAddons?: StremioAddonConfig[];
  iptvOrg?: {
    masterIndexUrl: string;
    indexCategoryUrl: string;
    categoryBaseUrl: string;
    countryBaseUrl: string;
    apiBaseUrl: string;
  };
  dejavuApi?: {
    baseUrl: string;
    routes?: {
      trendingMovies?: string;
      trendingTvShows?: string;
      latestMovies?: string;
      latestTvShows?: string;
      comingSoon?: string;
      search?: string;
      movieDetails?: string;
      tvDetails?: string;
    };
  };
  cricbuzzApi?: {
    baseUrl: string;
    rapidApiHost: string;
    rapidApiKey: string;
    routes?: {
      live?: string;
      upcoming?: string;
      recent?: string;
    };
  };
  sportsChannels?: Array<{
    id: string;
    name: string;
    quality?: '4K' | 'FHD' | 'HD' | 'SD';
    streamUrl: string;
    logo?: string;
    country?: string;
  }>;
}

export interface CloudStreamProviderItem {
  id: string;
  name: string;
  type: 'Series' | 'Movies' | 'Anime' | 'Livestream' | 'Others';
  version: string;
  size: string;
  description: string;
  downloaded: boolean;
  iconUrl?: string;
  lang?: string;
}

export interface CloudStreamRepository {
  id: string;
  name: string;
  url: string;
  description: string;
  author?: string;
  icon?: string;
  downloadedCount: number;
  totalCount: number;
  providers: CloudStreamProviderItem[];
}

export interface OfflineSubtitleTrack {
  id: string;
  label: string;
  language: string;
}

export interface OfflineDownloadItem {
  id: string;
  key: string;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  fallbackPoster?: string;
  fallbackBackdrop?: string;
  imdbId?: string;
  dejavuId?: string;
  archiveIdentifier?: string;
  originalLanguage?: string;
  releaseYear?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  providerName: string;
  quality: string;
  audioLanguage?: string;
  format: 'mp4' | 'hls';
  mimeType: string;
  sourceUrl: string;
  sourceId: string;
  status: 'queued' | 'downloading' | 'paused' | 'canceled' | 'completed' | 'failed';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  completedUnits: number;
  totalUnits: number;
  encryptionAlg: string;
  keyFingerprint: string;
  errorMessage?: string;
  subtitles?: OfflineSubtitleTrack[];
  createdAt: number;
  updatedAt: number;
}

declare global {
  interface Window {
    __KINO_API_CONFIG__?: KinoApiConfig;
  }
}
