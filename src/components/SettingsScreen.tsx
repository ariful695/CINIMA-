import React, { useState } from 'react';
import {
  Bookmark,
  Download,
  ExternalLink,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import {
  NUVIO_PLUGIN_REPOS,
  STREMIO_ADDONS_NET_DIRECTORY,
} from '../data/nuvioAndStremioCatalog';
import { storageService } from '../services/storageService';
import { normalizeStremioUrlKey, stremioAddonService } from '../services/stremioAddonService';
import { ProviderHealthEntry, useAppState } from '../state/AppContext';
import {
  M3UPlaylistSource,
  MediaItem,
  StremioAddonConfig,
  THEME_ACCENTS,
  ThemeColor,
} from '../types/media';
import { motion } from 'motion/react';
import { MediaCard } from './MediaCard';
import { TokenCreditStatusBadge } from './TokenCreditStatusBadge';

export const SettingsScreen: React.FC = () => {
  const {
    watchlist,
    startPlayback,
    m3uPlaylists,
    saveM3UPlaylists,
    refreshLiveChannels,
    clearWatchHistory,
    continueWatching,
    librarySubTab: subTab,
    setLibrarySubTab: setSubTab,
    openLibrarySection,
    themeColor,
    setThemeColor,
    stremioAddons,
    addStremioAddon,
    removeStremioAddon,
    toggleStremioAddon,
    installPopularStremioPack,
    nuvioRepos,
    installAllNuvioRepos,
    toggleNuvioRepo,
    removeNuvioRepo,
    cloudStreamRepos,
    installAllCloudStreamRepos,
    installByInput,
    isUpdatingAddons,
    updateAllAddonsAndRepos,
    providerHealthMap,
    isCheckingProviders,
    providerCheckError,
    providerHealthSummary,
    checkAllProvidersHealth,
  } = useAppState();

  // Add M3U playlist form
  const [newM3uName, setNewM3uName] = useState('');
  const [newM3uUrl, setNewM3uUrl] = useState('');
  const [newM3uRaw, setNewM3uRaw] = useState('');
  const [m3uMode, setM3uMode] = useState<'url' | 'raw'>('url');
  const [preferredQuality, setPreferredQuality] = useState(() =>
    storageService.getPreferredQuality()
  );
  const [p2pEnabled, setP2pEnabled] = useState(() => storageService.getP2PTorrentEnabled());
  const [p2pPrebuffer, setP2pPrebuffer] = useState(() => storageService.getP2PPrebufferSizeMb());

  // CloudStream / Nuvio / Stremio Repo install state
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [isInstallingRepo, setIsInstallingRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoSuccess, setRepoSuccess] = useState<string | null>(null);

  const [providerToggles, setProviderToggles] = useState(() =>
    storageService.getProviderToggles()
  );

  const toggleProvider = (key: string) => {
    const updated = { ...providerToggles, [key]: !(providerToggles[key] ?? true) };
    setProviderToggles(updated);
    storageService.setProviderToggles(updated);
  };

  const renderStatusBadge = (statusInfo?: ProviderHealthEntry) => {
    if (!statusInfo) return null;
    if (statusInfo.status === 'checking') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1 shrink-0 bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          Checking...
        </span>
      );
    }
    const isDegraded =
      statusInfo.status === 'degraded' ||
      (statusInfo.status === 'online' &&
        typeof statusInfo.latency === 'number' &&
        statusInfo.latency >= 600);
    if (statusInfo.status === 'online' || isDegraded) {
      return (
        <span
          title={statusInfo.detail || (isDegraded ? 'Degraded' : 'Healthy')}
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
          {typeof statusInfo.latency === 'number' && statusInfo.latency > 0
            ? ` (${statusInfo.latency}ms)`
            : ''}
        </span>
      );
    }
    return (
      <span
        title={statusInfo.detail || 'Endpoint unreachable'}
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border border-red-500/30"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Offline{statusInfo.detail ? ` · ${statusInfo.detail}` : ''}
      </span>
    );
  };

  const checkAllProviderStatuses = async () => {
    await checkAllProvidersHealth({ includeDirectory: false });
  };

  const handleInstallRepository = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawInput = newRepoUrl.trim();
    if (!rawInput) return;

    setIsInstallingRepo(true);
    setRepoError(null);
    setRepoSuccess(null);

    try {
      const res = await installByInput(rawInput);
      setRepoSuccess(res.message);
      setNewRepoUrl('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch manifest or repository URL.';
      setRepoError(msg);
    } finally {
      setIsInstallingRepo(false);
    }
  };

  const handleUpdateAllAddons = async () => {
    setRepoError(null);
    setRepoSuccess(null);
    try {
      const counts = await updateAllAddonsAndRepos();
      setRepoSuccess(
        `Updated live manifests: ${counts.nuvioCount} Nuvio repos, ${counts.stremioCount} Stremio add-ons & ${counts.cloudStreamCount} CloudStream repos.`
      );
    } catch (err: unknown) {
      setRepoError(err instanceof Error ? err.message : 'Update check encountered a network error.');
    }
  };

  const handleInstallAllNuvioRepos = () => {
    setIsInstallingRepo(true);
    setRepoError(null);
    const updated = installAllNuvioRepos();
    const pluginTotal = updated.reduce((sum, r) => sum + r.plugins.length, 0);
    setRepoSuccess(`Installed all ${updated.length} NuvioPlugin.com repos (${pluginTotal} plugins).`);
    setIsInstallingRepo(false);
  };

  const handleInstallStremioDirectoryPack = async () => {
    setIsInstallingRepo(true);
    setRepoError(null);
    try {
      const count = await installPopularStremioPack();
      setRepoSuccess(`Installed ${count} live stream add-ons from Stremio-Addons.net!`);
    } catch {
      setRepoError('Failed to install Stremio directory pack.');
    } finally {
      setIsInstallingRepo(false);
    }
  };

  const handleInstallAllCloudStream = async () => {
    setIsInstallingRepo(true);
    setRepoError(null);
    try {
      const all = await installAllCloudStreamRepos();
      const total = all.reduce((sum, r) => sum + r.totalCount, 0);
      setRepoSuccess(`Installed all ${all.length} CloudStream repos (${total} plugins)!`);
    } catch {
      setRepoError('Failed to install CloudStream repos.');
    } finally {
      setIsInstallingRepo(false);
    }
  };

  const handleQuickInstallPreset = async (url: string, name: string) => {
    setIsInstallingRepo(true);
    setRepoError(null);
    setRepoSuccess(null);
    try {
      const addon = await stremioAddonService.fetchManifest(url, name);
      addStremioAddon(addon);
      setRepoSuccess(`Successfully installed ${addon.name}!`);
    } catch (err: unknown) {
      setRepoError(
        err instanceof Error
          ? err.message
          : `Failed to fetch valid Stremio manifest for ${name}.`
      );
    } finally {
      setIsInstallingRepo(false);
    }
  };

  const handleAddM3u = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newM3uName.trim()) return;
    if (m3uMode === 'url' && !newM3uUrl.trim()) return;
    if (m3uMode === 'raw' && !newM3uRaw.trim()) return;

    const item: M3UPlaylistSource = {
      id: `m3u-${Date.now()}`,
      name: newM3uName.trim(),
      url: m3uMode === 'url' ? newM3uUrl.trim() : `inline://${Date.now()}.m3u`,
      rawContent: m3uMode === 'raw' ? newM3uRaw.trim() : undefined,
      enabled: true,
      lastSyncedAt: new Date().toISOString(),
    };

    saveM3UPlaylists([item, ...m3uPlaylists]);
    setNewM3uName('');
    setNewM3uUrl('');
    setNewM3uRaw('');
  };

  const toggleM3u = (id: string) => {
    saveM3UPlaylists(
      m3uPlaylists.map((pl) => (pl.id === id ? { ...pl, enabled: !pl.enabled } : pl))
    );
  };

  const removeM3u = (id: string) => {
    saveM3UPlaylists(m3uPlaylists.filter((pl) => pl.id !== id));
  };

  const handleQuickPlay = (item: MediaItem) => {
    startPlayback({
      mediaId: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      fallbackPoster: item.fallbackPoster,
      fallbackBackdrop: item.fallbackBackdrop,
      seasonNumber: item.mediaType === 'tv' ? 1 : undefined,
      episodeNumber: item.mediaType === 'tv' ? 1 : undefined,
    });
  };

  const totalNuvioPlugins = nuvioRepos.reduce((sum, r) => sum + r.plugins.length, 0);
  const totalCloudStreamDownloaded = cloudStreamRepos.reduce((sum, r) => sum + r.downloadedCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <TokenCreditStatusBadge />
      {/* Header & Sub-tab Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          My List &amp; Settings
        </h1>

        <div className="flex items-center gap-1.5 p-1 rounded-xl liquid-glass w-fit">
          <button
            type="button"
            onClick={() => setSubTab('mylist')}
            className={`relative min-h-[38px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'mylist'
                ? 'text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {subTab === 'mylist' && (
              <motion.span
                layoutId="settings-tab-liquid"
                transition={{ type: 'spring', stiffness: 330, damping: 24, mass: 0.85 }}
                className="absolute inset-0 rounded-lg bg-white/[0.18] backdrop-blur-xl border border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              />
            )}
            <span className="relative z-10">My List ({watchlist.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`relative min-h-[38px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'settings'
                ? 'text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {subTab === 'settings' && (
              <motion.span
                layoutId="settings-tab-liquid"
                transition={{ type: 'spring', stiffness: 330, damping: 24, mass: 0.85 }}
                className="absolute inset-0 rounded-lg bg-white/[0.18] backdrop-blur-xl border border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              />
            )}
            <span className="relative z-10">Settings</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: My List */}
      {subTab === 'mylist' && (
        <div className="space-y-8">
          {watchlist.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlist.map((item) => (
                <MediaCard
                  key={`watchlist-${item.mediaType}-${item.id}`}
                  item={item}
                  onQuickPlay={handleQuickPlay}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl liquid-glass p-10 text-center space-y-2.5">
              <Bookmark className="h-9 w-9 text-slate-400 mx-auto" />
              <p className="text-base font-semibold text-white">Your list is empty</p>
            </div>
          )}

          {continueWatching.length > 0 && (
            <div className="rounded-2xl liquid-glass p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Watch History
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {continueWatching.length} saved titles
                </p>
              </div>
              <button
                type="button"
                onClick={clearWatchHistory}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Clear Watch History
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: App Settings */}
      {subTab === 'settings' && (
        <div className="space-y-8">
          {/* Install Repository / CloudStream / Nuvio / Stremio Extension Manager */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-black/35 border border-white/[0.12] flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Install Repositories &amp; Extensions
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Paste URLs or shortcodes from CloudStream ({cloudStreamRepos.length} repos · {totalCloudStreamDownloaded} active), NuvioPlugin.com ({NUVIO_PLUGIN_REPOS.length} repos), or Stremio-Addons.net ({STREMIO_ADDONS_NET_DIRECTORY.length} add-ons).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleUpdateAllAddons()}
                  disabled={isUpdatingAddons}
                  className="min-h-[40px] px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/15 text-xs font-semibold text-slate-100 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isUpdatingAddons ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingAddons ? 'Updating...' : 'Update Add-ons'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openLibrarySection('extensions')}
                  className="min-h-[40px] px-4 rounded-xl bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 border border-[#3B82F6]/40 text-xs font-semibold text-blue-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Open Extensions Hub</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Active Nuvio Repositories Summary */}
            {nuvioRepos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  NuvioPlugin Repositories ({nuvioRepos.filter((r) => r.enabled).length}/{nuvioRepos.length} Active · {totalNuvioPlugins} plugins)
                </p>
                <div className="divide-y divide-white/[0.06] rounded-xl bg-black/35 border border-white/[0.10]">
                  {nuvioRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">{repo.name}</p>
                          {renderStatusBadge(
                            providerHealthMap[`nuvio:${normalizeStremioUrlKey(repo.manifestUrl)}`]
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-[10px] text-blue-300 font-mono">
                            {repo.plugins.length} plugins
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          by {repo.author} &bull; {repo.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleNuvioRepo(repo.id, !repo.enabled)}
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors ${
                            repo.enabled
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}
                        >
                          {repo.enabled ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNuvioRepo(repo.id)}
                          aria-label={`Remove ${repo.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Installed Stremio Addons List */}
            {stremioAddons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Stremio Add-ons ({stremioAddons.filter((a) => a.enabled).length}/{stremioAddons.length} Active)
                </p>
                <div className="divide-y divide-white/[0.06] rounded-xl bg-black/35 border border-white/[0.10]">
                  {stremioAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">{addon.name}</p>
                          {renderStatusBadge(
                            providerHealthMap[`stremio:${normalizeStremioUrlKey(addon.manifestUrl)}`]
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] text-slate-300 font-mono">
                            v{addon.version || '1.0'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {addon.description || addon.manifestUrl}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleStremioAddon(addon.id, !addon.enabled)}
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors ${
                            addon.enabled
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}
                        >
                          {addon.enabled ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStremioAddon(addon.id)}
                          aria-label={`Remove ${addon.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Install form */}
            <form onSubmit={handleInstallRepository} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="nuvioplugin.com, stremio-addons.net/addons/..., cloudstreamrepo.com, or manifest.json"
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] font-mono-tabular"
                />
                <button
                  type="submit"
                  disabled={isInstallingRepo}
                  className="min-h-[44px] px-5 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  {isInstallingRepo ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Install Repository</span>
                </button>
              </div>

              {repoError && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2">
                  <p className="text-xs text-red-300">{repoError}</p>
                  <button
                    type="button"
                    onClick={() => void handleInstallRepository()}
                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                  >
                    Continue
                  </button>
                </div>
              )}
              {repoSuccess && (
                <p className="text-xs text-emerald-400 px-1">{repoSuccess}</p>
              )}
            </form>

            {/* Quick Presets for NuvioPlugin / Stremio-Addons / CloudStream */}
            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                1-Click Directory Packs &amp; Popular Add-ons
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleInstallAllNuvioRepos}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">
                      NuvioPlugin.com Pack
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All {NUVIO_PLUGIN_REPOS.length} repos &bull; 162 plugins</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleInstallStremioDirectoryPack()}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">
                      Stremio-Addons.net Pack
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Live Torrentio, Peerflix &amp; Torz</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleInstallAllCloudStream()}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">
                      CloudStream 500+ Repos
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">27 repos &bull; 502 plugins</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickInstallPreset('https://peerflix.mov/manifest.json', 'Peerflix')}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">Peerflix Streams</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Multi-language movie &amp; TV streams</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickInstallPreset('https://torrentio.strem.fun/manifest.json', 'Torrentio')}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">Torrentio Streams</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">High speed P2P sources</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickInstallPreset('https://stremthru.13377001.xyz/stremio/torz/manifest.json', 'StremThru Torz')}
                  className="p-3 rounded-xl bg-black/30 hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#3B82F6]">StremThru Torz</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Live indexed movie &amp; series links</p>
                  </div>
                  <Zap className="h-4 w-4 text-slate-400 group-hover:text-[#3B82F6] shrink-0" />
                </button>
              </div>
            </div>
          </section>

          {/* API & Stream Providers Configuration */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-black/35 border border-white/[0.12] flex items-center justify-center shrink-0">
                  <Tv className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    API &amp; Stream Providers Manager
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Configure, toggle, and run health status checks on all stream scrapers and API endpoints.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void checkAllProviderStatuses()}
                disabled={isCheckingProviders}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 border border-emerald-500/35 text-xs font-semibold text-emerald-200 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isCheckingProviders ? 'animate-spin' : ''}`} />
                <span>{isCheckingProviders ? 'Checking Providers...' : 'Check All Providers'}</span>
              </button>
            </div>

            {(providerHealthSummary || providerCheckError) && (
              <div className="rounded-xl bg-black/35 border border-white/[0.10] px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
                {providerCheckError ? (
                  <>
                    <span className="text-red-300">{providerCheckError}</span>
                    <button
                      type="button"
                      onClick={() => void checkAllProviderStatuses()}
                      className="px-3 py-1 rounded-lg bg-red-500/25 hover:bg-red-500/40 text-white font-semibold"
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  providerHealthSummary && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-slate-300 font-medium">All Providers Summary:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                        {providerHealthSummary.online} Online
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        {providerHealthSummary.degraded} Degraded
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-semibold">
                        {providerHealthSummary.offline} Offline
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'torrentio', name: 'Torrentio P2P Scraper', desc: 'High speed torrent & seeders index' },
                { key: 'nuvio', name: 'Nuvio Direct Scraper', desc: 'HLS and MP4 web video scraper' },
                { key: 'meteor', name: 'Meteor P2P Add-on', desc: 'Movies, series & anime P2P index' },
                { key: 'torrentsdb', name: 'TorrentsDB Indexer', desc: 'Multi-quality torrent mirrors' },
                { key: 'hdhub', name: 'HdHub Multi-Audio', desc: 'Hindi, dual-audio & English streams' },
                { key: 'notorrent', name: 'NoTorrent Direct HTTP', desc: 'Direct HTTP streams for movies & series' },
                { key: 'peerflix', name: 'Peerflix Add-on', desc: 'Community multi-resolution streams' },
                { key: 'cloudstream', name: 'CloudStream Plugins', desc: 'Installed repo plugin resolver' },
                { key: 'cinemeta', name: 'Cinemeta Catalog', desc: 'Official metadata database' },
                { key: 'opensubtitles', name: 'OpenSubtitles v3', desc: 'Multi-language subtitle engine' },
              ].map((prov) => {
                const active = providerToggles[prov.key] ?? true;
                const statusInfo = providerHealthMap[`core:${prov.key}`];
                return (
                  <div
                    key={prov.key}
                    className="p-3.5 rounded-xl bg-black/35 border border-white/[0.10] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{prov.name}</p>
                        {renderStatusBadge(statusInfo)}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{prov.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleProvider(prov.key)}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        {active ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Theme Color Selection (PURPLE, RED, BLUE) */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-black/35 border border-white/[0.12] flex items-center justify-center shrink-0">
                <div
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: THEME_ACCENTS[themeColor].hex }}
                />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  App Theme Color
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Choose your preferred color accent for KinoStream.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['red', 'purple', 'blue'] as ThemeColor[]).map((col) => {
                const conf = THEME_ACCENTS[col];
                const active = themeColor === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setThemeColor(col)}
                    className={`relative min-h-[52px] px-4 py-3 rounded-xl border flex items-center justify-center gap-2.5 transition-all ${
                      active
                        ? 'bg-white/[0.12] border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                        : 'bg-black/30 border-white/[0.08] hover:bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: conf.hex }}
                    />
                    <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-300'}`}>
                      {col.toUpperCase()}
                    </span>
                    {active && (
                      <span
                        className="absolute inset-0 rounded-xl border-2 pointer-events-none"
                        style={{ borderColor: conf.hex }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* M3U Live TV Playlist Manager */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-black/35 border border-white/[0.12] flex items-center justify-center shrink-0">
                  <Tv className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Live TV Playlists
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Add .m3u playlist URLs or paste #EXTM3U blocks.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void refreshLiveChannels()}
                className="min-h-[40px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Channels</span>
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-xl bg-black/35 border border-white/[0.10]">
              {m3uPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                    <p className="text-xs font-mono-tabular text-slate-400 truncate mt-0.5">
                      {pl.rawContent ? 'Inline #EXTM3U Playlist' : pl.url}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleM3u(pl.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors ${
                        pl.enabled
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {pl.enabled ? 'Active' : 'Paused'}
                    </button>
                    {pl.url !== 'builtin://open-channels.m3u' && (
                      <button
                        type="button"
                        onClick={() => removeM3u(pl.id)}
                        aria-label={`Delete ${pl.name}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/35 border border-white/[0.10] w-fit">
                <button
                  type="button"
                  onClick={() => setM3uMode('url')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    m3uMode === 'url'
                      ? 'bg-[#161B26] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Playlist URL
                </button>
                <button
                  type="button"
                  onClick={() => setM3uMode('raw')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    m3uMode === 'raw'
                      ? 'bg-[#161B26] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Paste #EXTM3U Text
                </button>
              </div>

              <form onSubmit={handleAddM3u} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    type="text"
                    value={newM3uName}
                    onChange={(e) => setNewM3uName(e.target.value)}
                    placeholder="Playlist Name (e.g. Global News)"
                    className="sm:col-span-4 min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  />
                  {m3uMode === 'url' ? (
                    <input
                      type="url"
                      value={newM3uUrl}
                      onChange={(e) => setNewM3uUrl(e.target.value)}
                      placeholder="https://example.com/playlist.m3u"
                      className="sm:col-span-6 min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] font-mono-tabular"
                    />
                  ) : (
                    <div className="sm:col-span-6" />
                  )}
                  <button
                    type="submit"
                    className="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add M3U</span>
                  </button>
                </div>

                {m3uMode === 'raw' && (
                  <textarea
                    rows={4}
                    value={newM3uRaw}
                    onChange={(e) => setNewM3uRaw(e.target.value)}
                    placeholder={`#EXTM3U\n#EXTINF:-1 group-title="News",Channel Name\nhttps://example.com/live/stream.m3u8`}
                    className="w-full p-3.5 rounded-xl bg-black/35 border border-white/[0.12] text-xs font-mono-tabular text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  />
                )}
              </form>
            </div>
          </section>

          {/* Playback Preferences */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Preferred Quality
              </h2>
            </div>

            <select
              aria-label="Preferred Stream Quality"
              value={preferredQuality}
              onChange={(e) => {
                setPreferredQuality(e.target.value);
                storageService.setPreferredQuality(e.target.value);
              }}
              className="min-h-[42px] px-4 rounded-xl bg-black/35 border border-white/[0.12] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              <option value="Auto">Auto (Adaptive Bitrate)</option>
              <option value="1080p">1080p Full HD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p Data Saver</option>
            </select>
          </section>

          {/* P2P Torrent Streaming Preferences */}
          <section className="rounded-2xl liquid-glass p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  P2P Torrent Streaming (Torrentio & Peers)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Find seeders and peers, pre-buffer sequentially, stream via HTTP 206, and re-prioritize on seek.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={p2pEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setP2pEnabled(val);
                    storageService.setP2PTorrentEnabled(val);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
              </label>
            </div>

            {p2pEnabled && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
                <span className="text-xs text-slate-300 font-medium">
                  Pre-buffer Size Selector (5–30 MB)
                </span>
                <select
                  aria-label="P2P Prebuffer Size"
                  value={p2pPrebuffer}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setP2pPrebuffer(val);
                    storageService.setP2PPrebufferSizeMb(val);
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-black/35 border border-white/[0.12] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  <option value={5}>5 MB (Fast start)</option>
                  <option value={10}>10 MB (Recommended)</option>
                  <option value={15}>15 MB</option>
                  <option value={20}>20 MB</option>
                  <option value={25}>25 MB</option>
                  <option value={30}>30 MB (Ultra stable)</option>
                </select>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
