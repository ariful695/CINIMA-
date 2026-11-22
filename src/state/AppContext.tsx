import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  NUVIO_PLUGIN_REPOS,
  NuvioDirectoryRepo,
  STREMIO_ADDONS_NET_DIRECTORY,
  StremioNetDirectoryAddon,
} from '../data/nuvioAndStremioCatalog';
import { cloudStreamRepoService } from '../services/cloudStreamRepoService';
import { iptvOrgService } from '../services/iptvOrgService';
import { m3uParserService } from '../services/m3uParserService';
import { InstalledNuvioRepo, nuvioService } from '../services/nuvioService';
import { storageService } from '../services/storageService';
import { stremioAddonService } from '../services/stremioAddonService';
import { liveTvAddonService } from '../services/liveTvAddonService';
import { offlineDownloadService } from '../services/offlineDownloadService';
import {
  CloudStreamRepository,
  JsonStreamEndpoint,
  LiveChannel,
  M3UPlaylistSource,
  MediaItem,
  MediaType,
  NavTab,
  OfflineDownloadItem,
  PlayerSession,
  ServerPickerTarget,
  StremioAddonConfig,
  ThemeColor,
  WatchProgressItem,
} from '../types/media';

interface SelectedMediaTarget {
  id: number;
  mediaType: MediaType;
  seedItem?: MediaItem;
}

export type LibrarySubTab = 'mylist' | 'settings' | 'extensions' | 'downloads';

export interface UnifiedInstallResult {
  kind: 'nuvio' | 'stremio' | 'cloudstream';
  message: string;
}

export interface ProviderHealthEntry {
  status: 'online' | 'degraded' | 'offline' | 'checking';
  latency?: number;
  detail?: string;
}

export interface ProviderHealthSummary {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  checkedAt: number;
}

interface CardActionsContextValue {
  openMediaDetails: (id: number, mediaType: MediaType, seedItem?: MediaItem) => void;
  openServerPicker: (target: ServerPickerTarget) => void;
  toggleWatchlist: (item: MediaItem) => void;
  watchlistKeys: Set<string>;
  themeColor: ThemeColor;
}

const CardActionsContext = createContext<CardActionsContextValue | null>(null);

interface AppContextValue {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  librarySubTab: LibrarySubTab;
  setLibrarySubTab: (tab: LibrarySubTab) => void;
  openLibrarySection: (subTab: LibrarySubTab) => void;
  selectedMedia: SelectedMediaTarget | null;
  openMediaDetails: (id: number, mediaType: MediaType, seedItem?: MediaItem) => void;
  closeMediaDetails: () => void;
  playerSession: PlayerSession | null;
  startPlayback: (session: PlayerSession) => void;
  closePlayback: () => void;
  serverPickerTarget: ServerPickerTarget | null;
  openServerPicker: (target: ServerPickerTarget) => void;
  closeServerPicker: () => void;

  tmdbApiKey: string;
  updateTmdbApiKey: (key: string) => void;
  dejavuApiUrl: string;
  updateDejavuApiUrl: (url: string) => void;
  catalogRefreshTick: number;
  triggerCatalogRefresh: () => void;

  watchlist: MediaItem[];
  isInWatchlist: (id: number, mediaType: MediaType) => boolean;
  toggleWatchlist: (item: MediaItem) => void;

  continueWatching: WatchProgressItem[];
  saveWatchProgress: (item: WatchProgressItem) => void;
  removeWatchProgress: (key: string) => void;
  clearWatchHistory: () => void;

  jsonEndpoints: JsonStreamEndpoint[];
  saveJsonEndpoints: (endpoints: JsonStreamEndpoint[]) => void;

  // Shared Stremio Addons State
  stremioAddons: StremioAddonConfig[];
  saveStremioAddons: (addons: StremioAddonConfig[]) => void;
  addStremioAddon: (addon: StremioAddonConfig) => void;
  removeStremioAddon: (id: string) => void;
  toggleStremioAddon: (id: string, enabled: boolean) => void;
  installStremioDirectoryItem: (item: StremioNetDirectoryAddon) => Promise<StremioAddonConfig>;
  installPopularStremioPack: () => Promise<number>;

  // Shared Nuvio Repos State
  nuvioRepos: InstalledNuvioRepo[];
  installNuvioDirectoryRepo: (repo: NuvioDirectoryRepo, enabled?: boolean) => InstalledNuvioRepo[];
  installCustomNuvioRepo: (url: string) => Promise<InstalledNuvioRepo>;
  installAllNuvioRepos: () => InstalledNuvioRepo[];
  toggleNuvioRepo: (repoId: string, enabled: boolean) => void;
  removeNuvioRepo: (repoId: string) => void;

