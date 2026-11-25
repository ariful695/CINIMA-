import React, { useState } from 'react';
import { CheckCircle2, Download, Share2, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'sidebar' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Suppress install UI once already launched as an installed standalone Android/iOS/Desktop app
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <section className="rounded-2xl liquid-glass p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Android App Mode Active
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                EUTHOPIAR is running as a standalone installed application with offline shell caching.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shrink-0">
            Installed
          </span>
        </section>
      );
    }
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        const result = await install();
        if (result === 'unavailable') {
          setShowGuideModal(true);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const label = isInstallable
    ? installing
      ? 'Installing...'
      : isAndroid
      ? 'Install Android App'
      : 'Install App'
    : isIOS
    ? 'Install on iPhone'
    : 'Install Android App';

  return (
    <>
      {variant === 'card' ? (
        <section className="rounded-2xl liquid-glass p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#E50914]/15 border border-[#E50914]/35 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-[#FF3D47]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Install as Android App
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {isInstallable
                  ? 'Install EUTHOPIAR directly onto your Android home screen & app drawer with fullscreen standalone playback and offline downloads.'
                  : isIOS
                  ? 'Add EUTHOPIAR to your iOS Home Screen for fullscreen standalone app playback.'
                  : 'Open in Chrome / Edge on Android to install EUTHOPIAR as a native fullscreen standalone WebAPK app.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleAction()}
            disabled={installing}
            className="min-h-[44px] px-5 rounded-xl bg-[#E50914] hover:bg-red-500 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#E50914]/25 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>{label}</span>
          </button>
        </section>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => void handleAction()}
          disabled={installing}
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#E50914]/15 hover:bg-[#E50914]/25 border border-[#E50914]/35 text-xs font-bold text-white flex items-center gap-2.5 transition-colors whitespace-nowrap"
        >
          <Smartphone className="h-4 w-4 text-[#FF3D47] shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ) : (
        // Compact header button (only surfaced on install-ready or mobile browsers)
        (isInstallable || isAndroid || isIOS) && (
          <button
            type="button"
            onClick={() => void handleAction()}
            disabled={installing}
            aria-label={label}
            title={label}
            className="h-9 px-2.5 rounded-full bg-[#E50914]/90 hover:bg-[#E50914] border border-white/25 text-[11px] font-bold text-white inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">App</span>
          </button>
        )
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#101420] border border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-[#FF3D47]" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="font-display text-lg font-bold text-white">
                    {isIOS ? 'Install on iPhone / iPad' : 'Install EUTHOPIAR Android App'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fullscreen standalone WebAPK · Offline shell ready
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed bg-black/35 rounded-xl p-4 border border-white/10">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">1.</span>
                  <span>
                    Tap the <strong className="inline-flex items-center gap-1 text-white"><Share2 className="h-3.5 w-3.5" /> Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">2.</span>
                  <span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">3.</span>
                  <span>
                    Tap <strong className="text-white">Add</strong> to launch EUTHOPIAR like a native app.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed bg-black/35 rounded-xl p-4 border border-white/10">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">1.</span>
                  <span>
                    Open this page directly in <strong className="text-white">Google Chrome</strong> or <strong className="text-white">Microsoft Edge</strong> on Android (if inside an in-app preview, open in Chrome).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">2.</span>
                  <span>
                    Tap the <strong className="text-white">⋮ Menu</strong> at the top-right corner of Chrome.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#FF3D47]">3.</span>
                  <span>
                    Tap <strong className="text-white">Install app</strong> (or <strong className="text-white">Add to Home screen &rarr; Install</strong>) to install the Android WebAPK package into your app drawer.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[42px] rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
