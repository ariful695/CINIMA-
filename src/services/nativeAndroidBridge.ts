import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

interface NativePlayerPluginInterface {
  openNativePlayer(options: {
    url: string;
    title: string;
    subtitle?: string;
    isLive?: boolean;
    headers?: Record<string, string>;
    bufferMb?: number;
    fallbackUrls?: string[];
  }): Promise<{ launched: boolean }>;
  setImmersiveFullscreen(options: {
    enabled: boolean;
    landscape?: boolean;
  }): Promise<{ ok: boolean }>;
  enterPictureInPicture(): Promise<{ ok: boolean }>;
  downloadMedia(options: {
    url: string;
    fileName: string;
    title: string;
  }): Promise<{ downloadId: number }>;
}

const NativePlayer = registerPlugin<NativePlayerPluginInterface>('NativePlayer');

function toAbsoluteUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (typeof window !== 'undefined' && rawUrl.startsWith('/')) {
    return `${window.location.origin}${rawUrl}`;
  }
  return rawUrl;
}

export const nativeAndroidBridge = {
  isNativeAndroid(): boolean {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  },

  async setupSystemBars(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#07090e' });
    } catch {
      // Ignore if plugin unavailable
    }
  },

  registerBackButtonHandler(onBack: () => boolean): () => void {
    if (!this.isNativeAndroid()) {
      return () => {};
    }
    let removed = false;
    const handlePromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      const handled = onBack();
      if (handled) return;
      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.minimizeApp();
      }
    });
    return () => {
      if (removed) return;
      removed = true;
      void handlePromise.then((h) => h.remove()).catch(() => {});
    };
  },

  async setPlayerFullscreen(enabled: boolean, landscape = false): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await NativePlayer.setImmersiveFullscreen({ enabled, landscape });
    } catch {
      // Fallback to StatusBar hide/show
      try {
        if (enabled) await StatusBar.hide();
        else await StatusBar.show();
      } catch {}
    }
  },

  async openNativeExoPlayer(options: {
    url: string;
    title: string;
    subtitle?: string;
    isLive?: boolean;
    headers?: Record<string, string>;
    bufferMb?: number;
    fallbackUrls?: string[];
  }): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;
    try {
      const res = await NativePlayer.openNativePlayer({
        ...options,
        url: toAbsoluteUrl(options.url),
        fallbackUrls: options.fallbackUrls?.map((u) => toAbsoluteUrl(u)),
      });
      return Boolean(res?.launched);
    } catch {
      return false;
    }
  },

  async enterPictureInPicture(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;
    try {
      const res = await NativePlayer.enterPictureInPicture();
      return Boolean(res?.ok);
    } catch {
      return false;
    }
  },

  async downloadWithAndroidManager(options: {
    url: string;
    fileName: string;
    title: string;
  }): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;
    try {
      const res = await NativePlayer.downloadMedia({
        ...options,
        url: toAbsoluteUrl(options.url),
      });
      return typeof res?.downloadId === 'number' && res.downloadId > 0;
    } catch {
      return false;
    }
  },
};
