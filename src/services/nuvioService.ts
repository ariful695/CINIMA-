import { NUVIO_PLUGIN_REPOS, NuvioDirectoryRepo } from '../data/nuvioAndStremioCatalog';
import { MediaType, StreamResolutionResult, StreamSource, SubtitleTrack } from '../types/media';
import { storageService } from './storageService';

export const DEFAULT_NUVIO_REPO_URL =
  'https://raw.githubusercontent.com/NuvioPlugin/All-in-One-Nuvio/refs/heads/main/manifest.json';

const STORAGE_KEYS = {
  REPO_URL: 'kinostream_nuvio_repo_url',
  INSTALLED_REPOS: 'kinostream_nuvio_installed_repos_v1',
  DISABLED_IDS: 'kinostream_nuvio_disabled_ids',
  LAST_HEALTH: 'kinostream_nuvio_last_health',
} as const;

export interface NuvioScraperInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  supportedTypes?: string[];
  filename: string;
  enabled?: boolean;
  formats?: string[];
  logo?: string;
  contentLanguage?: string[];
}

export interface NuvioManifestPayload {
  manifestUrl: string;
  baseUrl: string;
  name: string;
  version: string;
  scrapers: NuvioScraperInfo[];
}

export interface NuvioScraperRunResult {
  id: string;
  name: string;
  status: 'ok' | 'empty' | 'error';
  count: number;
}

export interface InstalledNuvioRepo {
  id: string;
  name: string;
  author: string;
  description: string;
  manifestUrl: string;
  enabled: boolean;
  tags: string[];
  languages: string[];
  plugins: NuvioDirectoryRepo['plugins'];
  addedAt: number;
}

function normalizeRepoUrlKey(raw: string): string {
  return (raw || '').trim().replace(/\/+$/, '').toLowerCase();
}

function extractAuthorFromUrl(url: string): string {
  const gh = url.match(/raw\.githubusercontent\.com\/([^/]+)/i) || url.match(/github\.com\/([^/]+)/i);
  if (gh?.[1]) return gh[1];
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Community';
  }
}

function toInstalledRepo(repo: NuvioDirectoryRepo, enabled = true): InstalledNuvioRepo {
  return {
    id: repo.id,
    name: repo.name,
    author: repo.author,
    description: repo.description,
    manifestUrl: repo.manifestUrl,
    enabled,
    tags: repo.tags,
    languages: repo.languages,
    plugins: repo.plugins,
    addedAt: Date.now(),
  };
}

function mapManifestToPlugins(scrapers: NuvioScraperInfo[]): NuvioDirectoryRepo['plugins'] {
  return scrapers.map((s, idx) => ({
    id: `${s.id || 'scraper'}-${idx}`,
    name: s.name || s.id || `Scraper ${idx + 1}`,
    description: s.description || `${s.name || s.id} scraper`,
    types: s.supportedTypes && s.supportedTypes.length > 0 ? s.supportedTypes : ['movie', 'tv'],
    languages: s.contentLanguage && s.contentLanguage.length > 0 ? s.contentLanguage : ['en'],
    icon: s.logo,
  }));
}

function getDefaultInstalledRepos(): InstalledNuvioRepo[] {
  const d3adly = NUVIO_PLUGIN_REPOS.find((r) => r.manifestUrl === DEFAULT_NUVIO_REPO_URL) || NUVIO_PLUGIN_REPOS[1];
  const yoru = NUVIO_PLUGIN_REPOS.find((r) => r.author.toLowerCase() === 'yoruix');
  const defaults: InstalledNuvioRepo[] = [];
  if (d3adly) defaults.push(toInstalledRepo(d3adly, true));
  if (yoru && yoru.manifestUrl !== d3adly?.manifestUrl) {
    defaults.push(toInstalledRepo(yoru, true));
  }
  return defaults;
}