  // Shared CloudStream Repos State
  cloudStreamRepos: CloudStreamRepository[];
  addCloudStreamRepo: (urlOrShortcode: string) => Promise<CloudStreamRepository>;
  installAllCloudStreamRepos: () => Promise<CloudStreamRepository[]>;
  removeCloudStreamRepo: (repoId: string) => void;
  toggleCloudStreamProvider: (repoId: string, providerId: string) => void;
  downloadAllInCloudStreamRepo: (repoId: string) => void;
  removeAllInCloudStreamRepo: (repoId: string) => void;

  // Unified auto-detecting installer, live updater & online/offline checker
  installByInput: (rawInput: string) => Promise<UnifiedInstallResult>;
  isUpdatingAddons: boolean;
  updateAllAddonsAndRepos: () => Promise<{
    nuvioCount: number;
    stremioCount: number;
    cloudStreamCount: number;
  }>;
  providerHealthMap: Record<string, ProviderHealthEntry>;
  isCheckingProviders: boolean;
  providerCheckError: string | null;
  providerHealthSummary: ProviderHealthSummary | null;
  checkAllProvidersHealth: (options?: { includeDirectory?: boolean; force?: boolean }) => Promise<ProviderHealthSummary | null>;

  m3uPlaylists: M3UPlaylistSource[];
  saveM3UPlaylists: (playlists: M3UPlaylistSource[]) => void;
  iptvRegion: string;
  setIptvRegion: (regionCode: string) => void;
  liveChannels: LiveChannel[];
  liveErrors: Record<string, string>;
  liveLoading: boolean;
  refreshLiveChannels: (forceRefresh?: boolean) => Promise<void>;
  favoriteChannelIds: string[];
  toggleFavoriteChannel: (channelId: string) => void;
  channelHealthMap: Record<string, boolean>;
  markChannelHealth: (channelId: string, playable: boolean) => void;
  mergeChannelHealth: (batch: Record<string, boolean>) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  offlineDownloads: OfflineDownloadItem[];
}

const AppContext = createContext<AppContextValue | null>(null);

