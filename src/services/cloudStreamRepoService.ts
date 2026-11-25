import { CloudStreamProviderItem, CloudStreamRepository } from '../types/media';
import {
  CLOUDSTREAM_DIRECTORY_REPOS,
  RawCloudStreamPlugin,
  RawCloudStreamRepo,
} from '../data/cloudstreamRepoData';
import { storageService } from './storageService';

const STORAGE_KEY = 'kinostream_cloudstream_repos';

function inferPluginType(
  pluginName: string,
  repoTags?: string[]
): 'Series' | 'Movies' | 'Anime' | 'Livestream' | 'Others' {
  const name = pluginName.toLowerCase();
  if (
    name.includes('anime') ||
    name.includes('hianime') ||
    name.includes('aniwatch') ||
    name.includes('kaido') ||
    name.includes('kisskh') ||
    name.includes('toon') ||
    name.includes('anichi')
  ) {
    return 'Anime';
  }
  if (
    name.includes('iptv') ||
    name.includes('live') ||
    name.includes('twitch') ||
    name.includes('dailymotion') ||
    name.includes('sports') ||
    name.includes('tennistream')
  ) {
    return 'Livestream';
  }
  if (
    name.includes('series') ||
    name.includes('drama') ||
    name.includes('tv') ||
    name.includes('invidious')
  ) {
    return 'Series';
  }
  if (
    name.includes('movie') ||
    name.includes('cinema') ||
    name.includes('film') ||
    name.includes('box') ||
    name.includes('yts') ||
    name.includes('flix') ||
    name.includes('stream') ||
    name.includes('archive')
  ) {
    return 'Movies';
  }
  return 'Others';
}

function inferPluginLanguage(
  pluginName: string,
  repoTags?: string[]
): string | undefined {
  const name = pluginName.toLowerCase();
  const tags = (repoTags || []).map((t) => t.toLowerCase());

  if (
    tags.includes('hindi') ||
    tags.includes('bollywood') ||
    tags.includes('desi') ||
    tags.includes('indian') ||
    name.includes('hindi') ||
    name.includes('desi') ||
    name.includes('bolly') ||
    name.includes('hdhub') ||
    name.includes('multimovies') ||
    name.includes('hindmovie') ||
    name.includes('hdmovie2') ||
    name.includes('moviesmod') ||
    name.includes('4khdhub') ||
    name.includes('fourkhdhub') ||
    name.includes('fourkhd') ||
    name.includes('filmy') ||
    name.includes('movierulz') ||
    name.includes('movies4u') ||
    name.includes('allmovieland') ||
    name.includes('moviebox') ||
    name.includes('dudefilms') ||
    name.includes('vegamovies') ||
    name.includes('katmovie') ||
    name.includes('netmirror') ||
    name.includes('mkvcinemas') ||
    name.includes('uwatchfree') ||
    name.includes('9kmovies') ||
    name.includes('themoviesflix') ||
    name.includes('cinestream') ||
    name.includes('moviesdrive') ||
    name.includes('zinkmovies') ||
    name.includes('xdmovies') ||
    name.includes('toonhub') ||
    name.includes('toonstream') ||
    name.includes('animesalt') ||
    name.includes('animedekho') ||
    name.includes('animeworld') ||
    name.includes('doflix') ||
    name.includes('dooflix') ||
    name.includes('castle') ||
    name.includes('cricify') ||
    name.includes('pikashow') ||
    name.includes('streamflix') ||
    name.includes('mp4moviez') ||
    name.includes('fullymaza') ||
    name.includes('movipk') ||
    name.includes('watchmoviespk') ||
    name.includes('onlinemovieshindi') ||
    name.includes('moviezwap') ||
    name.includes('fibwatch') ||
    name.includes('cinemacity') ||
    name.includes('movieblast') ||
    name.includes('topcartoons') ||
    name.includes('uhdmovies') ||
    name.includes('istreamflare') ||
    name.includes('ringz') ||
    name.includes('dorabash') ||
    name.includes('xon') ||
    name.includes('desiserials') ||
    name.includes('cinevood') ||
    name.includes('einthusan') ||
    name.includes('desicinemas') ||
    name.includes('filmycab') ||
    name.includes('filmyfiy') ||
    name.includes('fivemovierulz')
  ) {
    return 'Hindi';
  }
  if (tags.includes('bengali') || name.includes('bengali') || name.includes('bangla')) {
    return 'Bengali';
  }
  if (tags.includes('tamil') || name.includes('tamil')) {
    return 'Tamil';
  }
  if (tags.includes('telugu') || name.includes('telugu')) {
    return 'Telugu';
  }
  if (tags.includes('arabic') || tags.includes('3rabi')) {
    return 'Arabic';
  }
  if (tags.includes('french')) {
    return 'French';
  }
  if (tags.includes('german')) {
    return 'German';
  }
  if (tags.includes('italian')) {
    return 'Italian';
  }
  if (tags.includes('turkish')) {
    return 'Turkish';
  }
  if (tags.includes('indonesian') || tags.includes('indos')) {
    return 'Indonesian';
  }
  if (tags.includes('vietnamese')) {
    return 'Vietnamese';
  }
  if (name.includes('anime')) {
    return 'Japanese';
  }
  if (tags.includes('english')) {
    return 'English';
  }
  return undefined;
}

