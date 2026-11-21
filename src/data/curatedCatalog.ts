import { Genre, MediaDetails, MediaItem, SeasonDetails } from '../types/media';

import heroNeonHorizon from '../assets/images/hero_neon_horizon_1794585802980.jpg';
import heroOrbitalDrift from '../assets/images/hero_orbital_drift_1794585801884.jpg';
import heroSilentFjord from '../assets/images/hero_silent_fjord_1794585803921.jpg';
import posterCrimsonVelvet from '../assets/images/poster_crimson_velvet_1794585803828.jpg';
import posterAlpineApex from '../assets/images/poster_alpine_apex_1794585805225.jpg';

export const FALLBACK_ART = {
  heroNeonHorizon,
  heroOrbitalDrift,
  heroSilentFjord,
  posterCrimsonVelvet,
  posterAlpineApex,
};

export const TMDB_GENRES: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 14, name: 'Fantasy' },
  { id: 27, name: 'Horror' },
  { id: 9648, name: 'Mystery' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
];

export const CURATED_MOVIES: MediaItem[] = [
  {
    id: 90101,
    mediaType: 'movie',
    title: 'Neon Horizon: Protocol Zero',
    overview:
      'In a rain-drenched orbital megacity, an archival investigator uncovers a black-market memory ledger that links the municipal AI grid to a vanished colony transport.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: posterCrimsonVelvet,
    fallbackBackdrop: heroNeonHorizon,
    releaseDate: '2026-03-14',
    voteAverage: 8.6,
    genreIds: [878, 53, 80],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en', 'es', 'fr'],
    imdbId: 'tt9010101',
    popularity: 980,
  },
  {
    id: 90102,
    mediaType: 'movie',
    title: 'Orbital Drift',
    overview:
      'When a deep-range survey vessel loses gravitational lock around a ringed gas giant, the five-person flight crew has eleven hours to slingshot home before solar flare blackout.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: heroOrbitalDrift,
    fallbackBackdrop: heroOrbitalDrift,
    releaseDate: '2025-11-22',
    voteAverage: 8.9,
    genreIds: [878, 12, 18],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en', 'hi', 'es'],
    imdbId: 'tt9010102',
    popularity: 945,
  },
  {
    id: 90103,
    mediaType: 'movie',
    title: 'The Silent Fjord',
    overview:
      'A coastal hydrographer returning to northern Norway for winter decommissioning discovers an unmarked submarine cable running directly beneath her family lighthouse.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: heroSilentFjord,
    fallbackBackdrop: heroSilentFjord,
    releaseDate: '2025-09-08',
    voteAverage: 8.2,
    genreIds: [9648, 53, 18],
    originalLanguage: 'no',
    audioLanguages: ['no', 'en'],
    subtitleLanguages: ['en', 'no'],
    imdbId: 'tt9010103',
    popularity: 860,
  },
  {
    id: 90104,
    mediaType: 'movie',
    title: 'Crimson Velvet Heist',
    overview:
      'Forty-eight hours before the sovereign vault migration in Prague, a retired acoustic engineer is coerced into cracking a lock that responds only to live orchestral frequencies.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: posterCrimsonVelvet,
    fallbackBackdrop: heroNeonHorizon,
    releaseDate: '2026-01-19',
    voteAverage: 8.4,
    genreIds: [80, 28, 53],
    originalLanguage: 'en',
    audioLanguages: ['en', 'fr'],
    subtitleLanguages: ['en', 'fr'],
    imdbId: 'tt9010104',
    popularity: 830,
  },
  {
    id: 90105,
    mediaType: 'movie',
    title: 'Alpine Apex',
    overview:
      'Two rival winter mountaineers trapped by an unseasonal whiteout on K2 must share a single damaged oxygen regulator across a three-day descent.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: posterAlpineApex,
    fallbackBackdrop: posterAlpineApex,
    releaseDate: '2025-12-05',
    voteAverage: 8.5,
    genreIds: [12, 18, 28],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en', 'de'],
    imdbId: 'tt9010105',
    popularity: 790,
  },
  {
    id: 90106,
    mediaType: 'movie',
    title: 'Tears of Steel: Remastered',
    overview:
      'In a futuristic Amsterdam, a group of warriors and scientists gather at the Oude Kerk in a desperate attempt to rescue the city from mechanized sentinels.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: heroNeonHorizon,
    fallbackBackdrop: heroNeonHorizon,
    releaseDate: '2024-07-12',
    voteAverage: 7.9,
    genreIds: [878, 28],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en', 'es', 'fr', 'de'],
    imdbId: 'tt2285752',
    popularity: 710,
  },
];

