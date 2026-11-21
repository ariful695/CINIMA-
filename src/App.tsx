import React from 'react';
import {
  Bookmark,
  Clapperboard,
  Download,
  Home,
  PlayCircle,
  Search,
  Settings,
  Tv,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CatalogGridScreen } from './components/CatalogGridScreen';
import { ExtensionsScreen } from './components/ExtensionsScreen';
import { HomeScreen } from './components/HomeScreen';
import { LiveTvScreen } from './components/LiveTvScreen';
import { MediaDetailsScreen } from './components/MediaDetailsScreen';
import { SearchScreen } from './components/SearchScreen';
import { ServerPickerModal } from './components/ServerPickerModal';
import { SettingsScreen } from './components/SettingsScreen';
import { VideoPlayerScreen } from './components/VideoPlayerScreen';
import { AppProvider, useAppState } from './state/AppContext';
import { NavTab, THEME_ACCENTS } from './types/media';

const DOCK_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'movies', label: 'Movies', icon: Clapperboard },
  { id: 'series', label: 'Series', icon: PlayCircle },
  { id: 'live', label: 'Live TV', icon: Tv },
  { id: 'library', label: 'Settings', icon: Settings },
];

const LIQUID_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 22,
  mass: 0.85,
};

const AppShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    librarySubTab,
    openLibrarySection,
    selectedMedia,
    playerSession,
    themeColor,
  } = useAppState();

  const accent = THEME_ACCENTS[themeColor || 'red'];

  const [navVisible, setNavVisible] = React.useState(true);
  const lastScrollYRef = React.useRef(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 40) {
        setNavVisible(false);
      } else if (currentScrollY < lastScrollYRef.current) {
        setNavVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#07090E] text-slate-100 flex flex-col lg:flex-row overflow-x-clip">
      {/* Lightweight GPU-Composited Ambient Glow Backdrop (no CSS filter: blur) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0 contain-strict"
      >
        <div
          className="liquid-blob-a absolute -top-40 -left-32 h-[540px] w-[540px] rounded-full opacity-[0.22]"
          style={{
            background: `radial-gradient(circle, rgba(${accent.glowRgb},0.45) 0%, rgba(${accent.glowRgb},0.12) 45%, transparent 70%)`,
          }}
        />
        <div
          className="liquid-blob-b absolute -bottom-44 -right-32 h-[580px] w-[580px] rounded-full opacity-[0.22]"
          style={{
            background: `radial-gradient(circle, rgba(${accent.glowRgb},0.35) 0%, rgba(${accent.glowRgb},0.10) 45%, transparent 70%)`,
          }}
        />
        <div
          className="liquid-blob-c absolute top-1/3 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full opacity-[0.14]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Desktop Translucent Liquid Glass Side Rail */}
      <aside className="relative z-10 hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-[#0B0E16]/85 backdrop-blur-md border-r border-white/[0.09] px-4 py-6 justify-between">
        <div className="space-y-7">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="px-2 text-left font-display text-xl font-extrabold tracking-widest text-white whitespace-nowrap shrink-0 uppercase"
          >
            EUTHOPIAR
          </button>

          <nav className="space-y-1.5" aria-label="Primary navigation">
            {DOCK_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.id === 'library'
                  ? activeTab === 'library' && librarySubTab === 'settings'
                  : activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => {
                    if (item.id === 'library') {
                      openLibrarySection('settings');
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`relative w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-liquid"
                      transition={LIQUID_SPRING}
                      className="absolute inset-0 rounded-xl bg-white shadow-[0_4px_16px_rgba(255,255,255,0.25)]"
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-5 w-5 shrink-0 ${
                      active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  />
                  <span className="relative z-10">{item.label}</span>
                </motion.button>
              );
            })}

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => openLibrarySection('mylist')}
              className={`relative w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'library' && librarySubTab === 'mylist'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              {activeTab === 'library' && librarySubTab === 'mylist' && (
                <motion.span
                  layoutId="desktop-nav-liquid"
                  transition={LIQUID_SPRING}
                  className="absolute inset-0 rounded-xl bg-white/[0.10] backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.3)]"
                />
              )}
              <Bookmark
                className={`relative z-10 h-5 w-5 shrink-0 ${
                  activeTab === 'library' && librarySubTab === 'mylist'
                    ? 'text-[#E50914]'
                    : 'text-slate-400'
                }`}
              />
              <span className="relative z-10">My List</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => openLibrarySection('extensions')}
              className={`relative w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'library' && librarySubTab === 'extensions'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              {activeTab === 'library' && librarySubTab === 'extensions' && (
                <motion.span
                  layoutId="desktop-nav-liquid"
                  transition={LIQUID_SPRING}
                  className="absolute inset-0 rounded-xl bg-white/[0.10] backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.3)]"
                />
              )}
              <Download
                className={`relative z-10 h-5 w-5 shrink-0 ${
                  activeTab === 'library' && librarySubTab === 'extensions'
                    ? 'text-blue-400'
                    : 'text-slate-400'
                }`}
              />
              <span className="relative z-10">Extensions</span>
            </motion.button>
          </nav>
        </div>
      </aside>

      {/* Mobile Compact Glass Header */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] px-4 bg-[#07090E]/90 backdrop-blur-md border-b border-white/[0.09] flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="font-display text-lg font-extrabold tracking-widest text-white whitespace-nowrap shrink-0 uppercase"
        >
          EUTHOPIAR
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            aria-label="Search catalog"
            className="h-9 w-9 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-slate-200 hover:text-white"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => openLibrarySection('settings')}
            aria-label="User Profile"
            className="h-9 w-9 rounded-full overflow-hidden border-2 border-white/20 bg-emerald-100/20 flex items-center justify-center shadow-md active:scale-95 transition-transform"
          >
            <div className="h-full w-full bg-gradient-to-tr from-amber-400 to-rose-400 flex items-center justify-center text-slate-950 font-bold text-xs">
              👤
            </div>
          </button>
        </div>
      </header>

      {/* Main Content Area — fast GPU-only screen switch */}
      <main className="relative z-10 flex-1 min-w-0 pb-24 lg:pb-6">
        <motion.div
          key={activeTab + (activeTab === 'library' ? librarySubTab : '')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'movies' && <CatalogGridScreen mediaType="movie" />}
          {activeTab === 'series' && <CatalogGridScreen mediaType="tv" />}
          {activeTab === 'live' && <LiveTvScreen />}
          {activeTab === 'search' && <SearchScreen />}
          {activeTab === 'library' && librarySubTab === 'settings' && <SettingsScreen />}
          {activeTab === 'library' && librarySubTab === 'mylist' && <SettingsScreen />}
          {activeTab === 'library' && librarySubTab === 'extensions' && <ExtensionsScreen />}
        </motion.div>
      </main>

      {/* Floating Glass Mobile Dock */}
      <nav
        aria-label="Mobile navigation"
        className={`lg:hidden fixed bottom-0.5 inset-x-2.5 z-30 h-[60px] px-3 rounded-2xl bg-[#101420]/95 backdrop-blur-md border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.25)] flex items-center justify-between transition-transform duration-300 ease-in-out ${
          navVisible ? 'translate-y-0' : 'translate-y-24'
        }`}
      >
        {DOCK_ITEMS.filter((item) => item.id !== 'search').map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                if (item.id === 'library') {
                  openLibrarySection('settings');
                } else {
                  setActiveTab(item.id);
                }
              }}
              aria-label={item.label}
              className={`relative min-h-[46px] rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap transform scale-110 ${
                active
                  ? 'text-slate-900 px-3.5 font-bold'
                  : 'text-slate-400 hover:text-white px-3'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-liquid"
                  transition={LIQUID_SPRING}
                  className="absolute inset-0 rounded-xl bg-white shadow-[0_4px_16px_rgba(255,255,255,0.25)]"
                />
              )}
              <Icon className={`relative z-10 h-5 w-5 shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
              {active && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative z-10 text-xs font-bold text-slate-900"
                >
                  {item.label}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Media Details Overlay */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            key={`details-${selectedMedia.mediaType}-${selectedMedia.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-0 z-40"
          >
            <MediaDetailsScreen
              mediaId={selectedMedia.id}
              mediaType={selectedMedia.mediaType}
              seedItem={selectedMedia.seedItem}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Custom Video Player Overlay */}
      <AnimatePresence>
        {playerSession && (
          <motion.div
            key={`player-${playerSession.mediaType}-${playerSession.mediaId}-${playerSession.liveChannel?.id || ''}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50"
          >
            <VideoPlayerScreen session={playerSession} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-Play Server Selector Modal */}
      <ServerPickerModal />
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <AppShell />
      </AppProvider>
    </MotionConfig>
  );
}
