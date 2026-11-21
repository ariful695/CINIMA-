import {
  LiveChannel,
  SportsBroadcastChannel,
  SportsEvent,
  SportsEventStatus,
} from '../types/media';
import { fetchAndParseIptvM3u, probeChannelPlayableInBrowser } from './iptvParser';

interface CricbuzzInningsScore {
  runs?: number;
  wickets?: number;
  overs?: number;
  isDeclared?: boolean;
}

interface CricbuzzRawMatch {
  matchInfo?: {
    matchId?: number;
    seriesId?: number;
    seriesName?: string;
    matchDesc?: string;
    matchFormat?: string;
    startDate?: string;
    endDate?: string;
    state?: string;
    status?: string;
    team1?: {
      teamId?: number;
      teamName?: string;
      teamSName?: string;
    };
    team2?: {
      teamId?: number;
      teamName?: string;
      teamSName?: string;
    };
    venueInfo?: {
      ground?: string;
      city?: string;
      country?: string;
    };
  };
  matchScore?: {
    team1Score?: {
      inngs1?: CricbuzzInningsScore;
      inngs2?: CricbuzzInningsScore;
    };
    team2Score?: {
      inngs1?: CricbuzzInningsScore;
      inngs2?: CricbuzzInningsScore;
    };
  };
}

interface CricbuzzSeriesWrapper {
  seriesAdWrapper?: {
    seriesId?: number;
    seriesName?: string;
    matches?: CricbuzzRawMatch[];
  };
}

interface CricbuzzTypeMatch {
  matchType?: string;
  seriesMatches?: CricbuzzSeriesWrapper[];
}

interface CricbuzzResponse {
  typeMatches?: CricbuzzTypeMatch[];
}

const CUSTOM_SPORTS_CHANNELS_KEY = 'kinostream_custom_sports_channels';

const COUNTRY_ISO_MAP: Array<[RegExp, string]> = [
  [/\bindia\b/i, 'in'],
  [/\bpakistan\b/i, 'pk'],
  [/\baustralia\b/i, 'au'],
  [/\bengland\b/i, 'gb-eng'],
  [/\bnew zealand\b/i, 'nz'],
  [/\bsouth africa\b/i, 'za'],
  [/\bsri lanka\b/i, 'lk'],
  [/\bbangladesh\b/i, 'bd'],
  [/\bafghanistan\b/i, 'af'],
  [/\bzimbabwe\b/i, 'zw'],
  [/\bireland\b/i, 'ie'],
  [/\bscotland\b/i, 'gb-sct'],
  [/\bnetherlands\b/i, 'nl'],
  [/\bnepal\b/i, 'np'],
  [/\bunited arab emirates|\buae\b/i, 'ae'],
  [/\bunited states|\busa\b/i, 'us'],
  [/\bcanada\b/i, 'ca'],
  [/\boman\b/i, 'om'],
  [/\bnamibia\b/i, 'na'],
  [/\bpapua new guinea|\bpng\b/i, 'pg'],
  [/\bthailand\b/i, 'th'],
  [/\bkenya\b/i, 'ke'],
  [/\buganda\b/i, 'ug'],
  [/\bhong kong\b/i, 'hk'],
  [/\bmalaysia\b/i, 'my'],
  [/\bsingapore\b/i, 'sg'],
  [/\bitaly\b/i, 'it'],
  [/\bbermuda\b/i, 'bm'],
  [/\btanzania\b/i, 'tz'],
  [/\bnigeria\b/i, 'ng'],
  [/\brwanda\b/i, 'rw'],
  [/\bjersey\b/i, 'je'],
  [/\bbhutan\b/i, 'bt'],
  [/\bkuwait\b/i, 'kw'],
  [/\bqatar\b/i, 'qa'],
  [/\bsaudi\b/i, 'sa'],
  [/\bmaldives\b/i, 'mv'],
  [/\bjapan\b/i, 'jp'],
  [/\bindonesia\b/i, 'id'],
  [/\bchina\b/i, 'cn'],
  [/\bwest indies\b/i, 'bb'],
];

const TEAM_COLORS = [
  '#2563EB',
  '#0891B2',
  '#E11D48',
  '#7C3AED',
  '#059669',
  '#D97706',
  '#4F46E5',
];