const ESSENTIAL_STREMIO_SLUGS = [
  'torrentio',
  'meteor-midnightignite',
  'torrentsdb',
  'hdhub',
  'torrentclaw-addon',
  'peerflix',
  'pipe',
  'ilcorsaroviola',
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [librarySubTab, setLibrarySubTab] = useState<LibrarySubTab>('settings');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaTarget | null>(null);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [serverPickerTarget, setServerPickerTarget] = useState<ServerPickerTarget | null>(null);

  const openServerPicker = useCallback((target: ServerPickerTarget) => {
    setServerPickerTarget(target);
  }, []);

  const closeServerPicker = useCallback(() => {
    setServerPickerTarget(null);
  }, []);

  const [tmdbApiKey, setTmdbApiKey] = useState<string>(() => storageService.getTmdbApiKey());
  const [dejavuApiUrl, setDejavuApiUrl] = useState<string>(() =>
    storageService.getDejavuApiUrl()
  );
  const [catalogRefreshTick, setCatalogRefreshTick] = useState(0);

  const [watchlist, setWatchlist] = useState<MediaItem[]>(() => storageService.getWatchlist());
  const [continueWatching, setContinueWatching] = useState<WatchProgressItem[]>(() =>
    storageService.getContinueWatching()
  );
  const [jsonEndpoints, setJsonEndpoints] = useState<JsonStreamEndpoint[]>(() =>
    storageService.getJsonEndpoints()
  );
  const [stremioAddons, setStremioAddons] = useState<StremioAddonConfig[]>(() =>
    storageService.getStremioAddons()
  );
  const [nuvioRepos, setNuvioRepos] = useState<InstalledNuvioRepo[]>(() =>
    nuvioService.getInstalledRepos()
  );
  const [cloudStreamRepos, setCloudStreamRepos] = useState<CloudStreamRepository[]>(() =>
    cloudStreamRepoService.getRepositories()
  );
  const [isUpdatingAddons, setIsUpdatingAddons] = useState(false);
  const [providerHealthMap, setProviderHealthMap] = useState<Record<string, ProviderHealthEntry>>({});
  const [isCheckingProviders, setIsCheckingProviders] = useState(false);
  const [providerCheckError, setProviderCheckError] = useState<string | null>(null);
  const [providerHealthSummary, setProviderHealthSummary] = useState<ProviderHealthSummary | null>(null);

  // Stremio actions
  const saveStremioAddons = useCallback((addons: StremioAddonConfig[]) => {
    storageService.saveStremioAddons(addons);
    setStremioAddons(storageService.getStremioAddons());
    void nuvioService.clearServerCache();
  }, []);

  const addStremioAddon = useCallback((addon: StremioAddonConfig) => {
    const updated = storageService.addStremioAddon(addon);
    setStremioAddons(updated);
    void nuvioService.clearServerCache();
  }, []);

  const removeStremioAddon = useCallback((id: string) => {
    const updated = storageService.removeStremioAddon(id);
    setStremioAddons(updated);
    void nuvioService.clearServerCache();
  }, []);

  const toggleStremioAddon = useCallback((id: string, enabled: boolean) => {
    const updated = storageService.toggleStremioAddon(id, enabled);
    setStremioAddons(updated);
    void nuvioService.clearServerCache();
  }, []);

  const installStremioDirectoryItem = useCallback(
    async (item: StremioNetDirectoryAddon): Promise<StremioAddonConfig> => {
      const { baseUrl } = stremioAddonService.normalizeUrl(item.manifestUrl);
      let addon: StremioAddonConfig = {
        id: item.id,
        name: item.name,
        manifestUrl: item.manifestUrl,
        baseUrl,
        enabled: true,
        description: item.description,
        logo: item.logo,
        version: '1.0.0',
        addedAt: Date.now(),
      };
      try {
        const fetched = await stremioAddonService.fetchManifest(item.manifestUrl, item.name);
        addon = {
          ...addon,
          id: fetched.id || addon.id,
          name: fetched.name || addon.name,
          description: fetched.description || addon.description,
          version: fetched.version || addon.version,
          logo: fetched.logo || addon.logo,
          addedAt: Date.now(),
        };
      } catch {
        // Keep directory metadata fallback
      }
      addStremioAddon(addon);
      return addon;
    },
    [addStremioAddon]
  );

  const installPopularStremioPack = useCallback(async (): Promise<number> => {
    let addedCount = 0;
    for (const slug of ESSENTIAL_STREMIO_SLUGS) {
      const found = STREMIO_ADDONS_NET_DIRECTORY.find((a) => a.slug === slug);
      if (found) {
        await installStremioDirectoryItem(found);
        addedCount += 1;
      }
    }
    return addedCount;
  }, [installStremioDirectoryItem]);

  // Nuvio actions
  const installNuvioDirectoryRepo = useCallback(
    (repo: NuvioDirectoryRepo, enabled = true): InstalledNuvioRepo[] => {
      const updated = nuvioService.installDirectoryRepo(repo, enabled);
      setNuvioRepos(updated);
      return updated;
    },
    []
  );

  const installCustomNuvioRepo = useCallback(async (url: string): Promise<InstalledNuvioRepo> => {
    const added = await nuvioService.installCustomRepoUrl(url);
    setNuvioRepos(nuvioService.getInstalledRepos());
    return added;
  }, []);

  const installAllNuvioRepos = useCallback((): InstalledNuvioRepo[] => {
    const all = nuvioService.installAllDirectoryRepos();
    setNuvioRepos(all);
    return all;
  }, []);

  const toggleNuvioRepo = useCallback((repoId: string, enabled: boolean) => {
    const updated = nuvioService.toggleRepoEnabled(repoId, enabled);
    setNuvioRepos(updated);
  }, []);

  const removeNuvioRepo = useCallback((repoId: string) => {
    const updated = nuvioService.removeRepo(repoId);
    setNuvioRepos(updated);
  }, []);

  // CloudStream actions
  const addCloudStreamRepo = useCallback(async (urlOrShortcode: string): Promise<CloudStreamRepository> => {
    const added = await cloudStreamRepoService.addRepository(urlOrShortcode);
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
    return added;
  }, []);

  const installAllCloudStreamRepos = useCallback(async (): Promise<CloudStreamRepository[]> => {
    const all = await cloudStreamRepoService.installAllDirectoryRepos();
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
    return all;
  }, []);

  const removeCloudStreamRepo = useCallback((repoId: string) => {
    cloudStreamRepoService.removeRepository(repoId);
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
  }, []);

  const toggleCloudStreamProvider = useCallback((repoId: string, providerId: string) => {
    cloudStreamRepoService.toggleProviderDownload(repoId, providerId);
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
  }, []);

  const downloadAllInCloudStreamRepo = useCallback((repoId: string) => {
    cloudStreamRepoService.downloadAllInRepo(repoId);
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
  }, []);

  const removeAllInCloudStreamRepo = useCallback((repoId: string) => {
    cloudStreamRepoService.removeAllInRepo(repoId);
    setCloudStreamRepos(cloudStreamRepoService.getRepositories());
  }, []);

  // Smart auto-detecting installer for Nuvio, Stremio, and CloudStream URLs / shortcodes
  const installByInput = useCallback(
    async (rawInput: string): Promise<UnifiedInstallResult> => {
      const raw = rawInput.trim();
      const lower = raw.toLowerCase();

      // 1. Directory website / bulk keywords
      if (lower.includes('nuvioplugin.com') || lower === 'nuvio-all' || lower === 'nuvio') {
        const allNuvio = installAllNuvioRepos();
        return {
          kind: 'nuvio',
          message: `Installed all ${allNuvio.length} Nuvio repositories from nuvioplugin.com!`,
        };
      }

      if (
        lower === 'https://stremio-addons.net' ||
        lower === 'https://stremio-addons.net/' ||
        lower === 'http://stremio-addons.net/' ||
        lower === 'stremio-addons.net'
      ) {
        const count = await installPopularStremioPack();
        return {
          kind: 'stremio',
          message: `Installed ${count} live stream add-ons from stremio-addons.net!`,
        };
      }

      if (lower === 'all' || lower === '500' || lower.includes('cloudstreamrepo.com')) {
        const allCs = await installAllCloudStreamRepos();
        const total = allCs.reduce((sum, r) => sum + r.totalCount, 0);
        return {
          kind: 'cloudstream',
          message: `Installed all ${allCs.length} CloudStream repositories (${total} plugins)!`,
        };
      }

      // 2. Exact directory matches
      const matchedNuvio = NUVIO_PLUGIN_REPOS.find(
        (r) =>
          r.manifestUrl.toLowerCase() === lower ||
          r.name.toLowerCase() === lower ||
          r.author.toLowerCase() === lower
      );
      if (matchedNuvio) {
        const installedRepo = await installCustomNuvioRepo(matchedNuvio.manifestUrl);
        return {
          kind: 'nuvio',
          message: `Installed Nuvio repository: ${installedRepo.name} (${installedRepo.plugins.length} plugins)`,
        };
      }

      const matchedStremioDir = STREMIO_ADDONS_NET_DIRECTORY.find(
        (a) =>
          lower.includes(`/addons/${a.slug.toLowerCase()}`) ||
          a.manifestUrl.toLowerCase() === lower ||
          a.slug.toLowerCase() === lower
      );
      if (matchedStremioDir || lower.startsWith('stremio://')) {
        const addon = await stremioAddonService.fetchManifest(
          matchedStremioDir ? matchedStremioDir.manifestUrl : raw,
          matchedStremioDir?.name
        );
        addStremioAddon(addon);
        return {
          kind: 'stremio',
          message: `Installed Stremio Add-on: ${addon.name}`,
        };
      }

      const matchedCloudStreamDir = cloudStreamRepoService
        .getAllDirectoryRepos()
        .find(
          (r) =>
            r.id.toLowerCase() === lower ||
            r.directInstall.toLowerCase() === lower ||
            r.shortcodes?.some((sc) => sc.toLowerCase() === lower)
        );
      if (matchedCloudStreamDir) {
        const addedRepo = await addCloudStreamRepo(raw);
        return {
          kind: 'cloudstream',
          message: `Installed CloudStream repo: ${addedRepo.name} (${addedRepo.totalCount} plugins)`,
        };
      }

      // 3. True JSON payload inspection for arbitrary URLs
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        const candidateUrl =
          lower.endsWith('.json') || lower.includes('manifest.json')
            ? raw
            : `${raw.replace(/\/+$/, '')}/manifest.json`;

        const inspectJson = async (target: string): Promise<Record<string, unknown> | null> => {
          try {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 7000);
            const res = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`, {
              signal: controller.signal,
            });
            window.clearTimeout(timer);
            if (!res.ok) return null;
            const txt = await res.text();
            if (!txt.trim().startsWith('{')) return null;
            return JSON.parse(txt) as Record<string, unknown>;
          } catch {
            return null;
          }
        };

        const payload = (await inspectJson(raw)) || (candidateUrl !== raw ? await inspectJson(candidateUrl) : null);
        if (payload) {
          // Nuvio manifest has `scrapers` array (or `providers` with filename/script URL)
          if (Array.isArray(payload.scrapers)) {
            const installedRepo = await installCustomNuvioRepo(raw);
            return {
              kind: 'nuvio',
              message: `Installed Nuvio repository: ${installedRepo.name} (${installedRepo.plugins.length} scrapers)`,
            };
          }
          // Stremio manifest has `id` + (`resources` or `types` or `catalogs`)
          if (
            typeof payload.id === 'string' &&
            (Array.isArray(payload.resources) ||
              Array.isArray(payload.types) ||
              Array.isArray(payload.catalogs))
          ) {
            const addon = await stremioAddonService.fetchManifest(raw);
            addStremioAddon(addon);
            return {
              kind: 'stremio',
              message: `Installed Stremio Add-on: ${addon.name}`,
            };
          }
          // CloudStream repo has `pluginLists` or `extensions`
          if (Array.isArray(payload.pluginLists) || Array.isArray(payload.extensions)) {
            const addedRepo = await addCloudStreamRepo(raw);
            return {
              kind: 'cloudstream',
              message: `Installed CloudStream repo: ${addedRepo.name} (${addedRepo.totalCount} plugins)`,
            };
          }
        }

        // URL pattern fallback if JSON inspection didn't match an explicit schema
        if (/manifest\.json(\?.*)?$/i.test(lower)) {
          const addon = await stremioAddonService.fetchManifest(raw);
          addStremioAddon(addon);
          return {
            kind: 'stremio',
            message: `Installed Stremio Add-on: ${addon.name}`,
          };
        }
      }

      // 4. Default CloudStream repository / shortcode fallback
      const added = await addCloudStreamRepo(raw);
      return {
        kind: 'cloudstream',
        message: `Installed: ${added.name} (${added.providers.length} plugins)`,
      };
    },
    [
      installAllNuvioRepos,
      installPopularStremioPack,
      installAllCloudStreamRepos,
      installCustomNuvioRepo,
      addStremioAddon,
      addCloudStreamRepo,
    ]
  );

  // Unified live updater for Nuvio repos, Stremio add-ons, and CloudStream repos
  const updateAllAddonsAndRepos = useCallback(async () => {
    setIsUpdatingAddons(true);
    try {
      const [refreshedNuvio, refreshedStremio, refreshedCloudStream] = await Promise.all([
        nuvioService.refreshInstalledRepos(),
        stremioAddonService.refreshAllAddons(storageService.getStremioAddons()),
        cloudStreamRepoService.refreshAllRepositories(),
      ]);
      storageService.saveStremioAddons(refreshedStremio);
      setNuvioRepos(refreshedNuvio);
      setStremioAddons(refreshedStremio);
      setCloudStreamRepos(refreshedCloudStream);
      return {
        nuvioCount: refreshedNuvio.length,
        stremioCount: refreshedStremio.length,
        cloudStreamCount: refreshedCloudStream.length,
      };
    } finally {
      setIsUpdatingAddons(false);
    }
  }, []);

  const [m3uPlaylists, setM3UPlaylists] = useState<M3UPlaylistSource[]>(() =>
    storageService.getM3UPlaylists()
  );
  const [iptvRegion, setIptvRegionState] = useState<string>(() =>
    storageService.getIptvRegion()
  );
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('kinostream_favorite_channels');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [liveChannels, setLiveChannels] = useState<LiveChannel[]>([]);
  const [liveErrors, setLiveErrors] = useState<Record<string, string>>({});
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveLoadedOnce, setLiveLoadedOnce] = useState(false);
  const [channelHealthMap, setChannelHealthMap] = useState<Record<string, boolean>>({});
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => storageService.getThemeColor());
  const [offlineDownloads, setOfflineDownloads] = useState<OfflineDownloadItem[]>([]);

  useEffect(() => {
    void offlineDownloadService.reconcileInterruptedDownloads().then(setOfflineDownloads);
    return offlineDownloadService.subscribe(setOfflineDownloads);
  }, []);

  const checkAllProvidersHealth = useCallback(
    async (options?: { includeDirectory?: boolean; force?: boolean }): Promise<ProviderHealthSummary | null> => {
      setIsCheckingProviders(true);
      setProviderCheckError(null);

      const normalizeUrl = (raw: string) =>
        (raw || '').trim().replace(/^stremio:\/\//i, 'https://').replace(/\/+$/, '').toLowerCase();

      const targets: Array<{
        key: string;
        kind: 'stremio' | 'nuvio' | 'cloudstream' | 'core';
        url: string;
        name: string;
      }> = [];

      // 1. Core built-in providers (Settings manager)
      const coreProviders = [
        { key: 'core:torrentio', url: 'https://torrentio.strem.fun/manifest.json', name: 'Torrentio P2P Scraper' },
        { key: 'core:nuvio', url: 'https://raw.githubusercontent.com/NuvioPlugin/All-in-One-Nuvio/refs/heads/main/manifest.json', name: 'Nuvio Direct Scraper' },
        { key: 'core:meteor', url: 'https://meteorfortheweebs.midnightignite.me/stremio/manifest.json', name: 'Meteor P2P Add-on' },
        { key: 'core:torrentsdb', url: 'https://torrentsdb.com/manifest.json', name: 'TorrentsDB Indexer' },
        { key: 'core:hdhub', url: 'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json', name: 'HdHub Multi-Audio' },
        { key: 'core:pipe', url: 'https://pipe.boringways.workers.dev/manifest.json', name: 'Pipe Streams Add-on' },
        { key: 'core:peerflix', url: 'https://peerflix.mov/manifest.json', name: 'Peerflix Add-on' },
        { key: 'core:cloudstream', url: 'https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/repo.json', name: 'CloudStream Plugins' },
        { key: 'core:cinemeta', url: 'https://v3-cinemeta.strem.io/manifest.json', name: 'Cinemeta Catalog' },
        { key: 'core:opensubtitles', url: 'https://opensubtitles-v3.strem.io/manifest.json', name: 'OpenSubtitles v3' },
      ];
      for (const cp of coreProviders) {
        targets.push({ key: cp.key, kind: 'core', url: cp.url, name: cp.name });
      }

      // 2. Nuvio repositories (installed + directory)
      const seenNuvio = new Set<string>();
      for (const repo of nuvioRepos) {
        const k = `nuvio:${normalizeUrl(repo.manifestUrl)}`;
        if (!seenNuvio.has(k)) {
          seenNuvio.add(k);
          targets.push({ key: k, kind: 'nuvio', url: repo.manifestUrl, name: repo.name });
        }
      }
      for (const dirRepo of NUVIO_PLUGIN_REPOS) {
        const k = `nuvio:${normalizeUrl(dirRepo.manifestUrl)}`;
        if (!seenNuvio.has(k)) {
          seenNuvio.add(k);
          targets.push({ key: k, kind: 'nuvio', url: dirRepo.manifestUrl, name: dirRepo.name });
        }
      }

      // 3. Stremio add-ons (all installed + optional directory add-ons)
      const seenStremio = new Set<string>();
      for (const addon of stremioAddons) {
        const k = `stremio:${normalizeUrl(addon.manifestUrl)}`;
        if (!seenStremio.has(k)) {
          seenStremio.add(k);
          targets.push({ key: k, kind: 'stremio', url: addon.manifestUrl, name: addon.name });
        }
      }
      if (options?.includeDirectory) {
        for (const dirAddon of STREMIO_ADDONS_NET_DIRECTORY) {
          const k = `stremio:${normalizeUrl(dirAddon.manifestUrl)}`;
          if (!seenStremio.has(k)) {
            seenStremio.add(k);
            targets.push({ key: k, kind: 'stremio', url: dirAddon.manifestUrl, name: dirAddon.name });
          }
        }
      }

      // 4. CloudStream repositories (with remote repoUrl)
      for (const csRepo of cloudStreamRepos) {
        if (csRepo.url && (csRepo.url.startsWith('http://') || csRepo.url.startsWith('https://'))) {
          targets.push({
            key: `cloudstream:${csRepo.id}`,
            kind: 'cloudstream',
            url: csRepo.url,
            name: csRepo.name,
          });
        }
      }

      // Mark all targets checking in UI immediately
      setProviderHealthMap((prev) => {
        const next = { ...prev };
        for (const t of targets) {
          next[t.key] = { status: 'checking' };
        }
        return next;
      });

      try {
        const res = await nuvioService.checkAllProvidersHealth(targets, (chunkResults) => {
          setProviderHealthMap((prev) => ({
            ...prev,
            ...chunkResults,
          }));
        });
        setProviderHealthMap((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(res.results)) {
            next[k] = v;
          }
          return next;
        });
        const summary: ProviderHealthSummary = {
          total: res.summary.total,
          online: res.summary.online,
          degraded: res.summary.degraded,
          offline: res.summary.offline,
          checkedAt: res.checkedAt,
        };
        setProviderHealthSummary(summary);
        return summary;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to complete provider health check.';
        setProviderCheckError(msg);
        setProviderHealthMap((prev) => {
          const next = { ...prev };
          for (const t of targets) {
            if (next[t.key]?.status === 'checking') {
              next[t.key] = { status: 'offline', detail: 'Check failed' };
            }
          }
          return next;
        });
        return null;
      } finally {
        setIsCheckingProviders(false);
      }
    },
    [nuvioRepos, stremioAddons, cloudStreamRepos]
  );

  const setThemeColor = useCallback((color: ThemeColor) => {
    storageService.setThemeColor(color);
    setThemeColorState(color);
  }, []);

  const markChannelHealth = useCallback((channelId: string, playable: boolean) => {
    setChannelHealthMap((prev) =>
      prev[channelId] === playable ? prev : { ...prev, [channelId]: playable }
    );
  }, []);

  const mergeChannelHealth = useCallback((batch: Record<string, boolean>) => {
    setChannelHealthMap((prev) => ({ ...prev, ...batch }));
  }, []);

  const loadLiveChannels = useCallback(
    async (
      playlistsToLoad: M3UPlaylistSource[],
      regionCode: string,
      forceRefresh = false
    ) => {
      setLiveLoading(true);
      const [localRes, iptvRes, addonRes] = await Promise.all([
        m3uParserService.loadAllEnabledPlaylists(playlistsToLoad),
        iptvOrgService.fetchRegionChannels(regionCode, forceRefresh),
        liveTvAddonService
          .fetchAllAddonChannels(stremioAddons)
          .catch((err) => ({
            channels: [] as LiveChannel[],
            errors: { 'live-tv-addons': err instanceof Error ? err.message : 'Addon fetch error' } as Record<string, string>,
          })),
      ]);

      const mergedErrors = { ...localRes.errors, ...addonRes.errors };
      if (iptvRes.error) {
        mergedErrors['iptv-org'] = iptvRes.error;
      }

      const seenCompositeKeys = new Set<string>();
      const combined: LiveChannel[] = [];
      for (const ch of [...localRes.channels, ...iptvRes.channels, ...addonRes.channels]) {
        const compositeKey = `${(ch.name || '').toLowerCase().trim()}::${(ch.streamUrl || '').trim()}`;
        if (!seenCompositeKeys.has(compositeKey)) {
          seenCompositeKeys.add(compositeKey);
          combined.push(ch);
        }
      }

      setLiveChannels(combined);
      setLiveErrors(mergedErrors);
      setLiveLoadedOnce(true);
      setLiveLoading(false);
    },
    [stremioAddons]
  );

  useEffect(() => {
    // Load immediately when user visits Live TV, or defer slightly during idle so Home screen renders with zero stutter
    if (activeTab === 'live' || liveLoadedOnce) {
      void loadLiveChannels(m3uPlaylists, iptvRegion, false);
      return;
    }
    const timer = window.setTimeout(() => {
      void loadLiveChannels(m3uPlaylists, iptvRegion, false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [activeTab, liveLoadedOnce, m3uPlaylists, iptvRegion, loadLiveChannels]);

  const setIptvRegion = useCallback((regionCode: string) => {
    storageService.setIptvRegion(regionCode);
    setIptvRegionState(regionCode);
  }, []);

  const refreshLiveChannels = useCallback(
    async (forceRefresh = true) => {
      if (forceRefresh) iptvOrgService.clearCache();
      await loadLiveChannels(storageService.getM3UPlaylists(), iptvRegion, forceRefresh);
    },
    [iptvRegion, loadLiveChannels]
  );

  const openLibrarySection = useCallback((subTab: LibrarySubTab) => {
    setLibrarySubTab(subTab);
    setActiveTab('library');
  }, []);

  const openMediaDetails = useCallback(
    (id: number, mediaType: MediaType, seedItem?: MediaItem) => {
      setSelectedMedia({ id, mediaType, seedItem });
    },
    []
  );

  const closeMediaDetails = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const startPlayback = useCallback((session: PlayerSession) => {
    setPlayerSession(session);
  }, []);

  const closePlayback = useCallback(() => {
    setPlayerSession(null);
  }, []);

  const updateTmdbApiKey = useCallback((key: string) => {
    storageService.setTmdbApiKey(key);
    setTmdbApiKey(key.trim());
    setCatalogRefreshTick((t) => t + 1);
  }, []);

  const updateDejavuApiUrl = useCallback((url: string) => {
    storageService.setDejavuApiUrl(url);
    setDejavuApiUrl(url.trim().replace(/\/+$/, ''));
    setCatalogRefreshTick((t) => t + 1);
  }, []);

  const triggerCatalogRefresh = useCallback(() => {
    setCatalogRefreshTick((t) => t + 1);
  }, []);

  const isInWatchlist = useCallback(
    (id: number, mediaType: MediaType) =>
      watchlist.some((item) => item.id === id && item.mediaType === mediaType),
    [watchlist]
  );

  const toggleWatchlist = useCallback((item: MediaItem) => {
    setWatchlist((prev) => {
      const exists = prev.some(
        (existing) => existing.id === item.id && existing.mediaType === item.mediaType
      );
      const next = exists
        ? prev.filter(
            (existing) => !(existing.id === item.id && existing.mediaType === item.mediaType)
          )
        : [item, ...prev];
      storageService.saveWatchlist(next);
      return next;
    });
  }, []);

  const toggleFavoriteChannel = useCallback((channelId: string) => {
    setFavoriteChannelIds((prev) => {
      const next = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      localStorage.setItem('kinostream_favorite_channels', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveWatchProgress = useCallback((item: WatchProgressItem) => {
    const next = storageService.upsertContinueWatching(item);
    setContinueWatching(next);
  }, []);

  const removeWatchProgress = useCallback((key: string) => {
    const next = storageService.removeContinueWatching(key);
    setContinueWatching(next);
  }, []);

  const clearWatchHistory = useCallback(() => {
    storageService.clearContinueWatching();
    setContinueWatching([]);
  }, []);

  const saveJsonEndpoints = useCallback((endpoints: JsonStreamEndpoint[]) => {
    storageService.saveJsonEndpoints(endpoints);
    setJsonEndpoints(endpoints);
  }, []);

  const saveM3UPlaylists = useCallback((playlists: M3UPlaylistSource[]) => {
    storageService.saveM3UPlaylists(playlists);
    setM3UPlaylists(playlists);
  }, []);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      librarySubTab,
      setLibrarySubTab,
      openLibrarySection,
      selectedMedia,
      openMediaDetails,
      closeMediaDetails,
      playerSession,
      startPlayback,
      closePlayback,
      serverPickerTarget,
      openServerPicker,
      closeServerPicker,
      tmdbApiKey,
      updateTmdbApiKey,
      dejavuApiUrl,
      updateDejavuApiUrl,
      catalogRefreshTick,
      triggerCatalogRefresh,
      watchlist,
      isInWatchlist,
      toggleWatchlist,
      continueWatching,
      saveWatchProgress,
      removeWatchProgress,
      clearWatchHistory,
      jsonEndpoints,
      saveJsonEndpoints,
      stremioAddons,
      saveStremioAddons,
      addStremioAddon,
      removeStremioAddon,
      toggleStremioAddon,
      installStremioDirectoryItem,
      installPopularStremioPack,
      nuvioRepos,
      installNuvioDirectoryRepo,
      installCustomNuvioRepo,
      installAllNuvioRepos,
      toggleNuvioRepo,
      removeNuvioRepo,
      cloudStreamRepos,
      addCloudStreamRepo,
      installAllCloudStreamRepos,
      removeCloudStreamRepo,
      toggleCloudStreamProvider,
      downloadAllInCloudStreamRepo,
      removeAllInCloudStreamRepo,
      installByInput,
      isUpdatingAddons,
      updateAllAddonsAndRepos,
      providerHealthMap,
      isCheckingProviders,
      providerCheckError,
      providerHealthSummary,
      checkAllProvidersHealth,
      m3uPlaylists,
      saveM3UPlaylists,
      iptvRegion,
      setIptvRegion,
      liveChannels,
      liveErrors,
      liveLoading,
      refreshLiveChannels,
      favoriteChannelIds,
      toggleFavoriteChannel,
      channelHealthMap,
      markChannelHealth,
      mergeChannelHealth,
      themeColor,
      setThemeColor,
      offlineDownloads,
    }),
    [
      activeTab,
      librarySubTab,
      openLibrarySection,
      selectedMedia,
      openMediaDetails,
      closeMediaDetails,
      playerSession,
      startPlayback,
      closePlayback,
      serverPickerTarget,
      openServerPicker,
      closeServerPicker,
      tmdbApiKey,
      updateTmdbApiKey,
      dejavuApiUrl,
      updateDejavuApiUrl,
      catalogRefreshTick,
      triggerCatalogRefresh,
      watchlist,
      isInWatchlist,
      toggleWatchlist,
      continueWatching,
      saveWatchProgress,
      removeWatchProgress,
      clearWatchHistory,
      jsonEndpoints,
      saveJsonEndpoints,
      stremioAddons,
      saveStremioAddons,
      addStremioAddon,
      removeStremioAddon,
      toggleStremioAddon,
      installStremioDirectoryItem,
      installPopularStremioPack,
      nuvioRepos,
      installNuvioDirectoryRepo,
      installCustomNuvioRepo,
      installAllNuvioRepos,
      toggleNuvioRepo,
      removeNuvioRepo,
      cloudStreamRepos,
      addCloudStreamRepo,
      installAllCloudStreamRepos,
      removeCloudStreamRepo,
      toggleCloudStreamProvider,
      downloadAllInCloudStreamRepo,
      removeAllInCloudStreamRepo,
      installByInput,
      isUpdatingAddons,
      updateAllAddonsAndRepos,
      providerHealthMap,
      isCheckingProviders,
      providerCheckError,
      providerHealthSummary,
      checkAllProvidersHealth,
      m3uPlaylists,
      saveM3UPlaylists,
      iptvRegion,
      setIptvRegion,
      liveChannels,
      liveErrors,
      liveLoading,
      refreshLiveChannels,
      favoriteChannelIds,
      toggleFavoriteChannel,
      channelHealthMap,
      markChannelHealth,
      mergeChannelHealth,
      themeColor,
      setThemeColor,
      offlineDownloads,
    ]
  );

  const watchlistKeys = useMemo(
    () => new Set(watchlist.map((w) => `${w.mediaType}:${w.id}`)),
    [watchlist]
  );

  const cardActionsValue = useMemo<CardActionsContextValue>(
    () => ({
      openMediaDetails,
      openServerPicker,
      toggleWatchlist,
      watchlistKeys,
      themeColor,
    }),
    [openMediaDetails, openServerPicker, toggleWatchlist, watchlistKeys, themeColor]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <CardActionsContext.Provider value={cardActionsValue}>
        {children}
      </CardActionsContext.Provider>
    </AppContext.Provider>
  );
};

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return ctx;
}

export function useCardActions(): CardActionsContextValue {
  const ctx = useContext(CardActionsContext);
  if (!ctx) {
    throw new Error('useCardActions must be used within AppProvider');
  }
  return ctx;
}
