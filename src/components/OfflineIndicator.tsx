import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAppState } from '../state/AppContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { openLibrarySection, offlineDownloads } = useAppState();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-3 right-3 sm:right-auto sm:left-4 lg:bottom-5 lg:left-60 z-40 flex items-center justify-between gap-3 rounded-xl bg-amber-500/95 backdrop-blur-md border border-amber-300/40 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-xl"
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Offline Mode — Cached shell active
          {offlineDownloads.length > 0 ? ` (${offlineDownloads.length} saved)` : ''}
        </span>
      </div>
      {offlineDownloads.length > 0 && (
        <button
          type="button"
          onClick={() => openLibrarySection('downloads')}
          className="px-2.5 py-1 rounded-lg bg-slate-950/90 text-white text-[11px] font-bold shrink-0 hover:bg-slate-900 transition-colors"
        >
          Downloads
        </button>
      )}
    </div>
  );
};