function convertRawToRepository(
  raw: RawCloudStreamRepo,
  downloadAll = false
): CloudStreamRepository {
  const providers: CloudStreamProviderItem[] = raw.plugins.map((p, idx) => {
    const lang = inferPluginLanguage(p.name, raw.tags);
    const isTopFeatured =
      p.featured ||
      [
        'multimovies',
        'superstream',
        'streamplay',
        'hdhub4u',
        'fourkhdhub',
        '4khdhub',
        'hindmoviez',
        'desicinemas',
        'moviesmod',
        'allmovieland',
        'moviebox',
        'filmyfiy',
        'movies4u',
        'netmirror',
        'vegamovies',
        'bollyflix',
        'moviesdrive',
        'cinestream',
        'yts',
        'animedekho',
        'animepahe',
        'hianime',
        'invidious',
        'dailymotion',
        'twitch',
        'showbox',
      ].includes(p.name.toLowerCase());

    const isDownloaded = downloadAll || Boolean(isTopFeatured) || lang === 'Hindi';

    return {
      id: `${raw.id}-${idx}-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: p.name,
      type: inferPluginType(p.name, raw.tags),
      version: '1.0.0',
      size: '—',
      description: `Watch content from ${p.name} on CloudStream`,
      downloaded: isDownloaded,
      lang,
    };
  });

  return {
    id: raw.id,
    name: raw.name,
    url: raw.directInstall,
    description: raw.description || `CloudStream extension repository (${raw.plugins.length} plugins)`,
    author: raw.badge || 'CloudStream Community',
    icon: raw.icon || '☁️',
    tags: raw.tags,
    downloadedCount: providers.filter((p) => p.downloaded).length,
    totalCount: providers.length,
    providers,
  };
}

async function fetchLiveCloudStreamRepoJson(
  url: string,
  repoIdPrefix: string,
  downloadedSet?: Set<string>
): Promise<{
  name?: string;
  author?: string;
  description?: string;
  providers: CloudStreamProviderItem[];
}> {
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    throw new Error(`Repository manifest returned HTTP ${res.status}`);
  }
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Repository did not return valid JSON.');
  }

  let list: any[] | null =
    data.extensions ||
    data.providers ||
    data.plugins ||
    data.repositories ||
    data.list ||
    (Array.isArray(data) ? data : null);

  // Many CloudStream repos list plugin list URLs under data.pluginLists
  if ((!Array.isArray(list) || list.length === 0) && Array.isArray(data.pluginLists) && data.pluginLists.length > 0) {
    const collected: any[] = [];
    for (const listUrl of data.pluginLists.slice(0, 3)) {
      if (typeof listUrl !== 'string' || !listUrl.startsWith('http')) continue;
      try {
        const subRes = await fetch(`/api/proxy?url=${encodeURIComponent(listUrl)}`);
        if (!subRes.ok) continue;
        const subData = await subRes.json();
        if (Array.isArray(subData)) collected.push(...subData);
        else if (Array.isArray(subData?.plugins)) collected.push(...subData.plugins);
      } catch {
        // Ignore individual sub-list error
      }
    }
    if (collected.length > 0) list = collected;
  }

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Repository JSON contains zero plugins.');
  }

  const providers: CloudStreamProviderItem[] = list.map((p: any, i: number) => {
    const name =
      typeof p === 'string'
        ? p
        : p.name || p.internalName || p.displayName || p.title || `Provider ${i + 1}`;
    const ver =
      p?.version !== undefined && p?.version !== null
        ? String(p.version).startsWith('v')
          ? String(p.version)
          : `v${p.version}`
        : '1.0.0';
    return {
      id: p.id || `${repoIdPrefix}-${i}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      type: inferPluginType(name),
      version: ver,
      size: typeof p?.fileSize === 'number' ? `${Math.max(1, Math.round(p.fileSize / 1024))} kB` : p?.size || '—',
      description: p?.description || p?.summary || `Stream content from ${name}`,
      downloaded: downloadedSet ? downloadedSet.has(name.toLowerCase()) || downloadedSet.size === 0 : true,
      lang: inferPluginLanguage(name),
    };
  });

  return {
    name: data.name || data.repoName || data.title,
    author: data.author || data.creator,
    description: data.description,
    providers,
  };
}

