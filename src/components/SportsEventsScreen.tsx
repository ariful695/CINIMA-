import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Globe,
  Heart,
  KeyRound,
  Radio,
  RefreshCw,
  Sparkles,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cricbuzzService } from '../services/cricbuzzService';
import { useAppState } from '../state/AppContext';
import {
  SportCategory,
  SportsBroadcastChannel,
  SportsEvent,
  SportsEventStatus,
  SportsTeam,
} from '../types/media';
import { StreamSelectorModal } from './StreamSelectorModal';

const MATCH_TYPE_TABS: Array<{
  id: SportCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Cricket', icon: Trophy },
  { id: 'International', label: 'International', icon: Globe },
  { id: 'League', label: 'Leagues', icon: Sparkles },
  { id: 'Domestic', label: 'Domestic', icon: ClipboardList },
  { id: 'Women', label: 'Women', icon: Users },
];

function formatStartDateTime(ms: number): { timeText: string; dateText: string } {
  const d = new Date(ms);
  const timeText = d
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return { timeText, dateText: `${dd}/${mm}/${yyyy}` };
}

function formatElapsed(startMs: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}

function formatStartsIn(startMs: number, nowMs: number): string | null {
  const diffSec = Math.floor((startMs - nowMs) / 1000);
  if (diffSec <= 0) return 'Starting soon';
  const days = Math.floor(diffSec / 86400);
  const hrs = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `Starts in ${days}d ${hrs}h`;
  if (hrs > 0) return `Starts in ${hrs}h ${mins}m`;
  return `Starts in ${Math.max(1, mins)}m`;
}

const TeamCrest: React.FC<{ team: SportsTeam }> = ({ team }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (team.flagUrl && !imgFailed) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover border border-white/20 bg-slate-900 shrink-0 shadow-md"
      />
    );
  }

  return (
    <div
      className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-white/25 flex items-center justify-center shrink-0 shadow-md"
      style={{ backgroundColor: team.accentColor || '#1E293B' }}
    >
      <span className="font-display text-[11px] font-extrabold tracking-tight text-white uppercase px-1 text-center leading-none">
        {team.shortName.slice(0, 4)}
      </span>
    </div>
  );
};

interface SportsEventsScreenProps {
  favoritesOnly?: boolean;
  searchQuery?: string;
  refreshTick?: number;
  onLoadingChange?: (loading: boolean) => void;
}