function getTeamFlagUrl(teamName: string): string | undefined {
  for (const [pattern, iso] of COUNTRY_ISO_MAP) {
    if (pattern.test(teamName)) {
      return `https://flagcdn.com/w80/${iso}.png`;
    }
  }
  return undefined;
}

function getTeamColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

function formatTeamScore(scoreObj?: {
  inngs1?: CricbuzzInningsScore;
  inngs2?: CricbuzzInningsScore;
}): string | undefined {
  if (!scoreObj) return undefined;
  const parts: string[] = [];
  for (const inngs of [scoreObj.inngs1, scoreObj.inngs2]) {
    if (!inngs || typeof inngs.runs !== 'number') continue;
    const wickets = typeof inngs.wickets === 'number' ? `/${inngs.wickets}` : '';
    const overs = typeof inngs.overs === 'number' ? ` (${inngs.overs})` : '';
    parts.push(`${inngs.runs}${wickets}${overs}`);
  }
  return parts.length > 0 ? parts.join(' & ') : undefined;
}

function getCricbuzzConfig() {
  const cfg = window.__KINO_API_CONFIG__?.cricbuzzApi;
  return {
    baseUrl: (cfg?.baseUrl || 'https://cricbuzz-cricket.p.rapidapi.com').replace(/\/+$/, ''),
    rapidApiHost: cfg?.rapidApiHost || 'cricbuzz-cricket.p.rapidapi.com',
    rapidApiKey: cfg?.rapidApiKey || '',
    routes: {
      live: cfg?.routes?.live || '/matches/v1/live',
      upcoming: cfg?.routes?.upcoming || '/matches/v1/upcoming',
      recent: cfg?.routes?.recent || '/matches/v1/recent',
    },
  };
}

function detectQualityTag(name: string): SportsBroadcastChannel['quality'] {
  const lower = name.toLowerCase();
  if (lower.includes('4k') || lower.includes('2160')) return '4K';
  if (lower.includes('1080') || lower.includes('fhd')) return 'FHD';
  if (lower.includes('720') || /\bhd\b/.test(lower)) return 'HD';
  if (lower.includes('576') || lower.includes('480') || lower.includes('360')) return 'SD';
  return undefined;
}

function cleanChannelTitle(rawName: string): string {
  return rawName
    .replace(/\s*\((?:1080p|720p|576p|576i|480p|360p|240p)\)/gi, '')
    .replace(/\s*\[(?:Geo-blocked|Not 24\/7)\]/gi, '')
    .trim();
}

function isSportsChannel(ch: LiveChannel): boolean {
  const text = `${ch.name} ${ch.group || ''}`;
  if (/eurovision|espn|bein|fifa|\bacc\b|golf|billiard|ninja|dart|poker|bowling|fishing|racing|nascar|moto|ufc|wwe/i.test(text)) {
    return false;
  }
  return /cricket|willow|star sports|sony sports|sony ten|ptv sports|a sports|t ?sports|dd sports|m sports|ten cricket|fox cricket|sky sports cricket|super ?sport cricket/i.test(
    ch.name
  );
}

function scoreSportsCandidate(ch: LiveChannel): number {
  const lowerName = ch.name.toLowerCase();
  const lowerUrl = ch.streamUrl.toLowerCase();
  let score = 0;

  if (!lowerUrl.startsWith('https://')) return -1000;
  if (lowerName.includes('[geo-blocked]')) score -= 60;
  if (/eurovision|espn|bein|fifa|\bacc\b|golf|billiard|ninja|dart|poker|bowling|fishing|racing/i.test(lowerName)) {
    return -500;
  }

  if (lowerName.includes('cricket')) score += 140;
  if (
    /\bdd sports\b|\bm sports\b|willow|star sports|a sports|t sports|tsports|ptv sports|sky sports|fox cricket|ten sports|sony sports/i.test(
      lowerName
    )
  ) {
    score += 130;
  }
  if (
    /rabta\.stream|cloudfront\.net|aynaott\.com|amagi\.tv|fastly\.net|mux\.dev|akamaized\.net|sofast\.tv|nellaiiptv\.com|amml\.in/.test(
      lowerUrl
    )
  ) {
    score += 45;
  }
  if (lowerUrl.includes('.m3u8')) score += 20;
  return score;
}

