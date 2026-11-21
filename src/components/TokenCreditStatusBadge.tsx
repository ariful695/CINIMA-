import React from 'react';
import { Zap, ShieldCheck } from 'lucide-react';

export const TokenCreditStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className={`bg-zinc-900/90 border border-zinc-800 rounded-xl ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-xs'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-zinc-300 shadow-lg`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
        <div>
          <span className="font-semibold text-white">Remaining Credits:</span> 1,840 / 2,000 tokens <span className="text-emerald-400 font-medium">(92% remaining)</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-zinc-400">
        <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
        <div>
          <span className="font-semibold text-zinc-300">Daily Limit:</span> 68% used today <span className="text-zinc-400 font-medium">(32% left · Resets in 4h 15m)</span>
        </div>
      </div>
    </div>
  );
};
