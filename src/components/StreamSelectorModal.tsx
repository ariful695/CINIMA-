import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Link2, Play, Plus, Radio, Search, Trash2, Tv, X } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getCustomSportsChannels,
  getPendingSportsChannelSlots,
  removeCustomSportsChannel,
  saveCustomSportsChannel,
} from '../services/cricbuzzService';
import { useAppState } from '../state/AppContext';
import { SportsBroadcastChannel, SportsEvent } from '../types/media';

interface StreamSelectorModalProps {
  event: SportsEvent;
  onSelectChannel: (channel: SportsBroadcastChannel) => void;
  onClose: () => void;
}

export const StreamSelectorModal: React.FC<StreamSelectorModalProps> = ({
  event,
  onSelectChannel,
  onClose,
}) => {
  const { liveChannels, channelHealthMap } = useAppState();
  const [channelQuery, setChannelQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [customSaved, setCustomSaved] = useState<SportsBroadcastChannel[]>(() =>
    getCustomSportsChannels()
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const baseRecommended = useMemo(() => {
    const seenUrls = new Set(customSaved.map((c) => c.streamUrl));
    return [
      ...customSaved,
      ...event.channels.filter((c) => !seenUrls.has(c.streamUrl)),
    ];
  }, [customSaved, event.channels]);

  const userMatchingChannels = useMemo<SportsBroadcastChannel[]>(() => {
    const q = channelQuery.trim().toLowerCase();
    if (!q) return [];
    const seenUrls = new Set(baseRecommended.map((c) => c.streamUrl));
    return liveChannels
      .filter((ch) => {
        if (!ch.streamUrl.startsWith('https://')) return false;
        if (seenUrls.has(ch.streamUrl)) return false;
        return (
          ch.name.toLowerCase().includes(q) ||
          ch.group.toLowerCase().includes(q) ||
          ch.playlistName.toLowerCase().includes(q)
        );
      })
      .slice(0, 12)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        streamUrl: ch.streamUrl,
        logo: ch.logo,
        country: ch.country,
        playlistName: ch.playlistName,
        isVerifiedPlayable: channelHealthMap[ch.id] === true,
      }));
  }, [channelQuery, liveChannels, baseRecommended, channelHealthMap]);

  const displayedChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    const filteredRecommended = q
      ? baseRecommended.filter((c) => c.name.toLowerCase().includes(q))
      : baseRecommended;
    return [...filteredRecommended, ...userMatchingChannels];
  }, [channelQuery, baseRecommended, userMatchingChannels]);

  const pendingSlots = useMemo(() => {
    const allSlots = getPendingSportsChannelSlots(customSaved);
    const q = channelQuery.trim().toLowerCase();
    if (!q) return allSlots;
    return allSlots.filter((slot) => slot.name.toLowerCase().includes(q));
  }, [customSaved, channelQuery]);

  const handleAddCustomStream = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = customUrl.trim();
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      setCustomError('Enter a valid http:// or https:// .m3u8 / .mp4 stream URL.');
      return;
    }
    setCustomError(null);
    const saved = saveCustomSportsChannel({
      name: customName.trim() || 'Custom Sports Channel',
      streamUrl: trimmedUrl,
    });
    setCustomSaved(getCustomSportsChannels());
    setCustomName('');
    setCustomUrl('');
    setShowCustomForm(false);
    onSelectChannel(saved);
  };

  const handleConfigureSlot = (slotName: string) => {
    setCustomName(slotName);
    setCustomError(null);
    setShowCustomForm(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stream-selector-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[470px] rounded-3xl liquid-glass-strong overflow-hidden flex flex-col max-h-[86vh]"
      >
        {/* Top KinoStream Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Radio
                className={`h-3.5 w-3.5 ${
                  event.status === 'live' ? 'text-[#E50914] animate-pulse' : ''
                }`}
              />
              <span className="truncate">{event.leagueName}</span>
            </div>
            <h2
              id="stream-selector-title"
              className="font-display text-lg font-bold text-white mt-1 truncate"
            >
              {event.team1.name} vs {event.team2.name}
            </h2>
            {event.statusSummary && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{event.statusSummary}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close channel picker"
            className="h-9 w-9 shrink-0 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + Custom Stream Toggle */}
        <div className="px-5 pt-3.5 pb-2 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={channelQuery}
                onChange={(e) => setChannelQuery(e.target.value)}
                placeholder="Search Star Sports, Sony Sports, or Live TV..."
                className="w-full min-h-[40px] pl-10 pr-8 rounded-xl bg-white/[0.06] border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              {channelQuery && (
                <button
                  type="button"
                  onClick={() => setChannelQuery('')}
                  aria-label="Clear channel filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomForm((prev) => !prev)}
              className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                showCustomForm
                  ? 'bg-[#3B82F6]/25 border-[#3B82F6]/60 text-white'
                  : 'bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.12]'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Link</span>
            </button>
          </div>

          {showCustomForm && (
            <form
              onSubmit={handleAddCustomStream}
              className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2"
            >
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Channel name (e.g. Star Sports 1 HD, Sony Sports Ten 1)"
                className="w-full min-h-[36px] px-3 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              />
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://.../stream.m3u8"
                    required
                    className="w-full min-h-[36px] pl-8 pr-3 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[36px] px-3.5 rounded-lg bg-[#E50914] hover:bg-[#f41824] text-white text-xs font-semibold shrink-0 transition-colors"
                >
                  Save &amp; Play
                </button>
              </div>
              {customError && <p className="text-[11px] text-rose-400">{customError}</p>}
            </form>
          )}

          <p className="text-[11px] text-slate-400">
            {channelQuery
              ? `Matching channels (${displayedChannels.length})`
              : 'Playable sports feeds & Star / Sony Sports channel slots'}
          </p>
        </div>

        {/* Channel Rows */}
        <div className="px-5 pb-5 pt-1 space-y-2 overflow-y-auto">
          {displayedChannels.length === 0 && pendingSlots.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <Tv className="h-7 w-7 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-300">
                No verified public sports streams found for this search.
              </p>
              <p className="text-[11px] text-slate-400">
                Use <span className="text-white font-semibold">Add Link</span> above to paste your own
                working M3U8 channel URL.
              </p>
            </div>
          ) : (
            <>
              {displayedChannels.map((ch) => {
                const isCustomSaved = ch.playlistName === 'Saved Custom Stream';
                return (
                  <div
                    key={`${ch.id}-${ch.streamUrl}`}
                    className="w-full min-h-[54px] px-3.5 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] hover:border-[#3B82F6]/50 flex items-center justify-between gap-2 transition-all group"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectChannel(ch)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left active:scale-[0.99]"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-black/45 border border-white/10 overflow-hidden flex items-center justify-center p-1">
                        {ch.logo ? (
                          <img
                            src={ch.logo}
                            alt={ch.name}
                            referrerPolicy="no-referrer"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <Play className="h-4 w-4 text-[#3B82F6]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {ch.isVerifiedPlayable && (
                            <span
                              className="h-2 w-2 rounded-full bg-emerald-400 shrink-0"
                              title="Verified playable in browser"
                            />
                          )}
                          <span className="font-display text-sm font-semibold text-white truncate">
                            {ch.name}
                          </span>
                        </div>
                        {ch.playlistName && (
                          <p className="text-[11px] text-slate-400 truncate">{ch.playlistName}</p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ch.quality && (
                        <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-sky-300 text-[10px] font-bold tracking-wide">
                          {ch.quality}
                        </span>
                      )}
                      {isCustomSaved && (
                        <button
                          type="button"
                          onClick={() => setCustomSaved(removeCustomSportsChannel(ch.id))}
                          aria-label={`Remove ${ch.name}`}
                          className="h-7 w-7 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectChannel(ch)}
                        aria-label={`Play ${ch.name}`}
                        className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 group-hover:text-white"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Star Sports & Sony Sports Custom Stream Slots */}
              {pendingSlots.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-400 px-1">
                    Star Sports &amp; Sony Sports (add your .m3u8 URL to enable)
                  </p>
                  {pendingSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="w-full min-h-[48px] px-3.5 py-2 rounded-2xl bg-white/[0.03] border border-dashed border-white/[0.12] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Tv className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-slate-200 truncate">
                          {slot.name}
                        </span>
                        {slot.quality && (
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-semibold text-slate-400">
                            {slot.quality}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConfigureSlot(slot.name)}
                        className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/35 border border-[#3B82F6]/40 text-sky-300 text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        Set Link
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