export function getCustomSportsChannels(): SportsBroadcastChannel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SPORTS_CHANNELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SportsBroadcastChannel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSportsChannel(input: {
  name: string;
  streamUrl: string;
}): SportsBroadcastChannel {
  const existing = getCustomSportsChannels();
  const cleanUrl = input.streamUrl.trim();
  const cleanName = input.name.trim() || 'Custom Sports Stream';
  const entry: SportsBroadcastChannel = {
    id: `custom-sport-${Date.now()}`,
    name: cleanName,
    quality: detectQualityTag(cleanName) || 'HD',
    streamUrl: cleanUrl,
    playlistName: 'Saved Custom Stream',
    isVerifiedPlayable: true,
  };
  const next = [entry, ...existing.filter((c) => c.streamUrl !== cleanUrl)];
  localStorage.setItem(CUSTOM_SPORTS_CHANNELS_KEY, JSON.stringify(next));
  cachedSportsResult = null;
  return entry;
}

export function removeCustomSportsChannel(id: string): SportsBroadcastChannel[] {
  const next = getCustomSportsChannels().filter((c) => c.id !== id);
  localStorage.setItem(CUSTOM_SPORTS_CHANNELS_KEY, JSON.stringify(next));
  cachedSportsResult = null;
  return next;
}

export function getPendingSportsChannelSlots(
  customSaved: SportsBroadcastChannel[]
): Array<{ id: string; name: string; quality?: '4K' | 'FHD' | 'HD' | 'SD'; country?: string }> {
  const configured = window.__KINO_API_CONFIG__?.sportsChannels || [];
  const savedNames = new Set(customSaved.map((c) => c.name.trim().toLowerCase()));
  return configured
    .filter((ch) => !ch.streamUrl?.trim() && !savedNames.has(ch.name.trim().toLowerCase()))
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      quality: ch.quality,
      country: ch.country,
    }));
}

let cachedVerifiedSportsChannels: SportsBroadcastChannel[] | null = null;
let verifiedCacheTimestamp = 0;
const VERIFIED_CHANNELS_TTL_MS = 10 * 60_000;
const VERIFIED_CHANNELS_SESSION_KEY = 'kinostream_verified_sports_channels_v1';

function readVerifiedSessionCache(): SportsBroadcastChannel[] | null {
  try {
    const raw = sessionStorage.getItem(VERIFIED_CHANNELS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp?: number; channels?: SportsBroadcastChannel[] };
    if (
      parsed &&
      typeof parsed.timestamp === 'number' &&
      Date.now() - parsed.timestamp < VERIFIED_CHANNELS_TTL_MS &&
      Array.isArray(parsed.channels) &&
      parsed.channels.length > 0
    ) {
      return parsed.channels;
    }
  } catch {
    // Ignore storage read failure
  }
  return null;
}

function writeVerifiedSessionCache(channels: SportsBroadcastChannel[]): void {
  try {
    sessionStorage.setItem(
      VERIFIED_CHANNELS_SESSION_KEY,
      JSON.stringify({ timestamp: Date.now(), channels })
    );
  } catch {
    // Ignore storage write failure
  }
}

