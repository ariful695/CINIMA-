import {
  JsonStreamEndpoint,
  M3UPlaylistSource,
  MediaItem,
  ProviderToggles,
  StremioAddonConfig,
  ThemeColor,
  WatchProgressItem,
} from '../types/media';
import { STREMIO_ADDONS_NET_DIRECTORY } from '../data/nuvioAndStremioCatalog';

const KEYS = {
  TMDB_API_KEY: 'kinostream_tmdb_api_key',
  WATCHLIST: 'kinostream_watchlist',
  CONTINUE_WATCHING: 'kinostream_continue_watching',
  JSON_ENDPOINTS: 'kinostream_json_endpoints',
  M3U_PLAYLISTS: 'kinostream_m3u_playlists',
  STREMIO_ADDONS: 'kinostream_stremio_addons',
  RECENT_SEARCHES: 'kinostream_recent_searches',
  PREFERRED_QUALITY: 'kinostream_preferred_quality',
  FAVORITE_CHANNELS: 'kinostream_favorite_channels',
  PROVIDER_TOGGLES: 'kinostream_provider_toggles',
} as const;

export const DEFAULT_PROVIDER_TOGGLES: ProviderToggles = {
  torrentio: true,
  nuvio: true,
  meteor: true,
  torrentsdb: true,
  hdhub: true,
  notorrent: true,
  peerflix: true,
  cloudstream: true,
  dejavu: true,
  cinemeta: true,
  opensubtitles: true,
};

export const DEFAULT_JSON_ENDPOINTS: JsonStreamEndpoint[] = [];

export const DEFAULT_TORRENTIO_ADDON: StremioAddonConfig = {
  id: 'stremio-torrentio',
  name: 'Torrentio',
  manifestUrl:
    'https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl|sort=seeders/manifest.json',
  baseUrl:
    'https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl|sort=seeders',
  enabled: true,
  description: 'Multi-resolution P2P stream provider via BitTorrent',
  version: '0.0.15',
};

export const DEFAULT_VERIFIED_STREAM_ADDONS: StremioAddonConfig[] = [
  DEFAULT_TORRENTIO_ADDON,
  {
    id: 'stremio-meteor',
    name: 'Meteor P2P',
    manifestUrl: 'https://meteorfortheweebs.midnightignite.me/stremio/manifest.json',
    baseUrl: 'https://meteorfortheweebs.midnightignite.me/stremio',
    enabled: true,
    description: 'High-availability P2P streams for movies, series & anime',
    version: '1.0.0',
  },
  {
    id: 'stremio-torrentsdb',
    name: 'TorrentsDB',
    manifestUrl: 'https://torrentsdb.com/manifest.json',
    baseUrl: 'https://torrentsdb.com',
    enabled: true,
    description: 'Indexed torrent & web streams for movies and TV shows',
    version: '1.0.0',
  },
  {
    id: 'stremio-hdhub',
    name: 'HdHub (Hindi & Multi)',
    manifestUrl:
      'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json',
    baseUrl:
      'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9',
    enabled: true,
    description: 'Direct & multi-audio Hindi/English streams for movies and series',
    version: '1.0.0',
  },
  {
    id: 'stremio-nuvio-streams',
    name: 'Nuvio Streams (Direct HTTP)',
    manifestUrl: 'https://nuviostreams.hayd.uk/manifest.json',
    baseUrl: 'https://nuviostreams.hayd.uk',
    enabled: true,
    description: 'Direct HTTP & multi-language streams for movies and TV shows',
    version: '1.0.0',
  },
  {
    id: 'stremio-webstreamr-mbg',
    name: 'WebStreamrMBG (Direct HTTP)',
    manifestUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json',
    baseUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club',
    enabled: true,
    description: 'Direct HTTPS multi-language web streams for movies and series',
    version: '1.0.0',
  },
  {
    id: 'stremio-torrentclaw',
    name: 'TorrentClaw',
    manifestUrl: 'https://torrentclaw.com/api/stremio/manifest.json',
    baseUrl: 'https://torrentclaw.com/api/stremio',
    enabled: true,
    description: 'Fast P2P & web-dl mirror aggregator for movies and series',
    version: '1.0.0',
  },
  {
    id: 'stremio-peerflix',
    name: 'Peerflix',
    manifestUrl: 'https://peerflix.mov/manifest.json',
    baseUrl: 'https://peerflix.mov',
    enabled: true,
    description: 'Fast multi-language P2P community streams for movies & series',
    version: '1.0.0',
  },
  {
    id: 'stremio-pipe',
    name: 'Pipe Streams',
    manifestUrl: 'https://pipe.boringways.workers.dev/manifest.json',
    baseUrl: 'https://pipe.boringways.workers.dev',
    enabled: true,
    description: 'Fast workers-backed torrent stream index for series & movies',
    version: '1.0.0',
  },
  {
    id: 'stremio-icv',
    name: 'IlCorsaroViola',
    manifestUrl: 'https://icv.stremio-italia.eu/manifest.json',
    baseUrl: 'https://icv.stremio-italia.eu',
    enabled: true,
    description: 'Multi-resolution European & English stream index',
    version: '1.0.0',
  },
];