export const SportsEventsScreen: React.FC<SportsEventsScreenProps> = ({
  favoritesOnly = false,
  searchQuery = '',
  refreshTick = 0,
  onLoadingChange,
}) => {
  const { liveChannels, startPlayback, favoriteChannelIds, toggleFavoriteChannel } =
    useAppState();

  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [rapidApiInput, setRapidApiInput] = useState('');
  const [hasKeyOverride, setHasKeyOverride] = useState(() => cricbuzzService.hasApiKeyOverride());

  const [selectedCategory, setSelectedCategory] = useState<SportCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SportsEventStatus>('all');
  const [selectedEventForModal, setSelectedEventForModal] = useState<SportsEvent | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadEvents = useCallback(
    async (force = false, silent = false) => {
      if (!silent) {
        setLoading(true);
        onLoadingChange?.(true);
      }
      const res = await cricbuzzService.fetchSportsEvents(liveChannels, force);
      setEvents(res.events);
      setErrorMsg(res.error || null);
      setApiConfigured(res.apiConfigured);
      setUsingFallback(res.usingFallback);
      setAuthError(Boolean(res.authError));
      setHasKeyOverride(cricbuzzService.hasApiKeyOverride());
      if (!silent) {
        setLoading(false);
        onLoadingChange?.(false);
      }
    },
    [liveChannels, onLoadingChange]
  );

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = rapidApiInput.trim();
    if (!clean) return;
    cricbuzzService.saveApiKeyOverride(clean);
    setRapidApiInput('');
    setShowKeySetup(false);
    setHasKeyOverride(true);
    void loadEvents(true, false);
  };

  const handleResetApiKey = () => {
    cricbuzzService.clearApiKeyOverride();
    setRapidApiInput('');
    setHasKeyOverride(false);
    void loadEvents(true, false);
  };

  useEffect(() => {
    void loadEvents(refreshTick > 0, false);
  }, [loadEvents, refreshTick]);

  // Silent 30s Cricbuzz polling to keep ongoing match scores fresh
  useEffect(() => {
    const pollId = window.setInterval(() => {
      void loadEvents(true, true);
    }, 30_000);
    return () => window.clearInterval(pollId);
  }, [loadEvents]);

  // Lightweight 1s ticker only when live matches exist
  const hasLiveMatches = useMemo(() => events.some((e) => e.status === 'live'), [events]);
  useEffect(() => {
    if (!hasLiveMatches) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasLiveMatches]);

  // Ongoing Cricbuzz matches (with live scores) for the top auto-scrolling ticker bar
  const tickerEvents = useMemo(() => {
    const ongoing = events.filter((ev) => ev.status === 'live');
    if (ongoing.length > 0) return ongoing;
    return events.filter((ev) => ev.team1.score || ev.team2.score).slice(0, 6);
  }, [events]);

  const tickerDurationSec = useMemo(
    () => Math.max(22, tickerEvents.length * 9),
    [tickerEvents.length]
  );

  const categoryFilteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (selectedCategory !== 'all' && ev.matchType !== selectedCategory) return false;
      if (favoritesOnly && !favoriteChannelIds.includes(ev.id)) return false;
      if (q) {
        const haystack =
          `${ev.leagueName} ${ev.matchDesc} ${ev.matchType} ${ev.team1.name} ${ev.team2.name} ${ev.channels
            .map((c) => c.name)
            .join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, selectedCategory, favoritesOnly, favoriteChannelIds, searchQuery]);

  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let recent = 0;
    for (const ev of categoryFilteredEvents) {
      if (ev.status === 'live') live += 1;
      else if (ev.status === 'upcoming') upcoming += 1;
      else recent += 1;
    }
    return {
      all: categoryFilteredEvents.length,
      live,
      upcoming,
      recent,
    };
  }, [categoryFilteredEvents]);

  const displayedEvents = useMemo(() => {
    if (statusFilter === 'all') return categoryFilteredEvents;
    return categoryFilteredEvents.filter((ev) => ev.status === statusFilter);
  }, [categoryFilteredEvents, statusFilter]);

  const handleSelectChannel = useCallback(
    (channel: SportsBroadcastChannel) => {
      if (!selectedEventForModal) return;
      const ev = selectedEventForModal;
      setSelectedEventForModal(null);

      const fallbackFeeds = ev.channels
        .filter((c) => c.id !== channel.id && Boolean(c.streamUrl))
        .sort((a, b) => Number(Boolean(b.isVerifiedPlayable)) - Number(Boolean(a.isVerifiedPlayable)))
        .map((c) => ({
          id: `${ev.id}-${c.id}`,
          name: c.name,
          group: 'Sports',
          logo: c.logo,
          streamUrl: c.streamUrl,
          playlistId: 'sports-events',
          playlistName: c.playlistName || ev.leagueName,
          isLive: true,
          country: c.country,
        }));

      startPlayback({
        mediaId:
          ev.matchId ||
          Math.abs(ev.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)),
        mediaType: 'live',
        title: `${channel.name} · ${ev.team1.shortName} vs ${ev.team2.shortName}`,
        subtitle: `${ev.leagueName}${ev.matchDesc ? ` · ${ev.matchDesc}` : ''}`,
        liveChannel: {
          id: `${ev.id}-${channel.id}`,
          name: channel.name,
          group: 'Sports',
          logo: channel.logo,
          streamUrl: channel.streamUrl,
          playlistId: 'sports-events',
          playlistName: channel.playlistName || ev.leagueName,
          isLive: true,
          country: channel.country,
        },
        fallbackFeeds,
      });
    },
    [selectedEventForModal, startPlayback]
  );

  return (
    <div className="space-y-4">
      {/* Slim Auto-Scrolling Real-Time Cricbuzz Score Ticker */}
      {tickerEvents.length > 0 && (
        <div
          className="sports-ticker-container h-[38px] rounded-xl liquid-glass flex items-center overflow-hidden"
          aria-label="Live cricket score updates"
        >
          <div className="h-full px-3 bg-white/[0.04] border-r border-white/[0.08] flex items-center gap-1.5 shrink-0">
            <span
              className={`h-2 w-2 rounded-full ${
                hasLiveMatches ? 'bg-[#E50914] animate-pulse' : 'bg-[#3B82F6]'
              }`}
            />
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-200 whitespace-nowrap">
              {hasLiveMatches ? 'Live Scores' : 'Scores'}
            </span>
          </div>

          <div
            className="flex-1 overflow-hidden"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
            }}
          >
            <div
              className="sports-ticker-track"
              style={{ '--ticker-duration': `${tickerDurationSec}s` } as React.CSSProperties}
            >
              {[0, 1].map((dupIdx) => (
                <div key={dupIdx} className="flex items-center shrink-0">
                  {tickerEvents.map((ev) => {
                    const isLiveEv = ev.status === 'live';
                    return (
                      <button
                        key={`${dupIdx}-${ev.id}`}
                        type="button"
                        onClick={() => setSelectedEventForModal(ev)}
                        className="inline-flex items-center gap-2 px-4 py-1 text-xs hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            isLiveEv ? 'bg-[#E50914]' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="font-semibold text-white">
                          {ev.team1.shortName}
                          {ev.team1.score ? (
                            <span className="font-mono text-sky-300 ml-1">{ev.team1.score}</span>
                          ) : null}
                        </span>
                        <span className="text-slate-500 font-semibold">vs</span>
                        <span className="font-semibold text-white">
                          {ev.team2.shortName}
                          {ev.team2.score ? (
                            <span className="font-mono text-sky-300 ml-1">{ev.team2.score}</span>
                          ) : null}
                        </span>
                        {ev.statusSummary && (
                          <span className="text-slate-400">· {ev.statusSummary}</span>
                        )}
                        <span className="text-white/15 pl-2">|</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real Cricbuzz MatchType Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {MATCH_TYPE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`min-h-[42px] px-4 rounded-full border flex items-center gap-2 shrink-0 text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                active
                  ? 'bg-white/[0.16] border-white/30 text-white font-semibold'
                  : 'bg-white/[0.05] border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.09]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#3B82F6]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status Filter Pills (All / Live / Upcoming / Recent) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`min-h-[38px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
            statusFilter === 'all'
              ? 'bg-white/[0.14] border-white/35 text-white'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          All ({counts.all})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('live')}
          className={`min-h-[38px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
            statusFilter === 'live'
              ? 'bg-[#E50914]/20 border-[#E50914]/60 text-rose-200'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <Radio className="h-4 w-4 text-[#E50914]" />
          Live ({counts.live})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('upcoming')}
          className={`min-h-[38px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
            statusFilter === 'upcoming'
              ? 'bg-[#3B82F6]/20 border-[#3B82F6]/60 text-sky-200'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <CalendarClock className="h-4 w-4 text-[#3B82F6]" />
          Upcoming ({counts.upcoming})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('recent')}
          className={`min-h-[38px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
            statusFilter === 'recent'
              ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          Recent ({counts.recent})
        </button>
      </div>

      {/* Cricbuzz API Setup / Cached & Public Schedule Banner */}
      {(errorMsg || !apiConfigured || usingFallback) && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 px-4 py-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-amber-100">
                  {!apiConfigured || authError
                    ? 'Cricbuzz RapidAPI Key Setup'
                    : 'Showing Cached / Public Cricket Schedule'}
                </p>
                <p className="text-amber-200/90 leading-relaxed">
                  {errorMsg ||
                    'Live RapidAPI scores are currently offline. Verified sports channels remain playable on every fixture card.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setShowKeySetup((v) => !v)}
                className="min-h-[44px] px-3.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/35 text-xs font-semibold text-amber-100 inline-flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{showKeySetup ? 'Close Key Setup' : 'Configure API Key'}</span>
              </button>
              <button
                type="button"
                onClick={() => void loadEvents(true, false)}
                className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>

          {showKeySetup && (
            <form
              onSubmit={handleSaveApiKey}
              className="pt-2 border-t border-amber-400/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <input
                type="password"
                value={rapidApiInput}
                onChange={(e) => setRapidApiInput(e.target.value)}
                placeholder="Paste your Cricbuzz RapidAPI x-rapidapi-key..."
                aria-label="Cricbuzz RapidAPI Key"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-black/45 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-300"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Save Key
                </button>
                {hasKeyOverride && (
                  <button
                    type="button"
                    onClick={handleResetApiKey}
                    className="min-h-[44px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    Use Default
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* Event Cards Feed */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-40 rounded-2xl liquid-glass p-4 space-y-3">
              <div className="h-4 w-2/3 rounded bg-white/[0.06] liquid-skeleton" />
              <div className="h-12 w-full rounded bg-white/[0.06] liquid-skeleton" />
              <div className="h-4 w-1/2 rounded bg-white/[0.06] liquid-skeleton" />
            </div>
          ))}
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="rounded-2xl liquid-glass py-14 px-6 text-center">
          <Tv className="h-9 w-9 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No matching cricket events</p>
          <p className="text-xs text-slate-400 mt-1">
            Switch the status filter or refresh to reload live Cricbuzz fixtures.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {displayedEvents.map((ev) => {
            const { timeText, dateText } = formatStartDateTime(ev.startTimeMs);
            const isFav = favoriteChannelIds.includes(ev.id);
            const isLive = ev.status === 'live';
            const isUpcoming = ev.status === 'upcoming';
            const startsIn = isUpcoming ? formatStartsIn(ev.startTimeMs, nowMs) : null;

            return (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEventForModal(ev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedEventForModal(ev);
                  }
                }}
                className="perf-card cursor-pointer rounded-2xl liquid-glass hover:bg-white/[0.08] hover:border-white/25 p-4 transition-all flex flex-col gap-3.5"
              >
                {/* Top Row: League/Series + Start Time / Live Timer */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] font-semibold text-sky-300 uppercase shrink-0">
                        {ev.formatLabel || ev.matchType}
                      </span>
                      <span className="truncate text-white font-semibold">{ev.leagueName}</span>
                    </div>
                    {ev.matchDesc && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {ev.matchDesc}
                        {ev.venue ? ` · ${ev.venue}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right text-xs font-medium whitespace-nowrap">
                    {isLive ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E50914]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#E50914] animate-pulse" />
                          LIVE
                        </span>
                        <span className="font-mono-tabular text-[11px] text-sky-300">
                          {formatElapsed(ev.startTimeMs, nowMs)}
                        </span>
                      </div>
                    ) : isUpcoming ? (
                      <div className="flex flex-col items-end">
                        <span className="text-slate-100">
                          {timeText} · <span className="text-sky-400">{dateText}</span>
                        </span>
                        {startsIn && (
                          <span className="text-[11px] text-emerald-300 font-semibold">
                            {startsIn}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-400 text-[11px] font-semibold">
                          Completed
                        </span>
                        <span className="text-[11px] text-slate-400">{dateText}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Row: Team 1 vs Team 2 */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TeamCrest team={ev.team1} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                        {ev.team1.name}
                      </p>
                      {ev.team1.score && (
                        <p className="font-mono-tabular text-xs text-sky-300 font-semibold mt-0.5">
                          {ev.team1.score}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center px-2">
                    <span className="font-display text-xs font-extrabold tracking-widest text-slate-400">
                      VS
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 min-w-0 text-right">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                        {ev.team2.name}
                      </p>
                      {ev.team2.score && (
                        <p className="font-mono-tabular text-xs text-sky-300 font-semibold mt-0.5">
                          {ev.team2.score}
                        </p>
                      )}
                    </div>
                    <TeamCrest team={ev.team2} />
                  </div>
                </div>

                {/* Bottom Strip: Real Verified Playable Channels + Status/Favorite */}
                <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <Tv className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {ev.channels.slice(0, 3).map((ch) => (
                        <span
                          key={ch.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.09] text-[10px] font-semibold text-slate-200 whitespace-nowrap"
                        >
                          {ch.isVerifiedPlayable && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          {ch.name}
                        </span>
                      ))}
                      {ev.channels.length > 3 && (
                        <span className="text-[11px] font-semibold text-sky-400 shrink-0">
                          +{ev.channels.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ev.statusSummary && (
                      <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[180px]">
                        {ev.statusSummary}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteChannel(ev.id);
                      }}
                      aria-label={isFav ? 'Remove from favorites' : 'Save event'}
                      className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          isFav ? 'fill-[#E50914] text-[#E50914]' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Channel Picker Modal */}
      <AnimatePresence>
        {selectedEventForModal && (
          <StreamSelectorModal
            event={selectedEventForModal}
            onSelectChannel={handleSelectChannel}
            onClose={() => setSelectedEventForModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