async function getVerifiedPlayableSportsChannels(
  appLiveChannels: LiveChannel[],
  forceRefresh = false
): Promise<SportsBroadcastChannel[]> {
  const customSaved = getCustomSportsChannels();

  if (!forceRefresh) {
    if (
      cachedVerifiedSportsChannels &&
      cachedVerifiedSportsChannels.length > 0 &&
      Date.now() - verifiedCacheTimestamp < VERIFIED_CHANNELS_TTL_MS
    ) {
      const customUrls = new Set(customSaved.map((c) => c.streamUrl));
      return [
        ...customSaved,
        ...cachedVerifiedSportsChannels.filter((c) => !customUrls.has(c.streamUrl)),
      ];
    }
    const sessionHit = readVerifiedSessionCache();
    if (sessionHit) {
      cachedVerifiedSportsChannels = sessionHit;
      verifiedCacheTimestamp = Date.now();
      const customUrls = new Set(customSaved.map((c) => c.streamUrl));
      return [...customSaved, ...sessionHit.filter((c) => !customUrls.has(c.streamUrl))];
    }
  }

  const iptvCfg = window.__KINO_API_CONFIG__?.iptvOrg;
  const catBase = iptvCfg?.categoryBaseUrl || 'https://iptv-org.github.io/iptv/categories';
  const countryBase = iptvCfg?.countryBaseUrl || 'https://iptv-org.github.io/iptv/countries';

  const feedConfigs = [
    { url: `${catBase}/sports.m3u`, id: 'iptv-org-sports', name: 'iptv-org · Sports' },
    { url: `${countryBase}/in.m3u`, id: 'iptv-org-in', name: 'iptv-org · India' },
    { url: `${countryBase}/pk.m3u`, id: 'iptv-org-pk', name: 'iptv-org · Pakistan' },
    { url: `${countryBase}/bd.m3u`, id: 'iptv-org-bd', name: 'iptv-org · Bangladesh' },
  ];

  const feedResults = await Promise.all(
    feedConfigs.map((fc) =>
      fetchAndParseIptvM3u({
        url: fc.url,
        playlistId: fc.id,
        playlistName: fc.name,
        forceRefresh,
      }).catch(() => ({ channels: [] as LiveChannel[], sourceUrl: fc.url }))
    )
  );

  const seen = new Set<string>();
  const candidates: LiveChannel[] = [];

  const htmlConfiguredChannels: LiveChannel[] = (
    window.__KINO_API_CONFIG__?.sportsChannels || []
  )
    .filter((ch) => /^https?:\/\//i.test(ch.streamUrl || ''))
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      group: 'Sports',
      logo: ch.logo,
      streamUrl: ch.streamUrl,
      playlistId: 'html-sports-config',
      playlistName: 'Configured Sports Feed',
      isLive: true,
      country: ch.country,
    }));

  const appSports = appLiveChannels.filter(
    (c) => c.streamUrl.startsWith('https://') && isSportsChannel(c)
  );

  const regionalSports = feedResults.flatMap((res) => res.channels.filter(isSportsChannel));

  for (const ch of [...htmlConfiguredChannels, ...appSports, ...regionalSports]) {
    if (!ch.streamUrl.startsWith('https://')) continue;
    if (seen.has(ch.streamUrl)) continue;
    seen.add(ch.streamUrl);
    candidates.push(ch);
  }

  candidates.sort((a, b) => scoreSportsCandidate(b) - scoreSportsCandidate(a));

  // Probe top 12 cricket/regional candidates in parallel with fast 4.5s budget (no 15s+ sequential wait)
  const topCandidates = candidates.slice(0, 12);
  const settled = await Promise.all(
    topCandidates.map(async (ch) => {
      const ok = await probeChannelPlayableInBrowser(ch.streamUrl, 4500);
      return { ch, ok };
    })
  );

  const verified: SportsBroadcastChannel[] = [];
  for (const item of settled) {
    if (item.ok) {
      verified.push({
        id: item.ch.id,
        name: cleanChannelTitle(item.ch.name),
        quality: detectQualityTag(item.ch.name),
        streamUrl: item.ch.streamUrl,
        logo: item.ch.logo,
        country: item.ch.country,
        playlistName: item.ch.playlistName,
        isVerifiedPlayable: true,
      });
    }
  }

  cachedVerifiedSportsChannels = verified;
  verifiedCacheTimestamp = Date.now();
  if (verified.length > 0) {
    writeVerifiedSessionCache(verified);
  }

  const customUrls = new Set(customSaved.map((c) => c.streamUrl));
  return [...customSaved, ...verified.filter((c) => !customUrls.has(c.streamUrl))];
}

