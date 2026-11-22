import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Download,
  Film,
  Folder,
  Globe,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  NUVIO_PLUGIN_REPOS,
  NuvioDirectoryRepo,
  STREMIO_ADDONS_NET_DIRECTORY,
  StremioNetDirectoryAddon,
} from '../data/nuvioAndStremioCatalog';
import { InstalledNuvioRepo, nuvioService } from '../services/nuvioService';
import { normalizeStremioUrlKey } from '../services/stremioAddonService';
import { ProviderHealthEntry, useAppState } from '../state/AppContext';
import { CloudStreamRepository, StremioAddonConfig } from '../types/media';
import { TokenCreditStatusBadge } from './TokenCreditStatusBadge';

type DirectoryTab = 'cloudstream' | 'nuvio' | 'stremio';
type StremioCategoryTab =
  | 'All'
  | 'Streams'
  | 'Hindi & Regional'
  | 'Anime'
  | 'Live TV & Sports'
  | 'Subtitles'
  | 'Catalogs';

export const ExtensionsScreen: React.FC = () => {
  const {
    stremioAddons,
    removeStremioAddon,
    toggleStremioAddon,
    installStremioDirectoryItem,
    installPopularStremioPack,
    nuvioRepos: installedNuvioRepos,
    installNuvioDirectoryRepo,
    installAllNuvioRepos,
    toggleNuvioRepo,
    removeNuvioRepo,
    cloudStreamRepos: repositories,
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
  } = useAppState();

  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>('cloudstream');

  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<
    'All' | 'Series' | 'Livestream' | 'Movies' | 'Anime' | 'Others'
  >('All');

  const [selectedNuvioRepoId, setSelectedNuvioRepoId] = useState<string | null>(null);

  const [stremioCategory, setStremioCategory] = useState<StremioCategoryTab>('All');
  const [installingAddonSlug, setInstallingAddonSlug] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [repoInputUrl, setRepoInputUrl] = useState('');
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [nuvioPluginHealth, setNuvioPluginHealth] = useState<Record<string, 'ok' | 'error'>>({});
  const [checkingNuvioScrapers, setCheckingNuvioScrapers] = useState(false);
  const [nuvioScraperError, setNuvioScraperError] = useState<string | null>(null);

  const hasAutoPingedRef = useRef(false);

  useEffect(() => {
    if (
      !hasAutoPingedRef.current &&
      !providerHealthSummary &&
      Object.keys(providerHealthMap).length < 30 &&
      !isCheckingProviders
    ) {
      hasAutoPingedRef.current = true;
      void checkAllProvidersHealth({ includeDirectory: true });
    }
  }, [providerHealthMap, providerHealthSummary, isCheckingProviders, checkAllProvidersHealth]);

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const renderProviderStatusPill = (entry?: ProviderHealthEntry) => {
    if (!entry) return null;
    if (entry.status === 'checking') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-medium inline-flex items-center gap-1 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          Checking...
        </span>
      );
    }
    const isDegraded =
      entry.status === 'degraded' ||
      (entry.status === 'online' && typeof entry.latency === 'number' && entry.latency >= 2500);
    if (entry.status === 'online' || isDegraded) {
      return (
        <span
          title={entry.detail || (isDegraded ? 'Degraded response' : 'Endpoint healthy')}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 border ${
            isDegraded
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isDegraded ? 'bg-amber-400' : 'bg-emerald-400'}`}
          />
          {isDegraded ? 'Degraded' : 'Online'}
          {typeof entry.latency === 'number' && entry.latency > 0 ? ` (${entry.latency}ms)` : ''}
        </span>
      );
    }
    return (
      <span
        title={entry.detail || 'Endpoint unreachable'}
        className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Offline{entry.detail ? ` · ${entry.detail}` : ''}
      </span>
    );
  };

  const handleCheckAllProviders = async () => {
    const summary = await checkAllProvidersHealth({ includeDirectory: true, force: true });
    if (summary) {
      notify(
        `Monitor complete: ${summary.online} online, ${summary.degraded} degraded, ${summary.offline} offline.`
      );
    }
  };

  const handleCheckNuvioScrapers = async (manifestUrl: string) => {
    setCheckingNuvioScrapers(true);
    setNuvioScraperError(null);
    try {
      const map = await nuvioService.runHealthCheck(manifestUrl);
      const entries = Object.values(map);
      if (entries.length === 0) {
        setNuvioScraperError('Could not check scrapers for this repository right now.');
      } else {
        setNuvioPluginHealth((prev) => ({ ...prev, ...map }));
        const workingCount = entries.filter((s) => s === 'ok').length;
        notify(`Checked ${entries.length} scrapers: ${workingCount} working, ${entries.length - workingCount} offline.`);
      }
    } catch {
      setNuvioScraperError('Network timeout while testing individual scrapers.');
    } finally {
      setCheckingNuvioScrapers(false);
    }
  };

  const selectedRepo: CloudStreamRepository | null = useMemo(
    () => (selectedRepoId ? repositories.find((r) => r.id === selectedRepoId) || null : null),
    [selectedRepoId, repositories]
  );

  // Universal Add Repository / Addon handler using AppContext JSON auto-detection
  const handleAddRepoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = repoInputUrl.trim();
    if (!raw) return;
    setIsAddingRepo(true);
    setAddError(null);
    setSuccessMsg(null);

    try {
      const result = await installByInput(raw);
      setDirectoryTab(result.kind);
      setRepoInputUrl('');
      setIsAddModalOpen(false);
      notify(result.message);
      void checkAllProvidersHealth({ includeDirectory: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repository or addon.';
      setAddError(msg);
    } finally {
      setIsAddingRepo(false);
    }
  };

  const handleUpdateAll = async () => {
    setAddError(null);
    try {
      const counts = await updateAllAddonsAndRepos();
      notify(
        `Updated live manifests: ${counts.nuvioCount} Nuvio repos, ${counts.stremioCount} Stremio add-ons & ${counts.cloudStreamCount} CloudStream repos.`
      );
    } catch {
      notify('Refreshed available repositories and cleared stream caches.');
    }
  };

  // CloudStream actions
  const handleInstallAllCloudStreamRepos = async () => {
    setIsAddingRepo(true);
    try {
      const all = await installAllCloudStreamRepos();
      const total = all.reduce((acc, r) => acc + r.totalCount, 0);
      notify(`Installed all ${all.length} CloudStream repositories (${total} plugins)!`);
    } catch {
      setAddError('Failed to install all repositories');
    } finally {
      setIsAddingRepo(false);
    }
  };

  const handleRemoveRepo = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCloudStreamRepo(repoId);
    if (selectedRepoId === repoId) setSelectedRepoId(null);
  };

  // Nuvio actions
  const handleInstallAllNuvio = () => {
    const all = installAllNuvioRepos();
    const totalPlugins = all.reduce((sum, r) => sum + r.plugins.length, 0);
    notify(`Installed & enabled all ${all.length} Nuvio repositories (${totalPlugins} plugins)!`);
  };

  const handleInstallOrToggleNuvioRepo = (dirRepo: NuvioDirectoryRepo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const normUrl = normalizeStremioUrlKey(dirRepo.manifestUrl);
    const existing = installedNuvioRepos.find(
      (r) => normalizeStremioUrlKey(r.manifestUrl) === normUrl || r.id === dirRepo.id
    );
    if (existing) {
      toggleNuvioRepo(existing.id, !existing.enabled);
    } else {
      installNuvioDirectoryRepo(dirRepo, true);
      notify(`Installed Nuvio repo: ${dirRepo.name} (${dirRepo.plugins.length} plugins)`);
    }
  };

  const handleRemoveNuvioRepo = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeNuvioRepo(repoId);
    if (selectedNuvioRepoId === repoId) setSelectedNuvioRepoId(null);
  };

  // Stremio actions
  const handleInstallStremioFromDir = async (item: StremioNetDirectoryAddon) => {
    setInstallingAddonSlug(item.slug);
    try {
      const addon = await installStremioDirectoryItem(item);
      notify(`Installed Stremio add-on: ${addon.name}`);
    } finally {
      setInstallingAddonSlug(null);
    }
  };

  const handleInstallEssentialStremio = async () => {
    setInstallingAddonSlug('__pack__');
    try {
      const addedCount = await installPopularStremioPack();
      notify(`Installed ${addedCount} live stream add-ons from stremio-addons.net!`);
    } finally {
      setInstallingAddonSlug(null);
    }
  };

  // Totals & filters
  const totalDownloaded = repositories.reduce((acc, r) => acc + r.downloadedCount, 0);
  const totalProviders = repositories.reduce((acc, r) => acc + r.totalCount, 0);
  const notDownloaded = Math.max(0, totalProviders - totalDownloaded);

  const filteredRepos = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const seen = new Set<string>();
    return repositories.filter((r) => {
      if (!r?.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return (
        r.name.toLowerCase().includes(q) ||
        (r.author && r.author.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    });
  }, [repositories, searchQuery]);

  const filteredProviders = useMemo(() => {
    if (!selectedRepo) return [];
    const seen = new Set<string>();
    return selectedRepo.providers.filter((p) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryTab === 'All' || p.type === categoryTab;
      return matchesSearch && matchesCat;
    });
  }, [selectedRepo, searchQuery, categoryTab]);

  // Merge custom installed Nuvio repos FIRST + directory Nuvio repos (reflecting live refreshed plugins)
  const combinedNuvioRepos = useMemo(() => {
    const customList: Array<{ dir: NuvioDirectoryRepo; installed?: InstalledNuvioRepo }> = [];
    const dirList: Array<{ dir: NuvioDirectoryRepo; installed?: InstalledNuvioRepo }> = [];
    const seenUrls = new Set<string>();
    const seenIds = new Set<string>();

    for (const dir of NUVIO_PLUGIN_REPOS) {
      const normUrl = normalizeStremioUrlKey(dir.manifestUrl);
      seenUrls.add(normUrl);
      seenIds.add(dir.id);
      const inst = installedNuvioRepos.find(
        (r) => normalizeStremioUrlKey(r.manifestUrl) === normUrl || r.id === dir.id
      );
      const liveDir = inst && inst.plugins.length > 0 ? { ...dir, plugins: inst.plugins, name: inst.name || dir.name } : dir;
      dirList.push({ dir: liveDir, installed: inst });
    }

    for (const inst of installedNuvioRepos) {
      const normUrl = normalizeStremioUrlKey(inst.manifestUrl);
      if (!seenUrls.has(normUrl) && !seenIds.has(inst.id)) {
        seenUrls.add(normUrl);
        seenIds.add(inst.id);
        customList.push({
          dir: {
            id: inst.id,
            name: inst.name,
            author: inst.author,
            description: inst.description,
            tags: inst.tags,
            types: ['movie', 'tv'],
            languages: inst.languages,
            manifestUrl: inst.manifestUrl,
            plugins: inst.plugins,
          },
          installed: inst,
        });
      }
    }

    const list = [...customList, ...dirList];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      ({ dir }) =>
        dir.name.toLowerCase().includes(q) ||
        dir.author.toLowerCase().includes(q) ||
        dir.description.toLowerCase().includes(q) ||
        dir.plugins.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [installedNuvioRepos, searchQuery]);

  const selectedNuvioRepo = useMemo(() => {
    if (!selectedNuvioRepoId) return null;
    const match = combinedNuvioRepos.find(({ dir, installed }) => dir.id === selectedNuvioRepoId || installed?.id === selectedNuvioRepoId);
    return match ? match.dir : null;
  }, [selectedNuvioRepoId, combinedNuvioRepos]);

  const totalNuvioPluginCount = useMemo(
    () => combinedNuvioRepos.reduce((sum, entry) => sum + entry.dir.plugins.length, 0),
    [combinedNuvioRepos]
  );

  // Separate pure Stremio addons (exclude CS repo.json entries) and deduplicate IDs so React keys never collide
  const pureStremioAddons = useMemo(() => {
    const seenIds = new Set<string>();
    return stremioAddons.filter((a) => {
      const m = (a.manifestUrl || '').toLowerCase();
      if (m.endsWith('/repo.json') || m.endsWith('/cs.json')) return false;
      if (!a.id || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    });
  }, [stremioAddons]);

  const installedByManifest = useMemo(() => {
    const map = new Map<string, StremioAddonConfig>();
    for (const a of pureStremioAddons) {
      map.set(normalizeStremioUrlKey(a.manifestUrl), a);
    }
    return map;
  }, [pureStremioAddons]);

  const filteredStremioCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return STREMIO_ADDONS_NET_DIRECTORY.filter((item) => {
      const matchesCat = stremioCategory === 'All' || item.category === stremioCategory;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [stremioCategory, searchQuery]);

  const filteredInstalledStremio = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pureStremioAddons;
    return pureStremioAddons.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        a.manifestUrl.toLowerCase().includes(q)
    );
  }, [pureStremioAddons, searchQuery]);

  const isInsideDetail =
    (directoryTab === 'cloudstream' && Boolean(selectedRepo)) ||
    (directoryTab === 'nuvio' && Boolean(selectedNuvioRepo));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <TokenCreditStatusBadge />
      {/* Notifications */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between"
        >
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 font-bold ml-2"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isInsideDetail ? (
            <button
              type="button"
              onClick={() => {
                setSelectedRepoId(null);
                setSelectedNuvioRepoId(null);
              }}
              className="h-10 w-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Download className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
              <span>
                {directoryTab === 'cloudstream' && selectedRepo
                  ? selectedRepo.name
                  : directoryTab === 'nuvio' && selectedNuvioRepo
                  ? selectedNuvioRepo.name
                  : 'Extensions & Add-ons'}
              </span>
              {!isInsideDetail && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {directoryTab === 'cloudstream'
                    ? 'cloudstreamrepo.com'
                    : directoryTab === 'nuvio'
                    ? 'nuvioplugin.com'
                    : 'stremio-addons.net'}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {directoryTab === 'cloudstream' && selectedRepo
                ? `${selectedRepo.providers.length} total providers • ${selectedRepo.downloadedCount} downloaded`
                : directoryTab === 'nuvio' && selectedNuvioRepo
                ? `${selectedNuvioRepo.plugins.length} live Nuvio plugins by ${selectedNuvioRepo.author}`
                : directoryTab === 'cloudstream'
                ? `${repositories.length} CloudStream repos • ${totalProviders} plugins`
                : directoryTab === 'nuvio'
                ? `${combinedNuvioRepos.length} Nuvio repos • ${totalNuvioPluginCount} live scrapers (${installedNuvioRepos.filter((r) => r.enabled).length} active)`
                : `${pureStremioAddons.filter((a) => a.enabled).length} active installed • ${STREMIO_ADDONS_NET_DIRECTORY.length} catalog add-ons`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!isInsideDetail && (
            <button
              type="button"
              onClick={() => void handleCheckAllProviders()}
              disabled={isCheckingProviders}
              className="min-h-[44px] px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 border border-emerald-500/35 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Activity className={`h-3.5 w-3.5 ${isCheckingProviders ? 'animate-pulse' : ''}`} />
              <span>{isCheckingProviders ? 'Checking...' : 'Check Providers'}</span>
            </button>
          )}

          {directoryTab === 'nuvio' && selectedNuvioRepo && (
            <button
              type="button"
              onClick={() => void handleCheckNuvioScrapers(selectedNuvioRepo.manifestUrl)}
              disabled={checkingNuvioScrapers}
              className="min-h-[44px] px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 border border-emerald-500/35 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Activity className={`h-3.5 w-3.5 ${checkingNuvioScrapers ? 'animate-pulse' : ''}`} />
              <span>{checkingNuvioScrapers ? 'Testing Scrapers...' : 'Check Scrapers'}</span>
            </button>
          )}

          {!isInsideDetail && (
            <button
              type="button"
              onClick={() => void handleUpdateAll()}
              disabled={isUpdatingAddons}
              className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-50 border border-white/15 text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isUpdatingAddons ? 'animate-spin' : ''}`} />
              <span>{isUpdatingAddons ? 'Updating...' : 'Update Add-ons'}</span>
            </button>
          )}

          {!isInsideDetail && directoryTab === 'cloudstream' && (
            <button
              type="button"
              onClick={() => void handleInstallAllCloudStreamRepos()}
              disabled={isAddingRepo}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>Install All (500+ Plugins)</span>
            </button>
          )}
          {!isInsideDetail && directoryTab === 'nuvio' && (
            <button
              type="button"
              onClick={handleInstallAllNuvio}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>Install All Nuvio ({totalNuvioPluginCount} Plugins)</span>
            </button>
          )}
          {!isInsideDetail && directoryTab === 'stremio' && (
            <button
              type="button"
              onClick={() => void handleInstallEssentialStremio()}
              disabled={installingAddonSlug === '__pack__'}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {installingAddonSlug === '__pack__'
                  ? 'Installing...'
                  : 'Install Popular Stream Add-ons'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="min-h-[44px] px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add repo / addon</span>
          </button>
        </div>
      </div>

      {/* Provider Service-Level Online / Degraded / Offline Status Summary */}
      {!isInsideDetail && (providerHealthSummary || providerCheckError) && (
        <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
          {providerCheckError ? (
            <>
              <span className="text-red-300 font-medium">{providerCheckError}</span>
              <button
                type="button"
                onClick={() => void handleCheckAllProviders()}
                className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-white font-semibold transition-colors"
              >
                Continue
              </button>
            </>
          ) : (
            providerHealthSummary && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-slate-300 font-semibold">Service Monitor:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {providerHealthSummary.online} Online
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {providerHealthSummary.degraded} Degraded
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-semibold inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {providerHealthSummary.offline} Offline
                </span>
              </div>
            )
          )}
        </div>
      )}

      {directoryTab === 'nuvio' && selectedNuvioRepo && nuvioScraperError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <span className="text-red-300">{nuvioScraperError}</span>
          <button
            type="button"
            onClick={() => void handleCheckNuvioScrapers(selectedNuvioRepo.manifestUrl)}
            className="px-3 py-1 rounded-lg bg-red-500/25 hover:bg-red-500/40 text-white font-semibold"
          >
            Continue
          </button>
        </div>
      )}

      {/* Directory Source Switcher (CloudStream / Nuvio / Stremio) */}
      {!isInsideDetail && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setDirectoryTab('cloudstream');
              setSearchQuery('');
            }}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors shrink-0 ${
              directoryTab === 'cloudstream'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>CloudStream ({repositories.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectoryTab('nuvio');
              setSearchQuery('');
            }}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors shrink-0 ${
              directoryTab === 'nuvio'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Nuvio Plugins ({combinedNuvioRepos.length} Repos · {totalNuvioPluginCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectoryTab('stremio');
              setSearchQuery('');
            }}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors shrink-0 ${
              directoryTab === 'stremio'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Stremio Add-ons ({pureStremioAddons.length} Installed · {STREMIO_ADDONS_NET_DIRECTORY.length})</span>
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            directoryTab === 'nuvio'
              ? 'Search Nuvio repos or plugins (e.g. Yoru, 4KHDHub, UHDMovies, Spidey, MovieBox)...'
              : directoryTab === 'stremio'
              ? 'Search installed or 180+ Stremio add-ons (e.g. Torrentio, Peerflix, StremThru, USA TV)...'
              : selectedRepo
              ? `Search within ${selectedRepo.name} (${selectedRepo.providers.length} plugins)...`
              : 'Search CloudStream repositories or plugins (e.g. Phisher, MultiMovies, HDhub4u)...'
          }
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-black/40 border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        />
      </div>

      {/* TAB 1: CLOUDSTREAM DIRECTORY */}
      {directoryTab === 'cloudstream' && (
        <>
          {selectedRepo && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['All', 'Series', 'Movies', 'Anime', 'Livestream', 'Others'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryTab(cat)}
                    className={`min-h-[38px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      categoryTab === cat
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-black/30 hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadAllInCloudStreamRepo(selectedRepo.id)}
                  className="min-h-[36px] px-3.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download All</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeAllInCloudStreamRepo(selectedRepo.id)}
                  className="min-h-[36px] px-3.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-white/10 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove All</span>
                </button>
              </div>
            </div>
          )}

          {!selectedRepo ? (
            <div className="space-y-3">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => setSelectedRepoId(repo.id)}
                  className="p-4 rounded-2xl liquid-glass hover:bg-white/[0.08] border border-white/[0.10] flex items-center justify-between gap-4 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0 group-hover:border-blue-500/50 transition-colors text-xl">
                      {repo.icon || '☁️'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {repo.name}
                        </h2>
                        {renderProviderStatusPill(providerHealthMap[`cloudstream:${repo.id}`])}
                        {repo.author && (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] text-slate-300">
                            {repo.author}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                        Downloaded: {repo.downloadedCount}/{repo.totalCount}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{repo.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleRemoveRepo(repo.id, e)}
                    aria-label={`Remove repository ${repo.name}`}
                    className="h-10 w-10 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {filteredRepos.length === 0 && (
                <div className="rounded-2xl liquid-glass p-12 text-center space-y-3">
                  <Folder className="h-10 w-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-white">No repositories match your search</p>
                  <p className="text-xs text-slate-400">
                    Click &quot;Install All&quot; or add by shortcode to get started.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProviders.map((prov) => (
                <div
                  key={prov.id}
                  className="p-4 rounded-2xl liquid-glass border border-white/[0.10] flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-black/40 border border-white/[0.12] flex items-center justify-center shrink-0 text-blue-400">
                      {prov.type === 'Livestream' ? (
                        <Radio className="h-5 w-5" />
                      ) : prov.type === 'Series' ? (
                        <Tv className="h-5 w-5" />
                      ) : prov.type === 'Anime' ? (
                        <Zap className="h-5 w-5 text-amber-400" />
                      ) : (
                        <Film className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">{prov.name}</h3>
                        {renderProviderStatusPill(providerHealthMap[`cloudstream:${selectedRepo.id}`])}
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-[10px] font-mono text-slate-300">
                          {prov.version} • {prov.size}
                        </span>
                        {prov.lang && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-medium">
                            {prov.lang}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 text-[10px]">
                          {prov.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{prov.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCloudStreamProvider(selectedRepo.id, prov.id)}
                    aria-label={prov.downloaded ? `Remove ${prov.name}` : `Download ${prov.name}`}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                      prov.downloaded
                        ? 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {prov.downloaded ? <Trash2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom CloudStream Status Bar */}
          <div className="rounded-2xl liquid-glass p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                Downloaded: {totalDownloaded}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500 inline-block" />
                Not downloaded: {notDownloaded}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-black/50 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${totalProviders ? (totalDownloaded / totalProviders) * 100 : 0}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* TAB 2: NUVIOPLUGIN.COM REPOS & PLUGINS */}
      {directoryTab === 'nuvio' && (
        <>
          {!selectedNuvioRepo ? (
            <div className="space-y-3">
              {combinedNuvioRepos.map(({ dir, installed }) => {
                const isInstalled = Boolean(installed);
                const isActive = Boolean(installed?.enabled);
                return (
                  <div
                    key={dir.id}
                    onClick={() => setSelectedNuvioRepoId(dir.id)}
                    className="p-4 rounded-2xl liquid-glass hover:bg-white/[0.08] border border-white/[0.10] flex items-center justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-300 font-bold text-sm">
                        {dir.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {dir.name}
                          </h2>
                          {renderProviderStatusPill(
                            providerHealthMap[`nuvio:${normalizeStremioUrlKey(dir.manifestUrl)}`]
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] text-slate-300">
                            @{dir.author}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono-tabular">
                            {dir.plugins.length} plugins
                          </span>
                          {dir.languages.slice(0, 3).map((l) => (
                            <span
                              key={l}
                              className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-300 uppercase"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{dir.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleInstallOrToggleNuvioRepo(dir, e)}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isInstalled
                            ? 'bg-white/10 text-slate-300 border-white/15'
                            : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>{isActive ? 'Active' : isInstalled ? 'Paused' : 'Install'}</span>
                      </button>
                      {installed && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveNuvioRepo(installed.id, e)}
                          aria-label={`Remove ${dir.name}`}
                          className="h-9 w-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedNuvioRepo.plugins
                .filter(
                  (p) =>
                    !searchQuery.trim() ||
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((plug) => (
                  <div
                    key={plug.id}
                    className="p-4 rounded-2xl liquid-glass border border-white/[0.10] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-black/40 border border-white/[0.12] flex items-center justify-center shrink-0 overflow-hidden">
                        {plug.icon ? (
                          <img src={plug.icon} alt="" className="h-6 w-6 object-contain" />
                        ) : (
                          <Globe className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">{plug.name}</h3>
                          {plug.languages.slice(0, 4).map((l) => (
                            <span
                              key={l}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] uppercase font-medium"
                            >
                              {l}
                            </span>
                          ))}
                          {plug.types.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[9px] uppercase"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{plug.description}</p>
                      </div>
                    </div>
                    {(() => {
                      const scraperIdKey = plug.id.replace(/-\d+$/, '');
                      const scraperState = nuvioPluginHealth[plug.id] || nuvioPluginHealth[scraperIdKey];
                      if (scraperState === 'ok') {
                        return (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold shrink-0">
                            Working
                          </span>
                        );
                      }
                      if (scraperState === 'error') {
                        return (
                          <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-semibold shrink-0">
                            Offline
                          </span>
                        );
                      }
                      return (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-semibold shrink-0">
                          Nuvio Live
                        </span>
                      );
                    })()}
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: STREMIO-ADDONS.NET DIRECTORY & INSTALLED CUSTOM ADD-ONS */}
      {directoryTab === 'stremio' && (
        <div className="space-y-5">
          {/* Installed Add-ons Section (Includes custom URLs & directory add-ons) */}
          {filteredInstalledStremio.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Installed Stremio Add-ons ({filteredInstalledStremio.filter((a) => a.enabled).length}/{filteredInstalledStremio.length} Active)
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredInstalledStremio.map((addon, idx) => (
                  <div
                    key={`inst-${addon.id}-${idx}`}
                    className="p-4 rounded-2xl liquid-glass border border-purple-500/25 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-black/40 border border-purple-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                        {addon.logo ? (
                          <img
                            src={addon.logo}
                            alt=""
                            className="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Boxes className="h-5 w-5 text-purple-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">{addon.name}</h3>
                          {renderProviderStatusPill(
                            providerHealthMap[`stremio:${normalizeStremioUrlKey(addon.manifestUrl)}`]
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 text-[9px] font-mono">
                            v{addon.version || '1.0.0'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {addon.description || addon.manifestUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleStremioAddon(addon.id, !addon.enabled)}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1 border transition-colors ${
                          addon.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                            : 'bg-white/5 text-slate-400 border-white/15'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{addon.enabled ? 'Active' : 'Paused'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStremioAddon(addon.id)}
                        aria-label={`Remove ${addon.name}`}
                        className="h-9 w-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Bar for Directory */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Browse stremio-addons.net Directory
            </h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(
                [
                  'All',
                  'Streams',
                  'Hindi & Regional',
                  'Anime',
                  'Live TV & Sports',
                  'Subtitles',
                  'Catalogs',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setStremioCategory(cat)}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    stremioCategory === cat
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-black/30 hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredStremioCatalog.map((item) => {
                const installed = installedByManifest.get(normalizeStremioUrlKey(item.manifestUrl));
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl liquid-glass border border-white/[0.10] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-black/40 border border-white/[0.12] flex items-center justify-center shrink-0 overflow-hidden">
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt=""
                            className="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Boxes className="h-5 w-5 text-purple-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
                          {renderProviderStatusPill(
                            providerHealthMap[`stremio:${normalizeStremioUrlKey(item.manifestUrl)}`]
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[9px] font-medium">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {installed ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleStremioAddon(installed.id, !installed.enabled)}
                            className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1 border transition-colors ${
                              installed.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                                : 'bg-white/5 text-slate-400 border-white/15'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{installed.enabled ? 'Active' : 'Paused'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStremioAddon(installed.id)}
                            aria-label={`Remove ${item.name}`}
                            className="h-9 w-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={installingAddonSlug === item.slug}
                          onClick={() => void handleInstallStremioFromDir(item)}
                          className="min-h-[36px] px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{installingAddonSlug === item.slug ? 'Adding...' : 'Install'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Repository / Addon Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg rounded-2xl liquid-glass p-6 space-y-5 border border-white/20 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Add Repository or Add-on</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paste any CloudStream repo link/shortcode, <span className="text-emerald-400 font-mono">nuvioplugin.com</span> repo, or <span className="text-purple-400 font-mono">stremio-addons.net</span> manifest URL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddRepoSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Repository URL, Manifest URL, or Shortcode
                  </label>
                  <input
                    type="text"
                    value={repoInputUrl}
                    onChange={(e) => setRepoInputUrl(e.target.value)}
                    placeholder="https://nuvioplugin.com/ or https://stremio-addons.net/ or 864..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/40 border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] font-mono-tabular"
                  />
                </div>

                {/* Quick Shortcodes & Website Directory Installs */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Directory &amp; Shortcode Presets
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { code: 'https://nuvioplugin.com/', name: 'NuvioPlugin (11 Repos)' },
                      { code: 'https://stremio-addons.net/', name: 'Stremio Add-ons' },
                      { code: 'yoru', name: 'Yoru Nuvio' },
                      { code: '864', name: 'Phisher CS (89)' },
                      { code: 'csx', name: 'Megix CS (8)' },
                      { code: 'all', name: 'All CloudStream (500+)' },
                    ].map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setRepoInputUrl(item.code)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-600/30 border border-white/10 text-[11px] text-slate-300 hover:text-white transition-colors"
                      >
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {addError && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2">
                    <p className="text-xs text-red-300">{addError}</p>
                    <button
                      type="button"
                      onClick={() => void handleAddRepoSubmit()}
                      className="px-3 py-1 rounded-lg bg-red-500/25 hover:bg-red-500/40 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                    >
                      Continue
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="min-h-[40px] px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingRepo}
                    className="min-h-[40px] px-5 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
                  >
                    {isAddingRepo && (
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>Install Repository</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
