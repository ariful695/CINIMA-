import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Globe,
  Heart,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Tv,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getIptvRegions } from '../services/iptvOrgService';
import { iptvParser } from '../services/iptvParser';
import { useAppState } from '../state/AppContext';
import { LiveChannel } from '../types/media';
import { SportsEventsScreen } from './SportsEventsScreen';

const PAGE_SIZE = 36;

const ChannelLogo: React.FC<{ channel: LiveChannel }> = ({ channel }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [channel.logo]);

  if (!channel.logo || imgFailed) {
    const initials = channel.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    return (
      <div className="flex flex-col items-center justify-center gap-1.5 text-center px-2">
        <div className="h-9 w-9 rounded-lg bg-[#161B26] border border-white/10 flex items-center justify-center text-xs font-display font-bold text-slate-200">
          {initials || <Tv className="h-4 w-4 text-slate-400" />}
        </div>
        <span className="text-[11px] font-mono-tabular text-slate-500 truncate max-w-[14ch]">
          {channel.group}
        </span>
      </div>
    );
  }

  return (
    <img
      src={channel.logo}
      alt={`${channel.name} logo`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setImgFailed(true)}
      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
    />
  );
};

export const LiveTvScreen: React.FC = () => {
  const {
    liveChannels,
    liveErrors,
    liveLoading,
    refreshLiveChannels,
    startPlayback,
    openLibrarySection,
    favoriteChannelIds,
    toggleFavoriteChannel,
    iptvRegion,
    setIptvRegion,
    channelHealthMap,
    mergeChannelHealth,
  } = useAppState();

  const [liveSection, setLiveSection] = useState<'events' | 'channels'>('events');
  const [sportsLoading, setSportsLoading] = useState(false);
  const [sportsRefreshTick, setSportsRefreshTick] = useState(0);

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [channelFilter, setChannelFilter] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [httpsOnly, setHttpsOnly] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [probing, setProbing] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [showAllErrors, setShowAllErrors] = useState(false);

  const healthMapRef = useRef(channelHealthMap);
  healthMapRef.current = channelHealthMap;

  const regions = useMemo(() => getIptvRegions(), []);

  // Reset pagination when region or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedGroup, channelFilter, favoritesOnly, httpsOnly, verifiedOnly, iptvRegion]);

  useEffect(() => {
    setSelectedGroup('All');
  }, [iptvRegion]);

  const protocolFiltered = useMemo(() => {
    if (!httpsOnly) return liveChannels;
    return liveChannels.filter(
      (ch) => ch.streamUrl.startsWith('https://') || ch.streamUrl.startsWith('/api/')
    );
  }, [liveChannels, httpsOnly]);

  // Dynamically extract M3U group-title categories sorted by channel count
  const dynamicCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of protocolFiltered) {
      const grp = ch.group || 'General';
      counts.set(grp, (counts.get(grp) || 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    return ['All', ...sorted];
  }, [protocolFiltered]);

  const baseMatchingChannels = useMemo(() => {
    const q = channelFilter.trim().toLowerCase();
    return protocolFiltered.filter((ch) => {
      if (favoritesOnly && !favoriteChannelIds.includes(ch.id)) return false;
      const matchesGroup =
        selectedGroup === 'All' ||
        ch.group.toLowerCase() === selectedGroup.toLowerCase();
      const matchesQuery =
        !q ||
        ch.name.toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q) ||
        ch.playlistName.toLowerCase().includes(q);
      return matchesGroup && matchesQuery;
    });
  }, [protocolFiltered, selectedGroup, channelFilter, favoritesOnly, favoriteChannelIds]);

  const filteredChannels = useMemo(() => {
    if (!verifiedOnly) return baseMatchingChannels;
    return baseMatchingChannels.filter((ch) => channelHealthMap[ch.id] === true);
  }, [baseMatchingChannels, verifiedOnly, channelHealthMap]);

  const handleScanPlayable = async (limit = 36) => {
    const candidates = baseMatchingChannels
      .filter((ch) => healthMapRef.current[ch.id] === undefined)
      .slice(0, limit);
    if (candidates.length === 0) return;

    setProbing(true);
    await iptvParser.probeChannelsBatch(candidates, (batchResult) => {
      mergeChannelHealth(batchResult);
    });
    setProbing(false);
  };

  const pagedChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );

  const errorEntries = Object.entries(liveErrors);

  const handlePlayChannel = (channel: LiveChannel) => {
    startPlayback({
      mediaId: 0,
      mediaType: 'live',
      title: channel.name,
      subtitle: `${channel.group} · ${channel.playlistName}`,
      liveChannel: channel,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Live TV
          </h1>
          {liveSection === 'channels' && (
            <span className="text-xs font-mono-tabular text-slate-400">
              {filteredChannels.length.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-label={favoritesOnly ? 'Show all channels' : 'Show favorite channels'}
            aria-pressed={favoritesOnly}
            className={`h-11 w-11 rounded-full border flex items-center justify-center active:scale-90 transition-all ${
              favoritesOnly
                ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-[#E50914]/30'
                : 'bg-white/[0.06] border-white/15 text-slate-200 hover:bg-white/[0.12] hover:border-white/25'
            }`}
          >
            <Heart className={`h-4 w-4 ${favoritesOnly ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Toggle channel search"
            aria-pressed={searchOpen}
            className={`h-11 w-11 rounded-full border flex items-center justify-center active:scale-90 transition-all ${
              searchOpen
                ? 'bg-white/25 text-white border-white/40'
                : 'bg-white/[0.06] border-white/15 text-slate-200 hover:bg-white/[0.12] hover:border-white/25'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (liveSection === 'events') {
                setSportsRefreshTick((t) => t + 1);
              } else {
                void refreshLiveChannels(true);
              }
            }}
            disabled={liveSection === 'events' ? sportsLoading : liveLoading}
            aria-label={liveSection === 'events' ? 'Refresh live events' : 'Refresh playlists'}
            className="h-11 w-11 rounded-full bg-white/[0.06] border border-white/15 text-slate-200 hover:bg-white/[0.12] hover:border-white/25 flex items-center justify-center active:scale-90 transition-all"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                (liveSection === 'events' ? sportsLoading : liveLoading) ? 'animate-spin' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => openLibrarySection('settings')}
            aria-label="Manage playlists"
            className="hidden sm:inline-flex min-h-[44px] px-4 rounded-full bg-white/[0.06] border border-white/15 text-xs font-medium text-slate-200 hover:bg-white/[0.12] hover:border-white/25 items-center gap-2 active:scale-95 transition-all whitespace-nowrap"
          >
            <Settings className="h-4 w-4 text-[#3B82F6]" />
            <span>Sources</span>
          </button>
        </div>
      </div>

      {/* Live TV Sub-Section Switcher (Live Events vs TV Channels) */}
      <div className="inline-flex p-1 rounded-2xl bg-[#0E1422] border border-white/12 gap-1">
        <button
          type="button"
          onClick={() => setLiveSection('events')}
          className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            liveSection === 'events'
              ? 'bg-gradient-to-r from-[#3B82F6]/30 to-cyan-500/25 border border-sky-400/60 text-white shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Radio className={`h-4 w-4 ${liveSection === 'events' ? 'text-rose-400' : 'text-slate-400'}`} />
          <span>Live Events</span>
        </button>
        <button
          type="button"
          onClick={() => setLiveSection('channels')}
          className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            liveSection === 'channels'
              ? 'bg-white/[0.14] border border-white/25 text-white shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Tv className={`h-4 w-4 ${liveSection === 'channels' ? 'text-sky-400' : 'text-slate-400'}`} />
          <span>TV Channels</span>
        </button>
      </div>

      {/* Expandable Liquid Search Input (shared between Live Events and TV Channels) */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative"
          >
            <Search className="h-4 w-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="search"
              autoFocus
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              placeholder={
                liveSection === 'events'
                  ? 'Search match, team, series, or broadcast channel...'
                  : 'Search channels...'
              }
              aria-label="Search live TV"
              className="w-full min-h-[46px] pl-11 pr-11 rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
            {channelFilter && (
              <button
                type="button"
                onClick={() => setChannelFilter('')}
                aria-label="Clear search"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {liveSection === 'events' ? (
        <SportsEventsScreen
          favoritesOnly={favoritesOnly}
          searchQuery={channelFilter}
          refreshTick={sportsRefreshTick}
          onLoadingChange={setSportsLoading}
        />
      ) : (
        <>
          {/* iptv-org Region Selector & Stream Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] sm:max-w-xs">
              <Globe className="pointer-events-none h-4 w-4 text-[#3B82F6] absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
          <select
            aria-label="Select iptv-org region or country feed"
            value={iptvRegion}
            onChange={(e) => setIptvRegion(e.target.value)}
            className="w-full appearance-none min-h-[42px] pl-10 pr-9 rounded-xl bg-white/[0.06] border border-white/15 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] cursor-pointer"
          >
            {regions.map((reg) => (
              <option key={reg.code} value={reg.code} className="bg-[#0B0D12] text-white">
                {reg.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleScanPlayable(36)}
            disabled={probing}
            className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/15 text-xs font-medium text-slate-100 inline-flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className={`h-3.5 w-3.5 text-emerald-400 ${probing ? 'animate-spin' : ''}`} />
            <span>{probing ? 'Scanning...' : 'Check Streams'}</span>
          </button>

          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-xl border text-xs font-medium active:scale-95 transition-all whitespace-nowrap shrink-0 ${
              verifiedOnly
                ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                : 'bg-white/[0.06] border-white/15 text-slate-200 hover:bg-white/[0.1]'
            }`}
          >
            {verifiedOnly ? 'Playable Only' : 'All Streams'}
          </button>

          <button
            type="button"
            onClick={() => setHttpsOnly((v) => !v)}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-xl border text-xs font-medium active:scale-95 transition-all whitespace-nowrap shrink-0 ${
              httpsOnly
                ? 'bg-[#3B82F6]/20 border-[#3B82F6]/50 text-white'
                : 'bg-white/[0.06] border-white/15 text-slate-300 hover:text-white'
            }`}
          >
            {httpsOnly ? 'HTTPS' : 'All'}
          </button>
        </div>
      </div>

          {/* Placeholder removed because shared search input lives above */}

      {/* Horizontal M3U Category Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {dynamicCategories.map((cat) => {
          const active = selectedGroup === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedGroup(cat)}
              className={`relative min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'text-white font-semibold'
                  : 'bg-white/[0.05] text-slate-300 border border-white/[0.1] hover:text-white hover:bg-white/[0.09]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="live-cat-liquid"
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/30"
                />
              )}
              <span className="relative z-10">{cat}</span>
            </button>
          );
        })}
      </div>

      {errorEntries.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-200 truncate font-medium">
                {errorEntries[0]?.[1] || 'Could not load playlist.'}
              </p>
            </div>
            {errorEntries.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllErrors((v) => !v)}
                className="text-[11px] font-semibold text-amber-300 hover:text-amber-100 bg-amber-500/20 px-2.5 py-1 rounded-lg shrink-0 transition-colors"
              >
                {showAllErrors ? 'Hide details' : `+${errorEntries.length - 1} more errors`}
              </button>
            )}
          </div>
          {showAllErrors && errorEntries.length > 1 && (
            <div className="pt-2 border-t border-amber-400/20 space-y-1">
              {errorEntries.slice(1).map(([source, err]) => (
                <p key={source} className="text-[11px] text-amber-300/90 pl-6 truncate">
                  <span className="font-semibold text-amber-200">{source}:</span> {err}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Channel Logo Grid (2 cols mobile -> 5 cols desktop) */}
      {liveLoading && liveChannels.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl liquid-glass p-3 space-y-3"
            >
              <div className="aspect-[16/10] rounded-xl bg-white/[0.06] liquid-skeleton" />
              <div className="h-4 w-3/4 mx-auto rounded-md bg-white/[0.06] liquid-skeleton" />
            </div>
          ))}
        </div>
      ) : pagedChannels.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {pagedChannels.map((channel) => {
              const isFav = favoriteChannelIds.includes(channel.id);
              const health = channelHealthMap[channel.id];
              return (
                <div
                  key={channel.id}
                  onClick={() => handlePlayChannel(channel)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlayChannel(channel);
                    }
                  }}
                  className="group perf-card relative rounded-2xl liquid-glass hover:bg-white/[0.09] hover:border-white/25 hover:-translate-y-1 active:scale-[0.97] p-2.5 sm:p-3 cursor-pointer transition-all duration-150 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                >
                  {/* Favorite toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteChannel(channel.id);
                    }}
                    aria-label={isFav ? `Unfavorite ${channel.name}` : `Favorite ${channel.name}`}
                    className={`absolute top-4 right-4 z-10 h-8 w-8 rounded-full flex items-center justify-center transition-opacity ${
                      isFav
                        ? 'bg-[#E50914] text-white opacity-100'
                        : 'bg-black/65 border border-white/15 text-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {/* Inner Framed Channel Logo Stage */}
                  <div className="aspect-[16/10] w-full rounded-xl bg-black/35 border border-white/[0.08] overflow-hidden flex flex-col items-center justify-center p-3">
                    <ChannelLogo channel={channel} />
                  </div>

                  {/* Centered Channel Name */}
                  <div className="pt-2.5 pb-1 px-1 text-center">
                    <h3 className="text-xs sm:text-sm font-semibold text-white truncate flex items-center justify-center gap-1.5">
                      {health === true && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <span className="truncate">{channel.name}</span>
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Load More */}
          {pagedChannels.length < filteredChannels.length && (
            <div className="pt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="min-h-[44px] px-6 py-2.5 rounded-xl liquid-glass hover:border-white/30 text-sm font-medium text-white active:scale-95 transition-all"
              >
                Load More ({filteredChannels.length - pagedChannels.length})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl liquid-glass p-10 text-center space-y-4">
          <Tv className="h-9 w-9 text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-300">
            {favoritesOnly
              ? 'No favorite channels yet.'
              : verifiedOnly
              ? 'No verified channels in this filter.'
              : 'No channels found.'}
          </p>
          {verifiedOnly && baseMatchingChannels.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleScanPlayable(48)}
                disabled={probing}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#f41824] text-white text-xs font-semibold transition-colors"
              >
                {probing ? 'Scanning...' : 'Scan Channels'}
              </button>
              <button
                type="button"
                onClick={() => setVerifiedOnly(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition-colors"
              >
                Show All
              </button>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