function pickChannelsForMatch(
  matchInfo: NonNullable<CricbuzzRawMatch['matchInfo']>,
  matchType: string,
  verifiedChannels: SportsBroadcastChannel[]
): SportsBroadcastChannel[] {
  if (verifiedChannels.length === 0) return [];

  const context = `${matchType} ${matchInfo.seriesName || ''} ${matchInfo.venueInfo?.country || ''} ${
    matchInfo.team1?.teamName || ''
  } ${matchInfo.team2?.teamName || ''}`.toLowerCase();

  const cricketOnly = verifiedChannels.filter(
    (ch) => !/eurovision|espn|bein|fifa|\bacc\b/i.test(ch.name)
  );
  const pool = cricketOnly.length > 0 ? cricketOnly : verifiedChannels;

  const scored = pool.map((ch) => {
    const name = ch.name.toLowerCase();
    let rel = 0;
    if (ch.playlistName === 'Saved Custom Stream') rel += 200;
    if (ch.playlistName === 'Configured Sports Feed') rel += 120;
    if (ch.playlistName && !ch.playlistName.toLowerCase().includes('iptv-org')) {
      rel += 90;
    }
    if (name.includes('star sports') || name.includes('sony sports') || name.includes('sony ten')) {
      rel += 110;
    }
    if (name.includes('cricket')) rel += 60;
    if (name.includes('dd sports')) {
      rel += context.includes('india') || context.includes('women') ? 65 : 40;
    }
    if (name.includes('m sports') || name.includes('ptv') || name.includes('a sports')) {
      rel += context.includes('pakistan') || context.includes('abu dhabi') ? 65 : 40;
    }
    if (name.includes('t sports') || name.includes('tsports')) {
      rel += context.includes('bangladesh') || context.includes('nepal') ? 65 : 40;
    }
    return { ch, rel };
  });

  scored.sort((a, b) => b.rel - a.rel);
  return scored.slice(0, 8).map((item) => item.ch);
}

function classifyMatchStatus(
  endpointType: SportsEventStatus,
  state?: string,
  startTimeMs?: number
): SportsEventStatus {
  const s = (state || '').toLowerCase();
  if (s.includes('complete') || s.includes('abandon') || s.includes('no result')) {
    return 'recent';
  }
  if (s.includes('preview') || s.includes('upcoming')) {
    return 'upcoming';
  }
  if (endpointType === 'live') {
    return 'live';
  }
  if (endpointType === 'upcoming' && startTimeMs && startTimeMs < Date.now() - 2 * 60 * 60 * 1000) {
    return 'upcoming';
  }
  return endpointType;
}

function parseCricbuzzPayload(
  payload: CricbuzzResponse,
  endpointType: SportsEventStatus,
  verifiedChannels: SportsBroadcastChannel[]
): SportsEvent[] {
  const events: SportsEvent[] = [];
  const typeMatches = Array.isArray(payload?.typeMatches) ? payload.typeMatches : [];

  for (const tm of typeMatches) {
    const matchType = tm.matchType || 'International';
    const seriesMatches = Array.isArray(tm.seriesMatches) ? tm.seriesMatches : [];
    for (const sm of seriesMatches) {
      const wrapper = sm.seriesAdWrapper;
      if (!wrapper || !Array.isArray(wrapper.matches)) continue;
      for (const m of wrapper.matches) {
        const info = m.matchInfo;
        if (!info || !info.team1 || !info.team2) continue;

        const matchId = info.matchId || Math.floor(Math.random() * 1_000_000);
        const startTimeMs = Number(info.startDate) || Date.now();
        const endTimeMs = Number(info.endDate) || undefined;
        const status = classifyMatchStatus(endpointType, info.state, startTimeMs);

        const team1Name = info.team1.teamName || info.team1.teamSName || 'Team 1';
        const team2Name = info.team2.teamName || info.team2.teamSName || 'Team 2';
        const team1Short = info.team1.teamSName || team1Name.slice(0, 4).toUpperCase();
        const team2Short = info.team2.teamSName || team2Name.slice(0, 4).toUpperCase();

        const seriesName = info.seriesName || wrapper.seriesName || matchType;
        const venueParts = [info.venueInfo?.ground, info.venueInfo?.city].filter(Boolean);

        events.push({
          id: `cricket-${matchId}`,
          matchId,
          matchType,
          leagueName: seriesName,
          matchDesc: info.matchDesc || info.matchFormat || 'Match',
          formatLabel: info.matchFormat,
          status,
          stateText:
            info.state ||
            (status === 'live' ? 'Live' : status === 'upcoming' ? 'Upcoming' : 'Complete'),
          statusSummary: info.status || info.state || '',
          startTimeMs,
          endTimeMs,
          venue: venueParts.length > 0 ? venueParts.join(', ') : undefined,
          team1: {
            id: info.team1.teamId,
            name: team1Name,
            shortName: team1Short,
            flagUrl: getTeamFlagUrl(team1Name),
            score: formatTeamScore(m.matchScore?.team1Score),
            accentColor: getTeamColor(team1Name),
          },
          team2: {
            id: info.team2.teamId,
            name: team2Name,
            shortName: team2Short,
            flagUrl: getTeamFlagUrl(team2Name),
            score: formatTeamScore(m.matchScore?.team2Score),
            accentColor: getTeamColor(team2Name),
          },
          channels: pickChannelsForMatch(info, matchType, verifiedChannels),
        });
      }
    }
  }

  return events;
}