export const nuvioService = {
  getRepositoryUrl(): string {
    const raw = localStorage.getItem(STORAGE_KEYS.REPO_URL) || DEFAULT_NUVIO_REPO_URL;
    if (
      raw.includes('phisher98/phisher-nuvio-providers') ||
      raw.includes('realbestia1/nuvio-providers-it') ||
      raw.includes('nvmindl/nuvio-providers') ||
      raw.includes('D3adlyRocket/All-in-One-Nuvio')
    ) {
      localStorage.setItem(STORAGE_KEYS.REPO_URL, DEFAULT_NUVIO_REPO_URL);
      return DEFAULT_NUVIO_REPO_URL;
    }
    return raw;
  },

  setRepositoryUrl(url: string): void {
    const clean = url.trim() || DEFAULT_NUVIO_REPO_URL;
    localStorage.setItem(STORAGE_KEYS.REPO_URL, clean);
  },

  async clearServerCache(): Promise<void> {
    try {
      await fetch('/api/nuvio/cache/clear', { method: 'POST' });
    } catch {
      // Ignore offline/unavailable cache clear
    }
  },

  getInstalledRepos(): InstalledNuvioRepo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INSTALLED_REPOS);
      if (raw) {
        const parsed = JSON.parse(raw) as InstalledNuvioRepo[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          let changed = false;
          const byId = new Map(NUVIO_PLUGIN_REPOS.map((d) => [d.id, d]));
          const migrated = parsed.map((r) => {
            const dirMatch = byId.get(r.id);
            if (dirMatch && dirMatch.manifestUrl && r.manifestUrl !== dirMatch.manifestUrl) {
              changed = true;
              return { ...r, manifestUrl: dirMatch.manifestUrl };
            }
            if (r.manifestUrl.includes('phisher98/phisher-nuvio-providers')) {
              changed = true;
              return {
                ...r,
                manifestUrl:
                  'https://raw.githubusercontent.com/phisher98/nuvio-providers/refs/heads/main/manifest.json',
              };
            }
            if (r.manifestUrl.includes('realbestia1/nuvio-providers-it')) {
              changed = true;
              return {
                ...r,
                manifestUrl:
                  'https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json',
              };
            }
            if (
              r.manifestUrl.includes('nvmindl/nuvio-providers') ||
              r.manifestUrl.includes('D3adlyRocket/All-in-One-Nuvio')
            ) {
              changed = true;
              return {
                ...r,
                manifestUrl: DEFAULT_NUVIO_REPO_URL,
              };
            }
            return r;
          });
          if (changed) this.saveInstalledRepos(migrated);
          return migrated;
        }
      }
    } catch {}
    const defaults = getDefaultInstalledRepos();
    this.saveInstalledRepos(defaults);
    return defaults;
  },

  saveInstalledRepos(repos: InstalledNuvioRepo[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INSTALLED_REPOS, JSON.stringify(repos));
    } catch {}
  },

  installDirectoryRepo(repo: NuvioDirectoryRepo, enabled = true): InstalledNuvioRepo[] {
    const key = normalizeRepoUrlKey(repo.manifestUrl);
    const current = this.getInstalledRepos().filter(
      (r) => r.id !== repo.id && normalizeRepoUrlKey(r.manifestUrl) !== key
    );
    const nextItem = toInstalledRepo(repo, enabled);
    const updated = [nextItem, ...current];
    this.saveInstalledRepos(updated);
    void this.clearServerCache();
    return updated;
  },

  async installCustomRepoUrl(rawUrl: string): Promise<InstalledNuvioRepo> {
    const trimmed = rawUrl.trim();
    const key = normalizeRepoUrlKey(trimmed);
    const dirMatch = NUVIO_PLUGIN_REPOS.find(
      (r) =>
        normalizeRepoUrlKey(r.manifestUrl) === key ||
        r.name.toLowerCase() === trimmed.toLowerCase() ||
        r.author.toLowerCase() === trimmed.toLowerCase()
    );

    const targetUrl = dirMatch ? dirMatch.manifestUrl : trimmed;
    const manifest = await this.fetchRepositoryManifest(targetUrl, true);
    const plugins = manifest?.scrapers?.length
      ? mapManifestToPlugins(manifest.scrapers)
      : dirMatch?.plugins || [];

    const customRepo: InstalledNuvioRepo = dirMatch
      ? {
          ...toInstalledRepo(dirMatch, true),
          name: manifest?.name || dirMatch.name,
          plugins,
        }
      : {
          id: `nuvio-custom-${Date.now()}`,
          name: manifest?.name || `${extractAuthorFromUrl(targetUrl)} Nuvio Repo`,
          author: extractAuthorFromUrl(targetUrl),
          description: `Nuvio manifest (${plugins.length} scrapers)`,
          manifestUrl: targetUrl,
          enabled: true,
          tags: ['Custom'],
          languages: Array.from(
            new Set(plugins.flatMap((p) => p.languages).filter(Boolean))
          ).slice(0, 6),
          plugins,
          addedAt: Date.now(),
        };

    const current = this.getInstalledRepos();
    const filtered = current.filter(
      (r) =>
        normalizeRepoUrlKey(r.manifestUrl) !== normalizeRepoUrlKey(targetUrl) &&
        r.id !== customRepo.id
    );
    this.saveInstalledRepos([customRepo, ...filtered]);
    void this.clearServerCache();
    return customRepo;
  },

  installAllDirectoryRepos(): InstalledNuvioRepo[] {
    const current = this.getInstalledRepos();
    const byUrl = new Map<string, InstalledNuvioRepo>();
    for (const r of current) {
      byUrl.set(normalizeRepoUrlKey(r.manifestUrl), r);
    }
    for (const dirRepo of NUVIO_PLUGIN_REPOS) {
      const k = normalizeRepoUrlKey(dirRepo.manifestUrl);
      const existing = byUrl.get(k);
      byUrl.set(
        k,
        existing ? { ...existing, enabled: true } : toInstalledRepo(dirRepo, true)
      );
    }
    const all = Array.from(byUrl.values());
    this.saveInstalledRepos(all);
    void this.clearServerCache();
    return all;
  },

  async refreshInstalledRepos(): Promise<InstalledNuvioRepo[]> {
    await this.clearServerCache();
    const current = this.getInstalledRepos();
    const refreshed = await Promise.all(
      current.map(async (repo) => {
        const manifest = await this.fetchRepositoryManifest(repo.manifestUrl, true);
        if (manifest && Array.isArray(manifest.scrapers) && manifest.scrapers.length > 0) {
          const plugins = mapManifestToPlugins(manifest.scrapers);
          return {
            ...repo,
            name: manifest.name || repo.name,
            description:
              repo.tags?.includes('Custom')
                ? `Nuvio manifest (${plugins.length} live scrapers)`
                : repo.description,
            plugins,
          };
        }
        return repo;
      })
    );
    this.saveInstalledRepos(refreshed);
    return refreshed;
  },

  toggleRepoEnabled(repoId: string, enabled: boolean): InstalledNuvioRepo[] {
    const updated = this.getInstalledRepos().map((r) =>
      r.id === repoId ? { ...r, enabled } : r
    );
    this.saveInstalledRepos(updated);
    void this.clearServerCache();
    return updated;
  },

  removeRepo(repoId: string): InstalledNuvioRepo[] {
    const updated = this.getInstalledRepos().filter((r) => r.id !== repoId);
    this.saveInstalledRepos(updated);
    void this.clearServerCache();
    return updated;
  },

  getDisabledScraperIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DISABLED_IDS);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  },

  setScraperEnabled(scraperId: string, enabled: boolean): void {
    const disabled = this.getDisabledScraperIds();
    if (enabled) {
      disabled.delete(scraperId);
    } else {
      disabled.add(scraperId);
    }
    localStorage.setItem(STORAGE_KEYS.DISABLED_IDS, JSON.stringify([...disabled]));
  },

  enableAllScrapers(): void {
    localStorage.setItem(STORAGE_KEYS.DISABLED_IDS, JSON.stringify([]));
  },

  async fetchRepositoryManifest(repoUrl?: string, forceRefresh = false): Promise<NuvioManifestPayload | null> {
    const url = repoUrl || this.getRepositoryUrl();
    try {
      const res = await fetch(
        `/api/nuvio/manifest?url=${encodeURIComponent(url)}${forceRefresh ? '&refresh=1' : ''}`
      );
      if (!res.ok) return null;
      return (await res.json()) as NuvioManifestPayload;
    } catch {
      return null;
    }
  },

  async resolveStreams(
    params: {
      tmdbId: number;
      mediaType: MediaType;
      title?: string;
      releaseYear?: number;
      seasonNumber?: number;
      episodeNumber?: number;
      isArchiveItem?: boolean;
    },
    onBatch?: (batch: StreamResolutionResult) => void
  ): Promise<StreamResolutionResult & { scraperResults?: NuvioScraperRunResult[] }> {
    if (!params.tmdbId || params.isArchiveItem || !storageService.isProviderToggleEnabled('nuvio')) {
      return { sources: [], subtitles: [] };
    }

    try {
      const installedRepos = this.getInstalledRepos().filter((r) => r.enabled);
      const orderedRepos = [...installedRepos].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      const manifestUrls = Array.from(
        new Set(
          orderedRepos.length > 0
            ? orderedRepos.map((r) => r.manifestUrl)
            : [this.getRepositoryUrl()]
        )
      );

      const disabled = this.getDisabledScraperIds();
      const season = params.seasonNumber || 1;
      const episode = params.episodeNumber || 1;

      const allSources: StreamSource[] = [];
      const seenSourceKeys = new Set<string>();
      const seenSourceIds = new Set<string>();
      const allSubtitles: SubtitleTrack[] = [];
      const seenSubIds = new Set<string>();
      const allScraperResults: NuvioScraperRunResult[] = [];

      const disabledIdsParam =
        disabled.size > 0 ? `&disabledIds=${encodeURIComponent(Array.from(disabled).join(','))}` : '';
      const titleParam = params.title ? `&title=${encodeURIComponent(params.title)}` : '';
      const yearParam = params.releaseYear ? `&year=${params.releaseYear}` : '';

      const matchesNuvioEpisode = (src: StreamSource): boolean => {
        if (params.mediaType !== 'tv' || !params.seasonNumber || !params.episodeNumber) return true;
        const text = `${src.label || ''} ${src.note || ''}`;
        const exact = new RegExp(
          `(?:s0?${params.seasonNumber}[\\s._-]*e0?${params.episodeNumber}\\b|\\b${params.seasonNumber}x0?${params.episodeNumber}\\b)`,
          'i'
        );
        if (exact.test(text)) return true;
        if (/\bs\d{1,2}[\s._-]*e\d{1,2}\b|\b\d{1,2}x\d{1,2}\b/i.test(text)) return false;
        return true;
      };

      const timerFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
      const clearTimerFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;

      await Promise.allSettled(
        manifestUrls.map(async (repoUrl, repoIdx) => {
          const controller = new AbortController();
          const timeout = timerFn(() => controller.abort(), 38000);
          try {
            const endpoint = `/api/nuvio/streams?tmdbId=${params.tmdbId}&mediaType=${params.mediaType}&season=${season}&episode=${episode}&manifestUrl=${encodeURIComponent(repoUrl)}${disabledIdsParam}${titleParam}${yearParam}`;
            const res = await fetch(endpoint, { signal: controller.signal });
            if (!res.ok) return;

            const data = (await res.json()) as {
              sources?: StreamSource[];
              subtitles?: SubtitleTrack[];
              scraperResults?: NuvioScraperRunResult[];
            };

            const batchSources: StreamSource[] = [];
            const batchSubtitles: SubtitleTrack[] = [];

            for (const src of data.sources || []) {
              if (!matchesNuvioEpisode(src)) continue;
              const dedupeKey = `${src.url}::${src.audioLanguage || ''}`;
              if (src.url && !seenSourceKeys.has(dedupeKey)) {
                seenSourceKeys.add(dedupeKey);
                let safeId = src.id;
                if (seenSourceIds.has(safeId)) {
                  safeId = `${src.id}-r${repoIdx}`;
                }
                while (seenSourceIds.has(safeId)) {
                  safeId = `${safeId}-${seenSourceIds.size}`;
                }
                seenSourceIds.add(safeId);
                const cleanSrc = { ...src, id: safeId };
                allSources.push(cleanSrc);
                batchSources.push(cleanSrc);
              }
            }
            for (const sub of data.subtitles || []) {
              let safeSubId = sub.id;
              if (seenSubIds.has(safeSubId)) {
                safeSubId = `${sub.id}-r${repoIdx}`;
              }
              while (seenSubIds.has(safeSubId)) {
                safeSubId = `${safeSubId}-${seenSubIds.size}`;
              }
              seenSubIds.add(safeSubId);
              const cleanSub = { ...sub, id: safeSubId };
              allSubtitles.push(cleanSub);
              batchSubtitles.push(cleanSub);
            }
            for (const sr of data.scraperResults || []) {
              allScraperResults.push(sr);
            }

            if ((batchSources.length > 0 || batchSubtitles.length > 0) && onBatch) {
              onBatch({ sources: batchSources, subtitles: batchSubtitles });
            }
          } catch {
            // Skip unreachable Nuvio repo
          } finally {
            clearTimerFn(timeout);
          }
        })
      );

      return {
        sources: allSources,
        subtitles: allSubtitles,
        scraperResults: allScraperResults,
      };
    } catch {
      return { sources: [], subtitles: [] };
    }
  },

  async runHealthCheck(repoUrl?: string): Promise<Record<string, 'ok' | 'error'>> {
    const url = repoUrl || this.getRepositoryUrl();
    try {
      const res = await fetch(`/api/nuvio/health?manifestUrl=${encodeURIComponent(url)}`);
      if (!res.ok) return {};
      const data = (await res.json()) as { statusMap?: Record<string, 'ok' | 'error'> };
      return data.statusMap || {};
    } catch {
      return {};
    }
  },

  async runStremioHealthCheck(manifestUrls: string[]): Promise<Record<string, 'ok' | 'error'>> {
    if (!manifestUrls.length) return {};
    try {
      const res = await fetch(`/api/stremio/health?urls=${encodeURIComponent(manifestUrls.join(','))}`);
      if (!res.ok) return {};
      const data = (await res.json()) as { statusMap?: Record<string, 'ok' | 'error'> };
      return data.statusMap || {};
    } catch {
      return {};
    }
  },

  async checkAllProvidersHealth(
    targets: Array<{
      key: string;
      kind: 'stremio' | 'nuvio' | 'cloudstream' | 'core';
      url: string;
      name?: string;
    }>,
    onProgress?: (chunkResults: Record<string, { status: 'online' | 'degraded' | 'offline'; latency: number; detail?: string }>) => void
  ): Promise<{
    results: Record<string, { status: 'online' | 'degraded' | 'offline'; latency: number; detail?: string }>;
    summary: { total: number; online: number; degraded: number; offline: number };
    checkedAt: number;
  }> {
    if (targets.length === 0) {
      return {
        results: {},
        summary: { total: 0, online: 0, degraded: 0, offline: 0 },
        checkedAt: Date.now(),
      };
    }

    const CHUNK_SIZE = 18;
    const allResults: Record<string, { status: 'online' | 'degraded' | 'offline'; latency: number; detail?: string }> = {};

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 45000);

      try {
        const res = await fetch('/api/providers/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets: chunk }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as {
            results?: Record<
              string,
              { status: 'online' | 'degraded' | 'offline'; latency: number; detail?: string }
            >;
          };
          const chunkMap = data.results || {};
          for (const [k, v] of Object.entries(chunkMap)) {
            allResults[k] = v;
          }
          if (onProgress) {
            onProgress(chunkMap);
          }
        } else {
          for (const item of chunk) {
            const fail = { status: 'offline' as const, latency: 0, detail: `HTTP ${res.status}` };
            allResults[item.key] = fail;
          }
          if (onProgress) {
            const fallbackMap: Record<string, { status: 'offline'; latency: number; detail: string }> = {};
            for (const item of chunk) {
              fallbackMap[item.key] = { status: 'offline', latency: 0, detail: `HTTP ${res.status}` };
            }
            onProgress(fallbackMap);
          }
        }
      } catch (err) {
        const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
        const detail = isTimeout ? 'Request timeout' : 'Unreachable';
        const chunkFails: Record<string, { status: 'offline'; latency: number; detail: string }> = {};
        for (const item of chunk) {
          const fail = { status: 'offline' as const, latency: 0, detail };
          allResults[item.key] = fail;
          chunkFails[item.key] = fail;
        }
        if (onProgress) {
          onProgress(chunkFails);
        }
      } finally {
        window.clearTimeout(timer);
      }
    }

    const values = Object.values(allResults);
    const online = values.filter((v) => v.status === 'online').length;
    const degraded = values.filter((v) => v.status === 'degraded').length;
    const offline = values.filter((v) => v.status === 'offline').length;

    return {
      results: allResults,
      summary: { total: values.length, online, degraded, offline },
      checkedAt: Date.now(),
    };
  },
};