export const CURATED_SERIES: MediaItem[] = [
  {
    id: 95201,
    mediaType: 'tv',
    title: 'North Sea Signal',
    overview:
      'After an offshore wind platform captures an encrypted analog broadcast from 1984, maritime intelligence officers race across Aberdeen and Bergen to trace its origin.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: heroSilentFjord,
    fallbackBackdrop: heroSilentFjord,
    releaseDate: '2025-10-14',
    voteAverage: 8.8,
    genreIds: [9648, 18, 53],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en'],
    imdbId: 'tt9520101',
    popularity: 920,
  },
  {
    id: 95202,
    mediaType: 'tv',
    title: 'Helios Station',
    overview:
      'Life aboard the first commercial Lagrange-point shipyard fractures when supply ships from Earth stop answering telemetry pings for six consecutive weeks.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: heroOrbitalDrift,
    fallbackBackdrop: heroOrbitalDrift,
    releaseDate: '2026-02-02',
    voteAverage: 9.0,
    genreIds: [878, 18],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en', 'hi', 'es'],
    imdbId: 'tt9520102',
    popularity: 960,
  },
  {
    id: 95203,
    mediaType: 'tv',
    title: 'Nighthawk Precinct',
    overview:
      'Inside District 9, night-shift cyber-forensics detectives untangle synthetic identity syndicates operating beneath neon transit corridors.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: posterCrimsonVelvet,
    fallbackBackdrop: heroNeonHorizon,
    releaseDate: '2025-05-18',
    voteAverage: 8.3,
    genreIds: [80, 18, 9648],
    originalLanguage: 'en',
    audioLanguages: ['en'],
    subtitleLanguages: ['en'],
    imdbId: 'tt9520103',
    popularity: 815,
  },
  {
    id: 95204,
    mediaType: 'tv',
    title: 'Ridge Line',
    overview:
      'Elite alpine search-and-rescue paramedics patrol the Dolomites through extreme winter storms while confronting a string of staged climbing accidents.',
    posterPath: null,
    backdropPath: null,
    fallbackPoster: posterAlpineApex,
    fallbackBackdrop: posterAlpineApex,
    releaseDate: '2025-08-29',
    voteAverage: 8.1,
    genreIds: [12, 18, 53],
    originalLanguage: 'it',
    audioLanguages: ['it', 'en'],
    subtitleLanguages: ['en', 'it'],
    imdbId: 'tt9520104',
    popularity: 750,
  },
];

export const ALL_CURATED_MEDIA: MediaItem[] = [...CURATED_MOVIES, ...CURATED_SERIES];

export function getCuratedDetails(id: number, mediaType: 'movie' | 'tv'): MediaDetails | null {
  const base = ALL_CURATED_MEDIA.find((item) => item.id === id && item.mediaType === mediaType);
  if (!base) return null;

  const genres = base.genreIds
    .map((gid) => TMDB_GENRES.find((g) => g.id === gid))
    .filter((g): g is Genre => Boolean(g));

  const cast = [
    { id: 1, name: 'Elena Rostova', character: 'Commander Kira Vance', profilePath: null },
    { id: 2, name: 'Marcus Thorne', character: 'Director Julian Hale', profilePath: null },
    { id: 3, name: 'Soren Lindqvist', character: 'Henrik Solberg', profilePath: null },
    { id: 4, name: 'Amina Kael', character: 'Dr. Nadia Okafor', profilePath: null },
    { id: 5, name: 'Kenji Takahashi', character: 'Lead Systems Architect', profilePath: null },
    { id: 6, name: 'Clara Moreau', character: 'Inspector Evelyn Ward', profilePath: null },
  ];

  const similar = ALL_CURATED_MEDIA.filter((m) => m.id !== base.id).slice(0, 6);

  if (mediaType === 'tv') {
    return {
      ...base,
      runtime: 52,
      tagline: 'Every frequency leaves a trace.',
      status: 'Returning Series',
      genres,
      cast,
      similar,
      numberOfSeasons: 2,
      numberOfEpisodes: 10,
      seasons: [
        { id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 6, posterPath: null, airDate: base.releaseDate },
        { id: 2, seasonNumber: 2, name: 'Season 2', episodeCount: 4, posterPath: null, airDate: '2026-04-01' },
      ],
    };
  }

  return {
    ...base,
    runtime: 134,
    tagline: 'Signal lost. Truth recovered.',
    status: 'Released',
    genres,
    cast,
    similar,
  };
}

export function getCuratedSeasonDetails(tvId: number, seasonNumber: number): SeasonDetails {
  const series = CURATED_SERIES.find((s) => s.id === tvId);
  const backdrop = series?.fallbackBackdrop || heroNeonHorizon;
  const count = seasonNumber === 1 ? 6 : 4;

  const episodeTitles: Record<number, string[]> = {
    1: [
      'Cold Carrier Wave',
      'Subsurface Relay',
      'Blind Telemetry',
      'Dead Reckoning',
      'The Amber Corridor',
      'Zero Meridian',
    ],
    2: [
      'Ghost Horizon',
      'Fractured Orbit',
      'Silent Harbour',
      'Final Transmission',
    ],
  };

  const titles = episodeTitles[seasonNumber] || episodeTitles[1];

  return {
    seasonNumber,
    name: `Season ${seasonNumber}`,
    episodes: Array.from({ length: count }, (_, idx) => {
      const epNum = idx + 1;
      return {
        id: tvId * 100 + seasonNumber * 10 + epNum,
        episodeNumber: epNum,
        seasonNumber,
        name: titles[idx] || `Episode ${epNum}`,
        overview:
          'New telemetry intercepts reveal an unexpected shift in operations while the team races against deteriorating conditions to secure the primary uplink.',
        stillPath: null,
        airDate: `2025-1${seasonNumber}-0${epNum}`,
        runtime: 44 + ((epNum * 3) % 14),
        // Custom property used via fallback check in component
        ...(backdrop ? {} : {}),
      };
    }),
  };
}