function deduplicateProviders(providers: CloudStreamProviderItem[]): CloudStreamProviderItem[] {
  const seen = new Set<string>();
  const result: CloudStreamProviderItem[] = [];
  for (const p of providers || []) {
    if (!p || !p.id) continue;
    const key = String(p.id).trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

export function deduplicateCloudStreamRepos(repos: CloudStreamRepository[]): CloudStreamRepository[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const result: CloudStreamRepository[] = [];
  for (const repo of repos || []) {
    if (!repo || !repo.id) continue;
    const idKey = String(repo.id).trim().toLowerCase();
    const urlKey = (repo.url || '').trim().replace(/\/+$/, '').toLowerCase();
    if (seenIds.has(idKey) || (urlKey && seenUrls.has(urlKey))) continue;
    seenIds.add(idKey);
    if (urlKey) seenUrls.add(urlKey);
    const uniqueProviders = deduplicateProviders(repo.providers || []);
    result.push({
      ...repo,
      id: String(repo.id).trim(),
      providers: uniqueProviders,
      downloadedCount: uniqueProviders.filter((p) => p.downloaded).length,
      totalCount: uniqueProviders.length,
    });
  }
  return result;
}

// Generate the initial default repositories (Popular + Hindi repositories from cloudstreamrepo.com)
export function getInitialDefaultRepositories(): CloudStreamRepository[] {
  const defaultIds = ['phisher', 'megix', 'cncverse', 'netmirror', 'redowan', 'cspr', 'mega', 'dogior', 'cskarma'];
  return deduplicateCloudStreamRepos(
    CLOUDSTREAM_DIRECTORY_REPOS.filter((r) => defaultIds.includes(r.id)).map((r) =>
      convertRawToRepository(r, false)
    )
  );
}

export const cloudStreamRepoService = {
  getRepositories(): CloudStreamRepository[] {
    const hindiMigrationKey = 'kinostream_cs_hindi_migrated_v3';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CloudStreamRepository[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          let changed = false;
          const byId = new Map(CLOUDSTREAM_DIRECTORY_REPOS.map((r) => [r.id, r]));
          let migratedRaw = parsed.map((repo) => {
            const dirMatch = byId.get(repo.id);
            let nextRepo = repo;
            if (dirMatch && dirMatch.directInstall && repo.url !== dirMatch.directInstall) {
              changed = true;
              nextRepo = { ...nextRepo, url: dirMatch.directInstall };
            }
            const nextProviders = (nextRepo.providers || []).map((prov) => {
              const inferred = inferPluginLanguage(prov.name, dirMatch?.tags);
              if (inferred === 'Hindi') {
                if (prov.lang !== 'Hindi' || !prov.downloaded) {
                  changed = true;
                  return { ...prov, lang: 'Hindi', downloaded: true };
                }
              }
              return prov;
            });
            return { ...nextRepo, providers: nextProviders };
          });

          if (localStorage.getItem(hindiMigrationKey) !== '1') {
            localStorage.setItem(hindiMigrationKey, '1');
            const existingIds = new Set(migratedRaw.map((r) => r.id.toLowerCase()));
            for (const reqId of ['redowan', 'cncverse', 'netmirror', 'megix', 'phisher']) {
              const dirRepo = byId.get(reqId);
              if (dirRepo && !existingIds.has(dirRepo.id.toLowerCase())) {
                migratedRaw = [convertRawToRepository(dirRepo, false), ...migratedRaw];
                existingIds.add(dirRepo.id.toLowerCase());
                changed = true;
              }
            }
          }

          const deduplicated = deduplicateCloudStreamRepos(migratedRaw);
          if (deduplicated.length !== parsed.length) {
            changed = true;
          }
          if (changed) this.saveRepositories(deduplicated);
          return deduplicated;
        }
      }
    } catch {}
    localStorage.setItem(hindiMigrationKey, '1');
    const defaults = getInitialDefaultRepositories();
    this.saveRepositories(defaults);
    return defaults;
  },

  getAllDirectoryRepos(): RawCloudStreamRepo[] {
    return CLOUDSTREAM_DIRECTORY_REPOS;
  },

  saveRepositories(repos: CloudStreamRepository[]): void {
    try {
      const clean = deduplicateCloudStreamRepos(repos);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {}
  },

  async installAllDirectoryRepos(): Promise<CloudStreamRepository[]> {
    const all = deduplicateCloudStreamRepos(
      CLOUDSTREAM_DIRECTORY_REPOS.map((r) => convertRawToRepository(r, true))
    );
    this.saveRepositories(all);
    return all;
  },

  async addRepository(inputUrlOrShortcode: string): Promise<CloudStreamRepository> {
    const query = inputUrlOrShortcode.trim();
    const queryLower = query.toLowerCase();

    // Check if user entered "all" or "500" or cloudstreamrepo link
    if (
      queryLower === 'all' ||
      queryLower === '500' ||
      queryLower.includes('cloudstreamrepo.com')
    ) {
      const all = await this.installAllDirectoryRepos();
      return all[0];
    }

    // Check directory repos by shortcode, id, or directInstall URL
    const matched = CLOUDSTREAM_DIRECTORY_REPOS.find((r) => {
      if (r.id.toLowerCase() === queryLower) return true;
      if (r.shortcodes && r.shortcodes.some((s) => s.toLowerCase() === queryLower)) return true;
      if (r.directInstall.toLowerCase() === queryLower) return true;
      if (r.name.toLowerCase().includes(queryLower)) return true;
      return false;
    });

    if (matched) {
      const newRepo = convertRawToRepository(matched, true);
      const current = this.getRepositories().filter(
        (r) =>
          r.id.toLowerCase() !== newRepo.id.toLowerCase() &&
          (r.url || '').trim().toLowerCase() !== (newRepo.url || '').trim().toLowerCase()
      );
      const updated = deduplicateCloudStreamRepos([newRepo, ...current]);
      this.saveRepositories(updated);
      return updated[0] || newRepo;
    }

    // Try fetching via /api/proxy for external custom URL (propagate errors instead of fabricating fake plugins)
    let url = query;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('/')) {
        url = `https://raw.githubusercontent.com/${url}/refs/heads/master/repo.json`;
      } else {
        url = `https://raw.githubusercontent.com/${url}/${url}/refs/heads/master/repo.json`;
      }
    }

    const repoId = 'repo-' + Date.now();
    const live = await fetchLiveCloudStreamRepoJson(url, repoId);

    let fallbackHostName = 'Custom Extension Repo';
    try {
      fallbackHostName = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }

    const newRepo: CloudStreamRepository = {
      id: repoId,
      name: live.name || fallbackHostName,
      url,
      description: live.description || `CloudStream extension repository (${live.providers.length} plugins)`,
      author: live.author || 'Community',
      icon: '☁️',
      downloadedCount: live.providers.filter((p) => p.downloaded).length,
      totalCount: live.providers.length,
      providers: live.providers,
    };

    const current = this.getRepositories();
    const updated = [newRepo, ...current];
    this.saveRepositories(updated);
    return newRepo;
  },

  removeRepository(repoId: string): CloudStreamRepository[] {
    const current = this.getRepositories();
    const updated = current.filter((r) => r.id !== repoId);
    this.saveRepositories(updated);
    return updated;
  },

  downloadAllInRepo(repoId: string): CloudStreamRepository[] {
    const current = this.getRepositories();
    const updated = current.map((repo) => {
      if (repo.id === repoId) {
        const newProviders = repo.providers.map((p) => ({ ...p, downloaded: true }));
        return {
          ...repo,
          providers: newProviders,
          downloadedCount: newProviders.length,
        };
      }
      return repo;
    });
    this.saveRepositories(updated);
    return updated;
  },

  removeAllInRepo(repoId: string): CloudStreamRepository[] {
    const current = this.getRepositories();
    const updated = current.map((repo) => {
      if (repo.id === repoId) {
        const newProviders = repo.providers.map((p) => ({ ...p, downloaded: false }));
        return {
          ...repo,
          providers: newProviders,
          downloadedCount: 0,
        };
      }
      return repo;
    });
    this.saveRepositories(updated);
    return updated;
  },

  toggleProviderDownload(repoId: string, providerId: string): CloudStreamRepository[] {
    const current = this.getRepositories();
    const updated = current.map((repo) => {
      if (repo.id === repoId) {
        const newProviders = repo.providers.map((p) => {
          if (p.id === providerId) {
            return { ...p, downloaded: !p.downloaded };
          }
          return p;
        });
        const downloadedCount = newProviders.filter((p) => p.downloaded).length;
        return {
          ...repo,
          providers: newProviders,
          downloadedCount,
          totalCount: newProviders.length,
        };
      }
      return repo;
    });
    this.saveRepositories(updated);
    return updated;
  },

  async refreshAllRepositories(): Promise<CloudStreamRepository[]> {
    const current = this.getRepositories();
    const updated = await Promise.all(
      current.map(async (repo) => {
        const downloadedSet = new Set(
          repo.providers.filter((p) => p.downloaded).map((p) => p.name.toLowerCase())
        );

        if (repo.url && repo.url.startsWith('http')) {
          try {
            const live = await fetchLiveCloudStreamRepoJson(repo.url, repo.id, downloadedSet);
            return {
              ...repo,
              name: live.name || repo.name,
              description: live.description || repo.description,
              providers: live.providers,
              totalCount: live.providers.length,
              downloadedCount: live.providers.filter((p) => p.downloaded).length,
            };
          } catch {
            // Fall through to directory snapshot if live repo fetch is temporarily unavailable
          }
        }

        const dirMatch = CLOUDSTREAM_DIRECTORY_REPOS.find(
          (r) => r.id === repo.id || r.directInstall.toLowerCase() === (repo.url || '').toLowerCase()
        );
        if (dirMatch) {
          const fresh = convertRawToRepository(dirMatch, false);
          const mergedProviders = fresh.providers.map((p) => ({
            ...p,
            downloaded: p.downloaded || downloadedSet.has(p.name.toLowerCase()),
          }));
          return {
            ...fresh,
            providers: mergedProviders,
            downloadedCount: mergedProviders.filter((p) => p.downloaded).length,
          };
        }
        return repo;
      })
    );
    this.saveRepositories(updated);
    return updated;
  },
};