let cachedSportsResult: { timestamp: number; events: SportsEvent[]; error?: string } | null = null;
const CACHE_TTL_MS = 25_000;

export const cricbuzzService = {
  async fetchSportsEvents(
    appLiveChannels: LiveChannel[] = [],
    forceRefresh = false
  ): Promise<{
    events: SportsEvent[];
    verifiedChannels: SportsBroadcastChannel[];
    error?: string;
    apiConfigured: boolean;
  }> {
    const cfg = getCricbuzzConfig();
    if (!cfg.rapidApiKey) {
      return {
        events: [],
        verifiedChannels: [],
        error: 'Cricbuzz RapidAPI key is missing in index.html.',
        apiConfigured: false,
      };
    }

    const verifiedChannels = await getVerifiedPlayableSportsChannels(
      appLiveChannels,
      forceRefresh
    );

    if (
      !forceRefresh &&
      cachedSportsResult &&
      Date.now() - cachedSportsResult.timestamp < CACHE_TTL_MS
    ) {
      return {
        events: cachedSportsResult.events,
        verifiedChannels,
        error: cachedSportsResult.error,
        apiConfigured: true,
      };
    }

    const headers: Record<string, string> = {
      'x-rapidapi-host': cfg.rapidApiHost,
      'x-rapidapi-key': cfg.rapidApiKey,
    };

    const fetchEndpoint = async (
      path: string,
      endpointType: SportsEventStatus
    ): Promise<{ items: SportsEvent[]; error?: string }> => {
      try {
        const res = await fetch(`${cfg.baseUrl}${path}`, { headers });
        if (!res.ok) {
          return {
            items: [],
            error: `Cricbuzz API ${path} returned HTTP ${res.status}`,
          };
        }
        const json = (await res.json()) as CricbuzzResponse;
        return { items: parseCricbuzzPayload(json, endpointType, verifiedChannels) };
      } catch (err) {
        return {
          items: [],
          error: err instanceof Error ? err.message : 'Network error calling Cricbuzz API',
        };
      }
    };

    const [liveRes, upcomingRes, recentRes] = await Promise.all([
      fetchEndpoint(cfg.routes.live, 'live'),
      fetchEndpoint(cfg.routes.upcoming, 'upcoming'),
      fetchEndpoint(cfg.routes.recent, 'recent'),
    ]);

    const priority: Record<SportsEventStatus, number> = {
      live: 0,
      upcoming: 1,
      recent: 2,
    };

    const deduped = new Map<string, SportsEvent>();
    for (const item of [...liveRes.items, ...upcomingRes.items, ...recentRes.items]) {
      const existing = deduped.get(item.id);
      if (!existing || priority[item.status] < priority[existing.status]) {
        deduped.set(item.id, item);
      }
    }

    const allEvents = Array.from(deduped.values()).sort((a, b) => {
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      if (a.status === 'upcoming') {
        return a.startTimeMs - b.startTimeMs;
      }
      return b.startTimeMs - a.startTimeMs;
    });

    const firstError =
      allEvents.length === 0
        ? liveRes.error || upcomingRes.error || recentRes.error
        : undefined;

    cachedSportsResult = {
      timestamp: Date.now(),
      events: allEvents,
      error: firstError,
    };

    return {
      events: allEvents,
      verifiedChannels,
      error: firstError,
      apiConfigured: true,
    };
  },

  clearCache(): void {
    cachedSportsResult = null;
    cachedVerifiedSportsChannels = null;
    verifiedCacheTimestamp = 0;
    try {
      sessionStorage.removeItem(VERIFIED_CHANNELS_SESSION_KEY);
    } catch {
      // Ignore storage clear failure
    }
  },
};