export const DEFAULT_STREMIO_ADDONS: StremioAddonConfig[] = [
  ...DEFAULT_VERIFIED_STREAM_ADDONS,
  {
    id: 'stremio-cinemeta',
    name: 'Cinemeta Official',
    manifestUrl: 'https://v3-cinemeta.strem.io/manifest.json',
    baseUrl: 'https://v3-cinemeta.strem.io',
    enabled: true,
    description: 'Official IMDb and TVDb metadata catalog for Stremio',
    version: '3.0.12',
  },
  {
    id: 'stremio-opensubtitles',
    name: 'OpenSubtitles v3',
    manifestUrl: 'https://opensubtitles-v3.strem.io/manifest.json',
    baseUrl: 'https://opensubtitles-v3.strem.io',
    enabled: true,
    description: 'Multi-language subtitle provider for movies and series',
    version: '1.0.0',
  },
];

export const DEFAULT_M3U_PLAYLISTS: M3UPlaylistSource[] = [
  {
    id: 'builtin-open-channels',
    name: 'Open Broadcast Channels (Built-in)',
    url: 'builtin://open-channels.m3u',
    enabled: true,
    channelCount: 8,
    lastSyncedAt: new Date().toISOString(),
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const storageService = {
  getTmdbApiKey(): string {
    const stored = localStorage.getItem(KEYS.TMDB_API_KEY);
    if (stored !== null) return stored.trim();
    return window.__KINO_API_CONFIG__?.defaultTmdbApiKey?.trim() || '';
  },

  setTmdbApiKey(apiKey: string): void {
    localStorage.setItem(KEYS.TMDB_API_KEY, apiKey.trim());
  },

  getWatchlist(): MediaItem[] {
    return safeParse<MediaItem[]>(localStorage.getItem(KEYS.WATCHLIST), []);
  },

  saveWatchlist(items: MediaItem[]): void {
    localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(items));
  },

  getContinueWatching(): WatchProgressItem[] {
    const items = safeParse<WatchProgressItem[]>(
      localStorage.getItem(KEYS.CONTINUE_WATCHING),
      []
    );
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  upsertContinueWatching(item: WatchProgressItem): WatchProgressItem[] {
    const list = this.getContinueWatching().filter((existing) => existing.key !== item.key);
    const updated = [item, ...list].slice(0, 24);
    localStorage.setItem(KEYS.CONTINUE_WATCHING, JSON.stringify(updated));
    return updated;
  },

  removeContinueWatching(key: string): WatchProgressItem[] {
    const updated = this.getContinueWatching().filter((item) => item.key !== key);
    localStorage.setItem(KEYS.CONTINUE_WATCHING, JSON.stringify(updated));
    return updated;
  },

  clearContinueWatching(): void {
    localStorage.removeItem(KEYS.CONTINUE_WATCHING);
  },

  getJsonEndpoints(): JsonStreamEndpoint[] {
    const stored = safeParse<JsonStreamEndpoint[] | null>(
      localStorage.getItem(KEYS.JSON_ENDPOINTS),
      null
    );
    if (stored && Array.isArray(stored)) {
      return stored.filter((e) => !e.urlTemplate.includes('test-streams.mux.dev'));
    }
    return window.__KINO_API_CONFIG__?.defaultStreamEndpoints || DEFAULT_JSON_ENDPOINTS;
  },

  saveJsonEndpoints(endpoints: JsonStreamEndpoint[]): void {
    localStorage.setItem(KEYS.JSON_ENDPOINTS, JSON.stringify(endpoints));
  },

  getM3UPlaylists(): M3UPlaylistSource[] {
    const stored = safeParse<M3UPlaylistSource[] | null>(
      localStorage.getItem(KEYS.M3U_PLAYLISTS),
      null
    );
    if (stored && Array.isArray(stored)) return stored;
    return DEFAULT_M3U_PLAYLISTS;
  },

  saveM3UPlaylists(playlists: M3UPlaylistSource[]): void {
    localStorage.setItem(KEYS.M3U_PLAYLISTS, JSON.stringify(playlists));
  },

  getRecentSearches(): string[] {
    return safeParse<string[]>(localStorage.getItem(KEYS.RECENT_SEARCHES), []);
  },

  addRecentSearch(query: string): string[] {
    const clean = query.trim();
    if (!clean) return this.getRecentSearches();
    const list = this.getRecentSearches().filter(
      (q) => q.toLowerCase() !== clean.toLowerCase()
    );
    const updated = [clean, ...list].slice(0, 8);
    localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
    return updated;
  },

  clearRecentSearches(): void {
    localStorage.removeItem(KEYS.RECENT_SEARCHES);
  },

  getPreferredQuality(): string {
    return localStorage.getItem(KEYS.PREFERRED_QUALITY) || 'Auto';
  },

  setPreferredQuality(quality: string): void {
    localStorage.setItem(KEYS.PREFERRED_QUALITY, quality);
  },

  getIptvRegion(): string {
    return localStorage.getItem('kinostream_iptv_region') || 'master';
  },

  setIptvRegion(regionCode: string): void {
    localStorage.setItem('kinostream_iptv_region', regionCode);
  },

  getDejavuApiUrl(): string {
    const stored = localStorage.getItem('kinostream_dejavu_api_url');
    if (stored !== null) return stored.trim().replace(/\/+$/, '');
    return (window.__KINO_API_CONFIG__?.dejavuApi?.baseUrl || '')
      .trim()
      .replace(/\/+$/, '');
  },

  setDejavuApiUrl(url: string): void {
    localStorage.setItem(
      'kinostream_dejavu_api_url',
      url.trim().replace(/\/+$/, '')
    );
  },

  getThemeColor(): ThemeColor {
    const val = localStorage.getItem('kinostream_theme_color');
    if (val === 'purple' || val === 'blue' || val === 'red') return val;
    return 'red';
  },

  setThemeColor(color: ThemeColor): void {
    localStorage.setItem('kinostream_theme_color', color);
  },

  getProviderToggles(): ProviderToggles {
    const stored = safeParse<Record<string, unknown> | null>(
      localStorage.getItem(KEYS.PROVIDER_TOGGLES),
      null
    );
    const merged: ProviderToggles = { ...DEFAULT_PROVIDER_TOGGLES };
    if (stored && typeof stored === 'object') {
      for (const [key, value] of Object.entries(stored)) {
        if (typeof value === 'boolean') {
          merged[key] = value;
        }
      }
    }
    return merged;
  },

  setProviderToggles(toggles: ProviderToggles): void {
    localStorage.setItem(KEYS.PROVIDER_TOGGLES, JSON.stringify(toggles));
  },

  isProviderToggleEnabled(key: string): boolean {
    const toggles = this.getProviderToggles();
    return toggles[key] !== false;
  },

  getStremioAddons(): StremioAddonConfig[] {
    const stored = safeParse<StremioAddonConfig[] | null>(
      localStorage.getItem(KEYS.STREMIO_ADDONS),
      null
    );
    const defaultFlagKey = 'kinostream_torrentio_default_v1';
    const workingPackFlagKey = 'kinostream_stremio_working_pack_v2';
    const normUrl = (u: string) =>
      (u || '').trim().replace(/^stremio:\/\//i, 'https://').replace(/\/+$/, '').toLowerCase();

    if (stored && Array.isArray(stored)) {
      let changed = false;
      const dirById = new Map(STREMIO_ADDONS_NET_DIRECTORY.map((d) => [d.id, d]));

      // Remove non-Stremio CloudStream repo.json entries from Stremio list
      let nextList = stored
        .filter((addon) => {
          const m = (addon.manifestUrl || '').toLowerCase();
          if (m.endsWith('/repo.json') || m.endsWith('/cs.json')) {
            changed = true;
            return false;
          }
          return true;
        })
        .map((addon) => {
          const lowerManifest = (addon.manifestUrl || '').toLowerCase();
          if (lowerManifest.includes('notorrent2.workers.dev')) {
            changed = true;
            return {
              ...addon,
              id: 'stremio-nuvio-streams',
              name: 'Nuvio Streams (Direct HTTP)',
              manifestUrl: 'https://nuviostreams.hayd.uk/manifest.json',
              baseUrl: 'https://nuviostreams.hayd.uk',
            };
          }
          if (lowerManifest.includes('webstreamr.hayd.uk')) {
            changed = true;
            return {
              ...addon,
              id: 'stremio-webstreamr-mbg',
              name: 'WebStreamrMBG (Direct HTTP)',
              manifestUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json',
              baseUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club',
            };
          }
          const dirMatch = dirById.get(addon.id);
          if (dirMatch && dirMatch.manifestUrl && addon.manifestUrl !== dirMatch.manifestUrl) {
            changed = true;
            const cleanManifest = dirMatch.manifestUrl;
            return {
              ...addon,
              manifestUrl: cleanManifest,
              baseUrl: cleanManifest.replace(/\/manifest\.json(\?.*)?$/i, ''),
            };
          }
          return addon;
        });

      if (localStorage.getItem(defaultFlagKey) !== '1') {
        const hasTorrentio = nextList.some(
          (a) => a.id === DEFAULT_TORRENTIO_ADDON.id || a.baseUrl.includes('torrentio.strem.fun')
        );
        localStorage.setItem(defaultFlagKey, '1');
        if (!hasTorrentio) {
          nextList = [DEFAULT_TORRENTIO_ADDON, ...nextList];
          changed = true;
        }
      }

      if (localStorage.getItem(workingPackFlagKey) !== '1') {
        localStorage.setItem(workingPackFlagKey, '1');
        const existingNormUrls = new Set(nextList.map((a) => normUrl(a.manifestUrl)));
        const existingIds = new Set(nextList.map((a) => a.id));
        const toPrepend: StremioAddonConfig[] = [];
        for (const defAddon of DEFAULT_VERIFIED_STREAM_ADDONS) {
          const n = normUrl(defAddon.manifestUrl);
          if (!existingIds.has(defAddon.id) && !existingNormUrls.has(n)) {
            toPrepend.push({ ...defAddon, addedAt: Date.now() });
            existingIds.add(defAddon.id);
            existingNormUrls.add(n);
            changed = true;
          }
        }
        if (toPrepend.length > 0) {
          nextList = [...toPrepend, ...nextList];
        }
      }

      if (changed) {
        this.saveStremioAddons(nextList);
      }
      return nextList;
    }
    localStorage.setItem(defaultFlagKey, '1');
    localStorage.setItem(workingPackFlagKey, '1');
    return window.__KINO_API_CONFIG__?.defaultStremioAddons || DEFAULT_STREMIO_ADDONS;
  },

  saveStremioAddons(addons: StremioAddonConfig[]): void {
    localStorage.setItem(KEYS.STREMIO_ADDONS, JSON.stringify(addons));
  },

  addStremioAddon(addon: StremioAddonConfig): StremioAddonConfig[] {
    const norm = (u: string) =>
      (u || '')
        .trim()
        .replace(/^stremio:\/\//i, 'https://')
        .replace(/\/+$/, '')
        .toLowerCase();
    const targetNorm = norm(addon.manifestUrl);
    const list = this.getStremioAddons().filter(
      (a) => a.id !== addon.id && norm(a.manifestUrl) !== targetNorm
    );
    const updated = [{ ...addon, addedAt: addon.addedAt || Date.now() }, ...list];
    this.saveStremioAddons(updated);
    return updated;
  },

  removeStremioAddon(id: string): StremioAddonConfig[] {
    const updated = this.getStremioAddons().filter((a) => a.id !== id);
    this.saveStremioAddons(updated);
    return updated;
  },

  toggleStremioAddon(id: string, enabled: boolean): StremioAddonConfig[] {
    const updated = this.getStremioAddons().map((a) =>
      a.id === id ? { ...a, enabled } : a
    );
    this.saveStremioAddons(updated);
    return updated;
  },

  getP2PTorrentEnabled(): boolean {
    const val = localStorage.getItem('kinostream_p2p_torrent_enabled');
    if (val === 'false') return false;
    return true;
  },

  setP2PTorrentEnabled(enabled: boolean): void {
    localStorage.setItem('kinostream_p2p_torrent_enabled', String(enabled));
  },

  getP2PPrebufferSizeMb(): number {
    const val = parseInt(localStorage.getItem('kinostream_p2p_prebuffer_size_mb') || '10', 10);
    if (Number.isFinite(val) && val >= 5 && val <= 30) return val;
    return 10;
  },

  setP2PPrebufferSizeMb(mb: number): void {
    const clamped = Math.max(5, Math.min(30, Math.round(mb)));
    localStorage.setItem('kinostream_p2p_prebuffer_size_mb', String(clamped));
  },
};

