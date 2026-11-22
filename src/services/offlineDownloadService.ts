import {
  MediaType,
  OfflineDownloadItem,
  OfflineSubtitleTrack,
  ServerPickerTarget,
  StreamSource,
  SubtitleTrack,
} from '../types/media';
import { streamProviderService } from './streamProviderService';

const KEYSTORE_DB_NAME = 'kinostream_offline_keystore';
const KEYSTORE_STORE = 'keys';
const VAULT_MASTER_KEY_ID = 'app-master-vault-key';

const VAULT_DB_NAME = 'kinostream_offline_vault';
const VAULT_ITEMS_STORE = 'items';
const VAULT_CHUNKS_STORE = 'chunks';
const VAULT_HLS_META_STORE = 'hlsMeta';

const MP4_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB encrypted chunks

interface StoredKeyRecord {
  id: string;
  key: CryptoKey;
  fingerprint: string;
  createdAt: number;
}

interface EncryptedChunkRecord {
  id: string; // `${downloadId}::${unitId}`
  downloadId: string;
  unitId: string;
  ivBase64: string;
  ciphertext: ArrayBuffer;
  byteLength: number;
}

interface HlsSegmentTask {
  unitId: string;
  url: string;
  rangeHeader?: string;
}

interface HlsMetaRecord {
  downloadId: string;
  tasks: HlsSegmentTask[];
}

export interface OfflineVaultStorageInfo {
  vaultBytes: number;
  completedCount: number;
  quotaBytes: number | null;
  usageBytes: number | null;
}

export function buildOfflineMediaKey(
  mediaType: MediaType,
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number
): string {
  if (mediaType === 'tv' && seasonNumber && episodeNumber) {
    return `tv:${mediaId}:s${seasonNumber}e${episodeNumber}`;
  }
  return `${mediaType}:${mediaId}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function openKeystoreDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEYSTORE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYSTORE_STORE)) {
        db.createObjectStore(KEYSTORE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline keystore'));
  });
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_ITEMS_STORE)) {
        db.createObjectStore(VAULT_ITEMS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VAULT_CHUNKS_STORE)) {
        const chunks = db.createObjectStore(VAULT_CHUNKS_STORE, { keyPath: 'id' });
        chunks.createIndex('byDownloadId', 'downloadId', { unique: false });
      }
      if (!db.objectStoreNames.contains(VAULT_HLS_META_STORE)) {
        db.createObjectStore(VAULT_HLS_META_STORE, { keyPath: 'downloadId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline media vault'));
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function idbTxComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function requireCryptoSubtle(): SubtleCrypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure WebCrypto context (HTTPS or localhost) is required for encrypted offline downloads.');
  }
  return window.crypto.subtle;
}

let cachedKeyPromise: Promise<StoredKeyRecord> | null = null;

async function getOrCreateAppVaultKey(): Promise<StoredKeyRecord> {
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    const subtle = requireCryptoSubtle();
    const db = await openKeystoreDb();
    try {
      const tx = db.transaction(KEYSTORE_STORE, 'readonly');
      const existing = await idbRequest<StoredKeyRecord | undefined>(
        tx.objectStore(KEYSTORE_STORE).get(VAULT_MASTER_KEY_ID)
      );
      if (existing?.key && existing.fingerprint) {
        return existing;
      }
    } finally {
      db.close();
    }

    // Generate non-extractable AES-256-GCM key bound to this browser origin & app IndexedDB enclave
    const key = await subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const randomTag = crypto.getRandomValues(new Uint8Array(16));
    const digest = await subtle.digest('SHA-256', randomTag);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 12)
      .toUpperCase();
    const record: StoredKeyRecord = {
      id: VAULT_MASTER_KEY_ID,
      key,
      fingerprint: `AES256-${hex}`,
      createdAt: Date.now(),
    };

    const writeDb = await openKeystoreDb();
    try {
      const wtx = writeDb.transaction(KEYSTORE_STORE, 'readwrite');
      wtx.objectStore(KEYSTORE_STORE).put(record);
      await idbTxComplete(wtx);
    } finally {
      writeDb.close();
    }
    return record;
  })();

  return cachedKeyPromise;
}

function buildChunkAad(downloadId: string, unitId: string): Uint8Array<ArrayBuffer> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'kinostream';
  const encoded = new TextEncoder().encode(`kinostream-offline-vault::${origin}::${downloadId}::${unitId}`);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return new Uint8Array(buffer);
}

async function encryptAndStoreUnit(
  downloadId: string,
  unitId: string,
  plainBuffer: ArrayBuffer
): Promise<number> {
  const subtle = requireCryptoSubtle();
  const { key } = await getOrCreateAppVaultKey();
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const aad = buildChunkAad(downloadId, unitId);

  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
    },
    key,
    plainBuffer
  );

  const rec: EncryptedChunkRecord = {
    id: `${downloadId}::${unitId}`,
    downloadId,
    unitId,
    ivBase64: bytesToBase64(iv),
    ciphertext,
    byteLength: plainBuffer.byteLength,
  };

  const db = await openVaultDb();
  try {
    const tx = db.transaction(VAULT_CHUNKS_STORE, 'readwrite');
    tx.objectStore(VAULT_CHUNKS_STORE).put(rec);
    await idbTxComplete(tx);
  } finally {
    db.close();
  }

  return ciphertext.byteLength;
}

async function getChunkRecord(downloadId: string, unitId: string): Promise<EncryptedChunkRecord | null> {
  const db = await openVaultDb();
  try {
    const tx = db.transaction(VAULT_CHUNKS_STORE, 'readonly');
    const rec = await idbRequest<EncryptedChunkRecord | undefined>(
      tx.objectStore(VAULT_CHUNKS_STORE).get(`${downloadId}::${unitId}`)
    );
    return rec || null;
  } finally {
    db.close();
  }
}

async function decryptStoredUnit(downloadId: string, unitId: string): Promise<ArrayBuffer> {
  const subtle = requireCryptoSubtle();
  const rec = await getChunkRecord(downloadId, unitId);
  if (!rec) {
    throw new Error(`Encrypted offline chunk "${unitId}" is missing.`);
  }
  const { key } = await getOrCreateAppVaultKey();
  const rawIv = base64ToBytes(rec.ivBase64);
  const iv = new Uint8Array(new ArrayBuffer(rawIv.byteLength));
  iv.set(rawIv);
  const aad = buildChunkAad(downloadId, unitId);
  return subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
    },
    key,
    rec.ciphertext
  );
}

async function deleteDownloadUnitsFromDb(downloadId: string): Promise<void> {
  const db = await openVaultDb();
  try {
    const tx = db.transaction([VAULT_CHUNKS_STORE, VAULT_HLS_META_STORE], 'readwrite');
    const chunksStore = tx.objectStore(VAULT_CHUNKS_STORE);
    const idx = chunksStore.index('byDownloadId');
    const keys = await idbRequest<IDBValidKey[]>(idx.getAllKeys(downloadId));
    for (const key of keys) {
      chunksStore.delete(key);
    }
    tx.objectStore(VAULT_HLS_META_STORE).delete(downloadId);
    await idbTxComplete(tx);
  } finally {
    db.close();
  }
}

function buildFetchableStreamUrl(url: string, isSegment = false): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/api/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `/api/stream-proxy?url=${encodeURIComponent(trimmed)}${isSegment ? '&seg=1' : ''}`;
  }
  return trimmed;
}

function pickBestDownloadableSource(sources: StreamSource[]): StreamSource | null {
  const candidates = sources.filter(
    (s) =>
      s.format !== 'youtube' &&
      s.format !== 'embed' &&
      Boolean(s.url) &&
      (s.format === 'mp4' || s.format === 'hls')
  );
  if (candidates.length === 0) return null;

  const scored = candidates.map((s) => {
    let score = 0;
    const isP2P = s.url.includes('/api/torrent/stream');
    const isRemux = s.url.includes('remux=1');
    if (s.isVerified) score += 400;
    if (s.isDirectPlayable !== false) score += 200;
    if (s.format === 'mp4' && !isRemux && !isP2P) score += 260;
    if (s.format === 'hls' && !isRemux && !isP2P) score += 220;
    if (isRemux) score -= 240;
    if (isP2P) score -= 180;
    const q = (s.quality || '').toUpperCase();
    if (q.includes('1080')) score += 40;
    else if (q.includes('720')) score += 30;
    else if (q.includes('4K') || q.includes('2160')) score += 20;
    return { source: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.source || null;
}

function srtToVtt(raw: string): string {
  const normalized = raw
    .replace(/\r+/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return normalized.trim().startsWith('WEBVTT')
    ? normalized
    : `WEBVTT\n\n${normalized}`;
}

function resolvePlaylistAbsoluteUrl(rawRef: string, baseUrl: string): string {
  const trimmed = rawRef.trim();
  if (trimmed.startsWith('/api/')) {
    return new URL(trimmed, window.location.origin).toString();
  }
  return new URL(trimmed, new URL(baseUrl, window.location.origin)).toString();
}

function unwrapProxyUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname === '/api/stream-proxy') {
      return parsed.searchParams.get('url') || url;
    }
  } catch {
    // Ignore parse error
  }
  return url;
}

interface ParsedHlsDownloadPlan {
  rewrittenPlaylist: string;
  tasks: HlsSegmentTask[];
}

async function resolveHlsMediaPlaylistPlan(
  initialUrl: string,
  downloadId: string,
  signal: AbortSignal
): Promise<ParsedHlsDownloadPlan> {
  let playlistFetchUrl = buildFetchableStreamUrl(initialUrl, false);
  let res = await fetch(playlistFetchUrl, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch HLS manifest (HTTP ${res.status})`);
  }
  let text = await res.text();
  if (!text.includes('#EXTM3U')) {
    throw new Error('Upstream stream did not return a valid HLS playlist');
  }

  // If master playlist, select best media stream variant
  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split(/\r?\n/);
    const variants: Array<{ bandwidth: number; url: string }> = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        let nextUri = '';
        for (let j = i + 1; j < lines.length; j += 1) {
          const cand = lines[j].trim();
          if (cand && !cand.startsWith('#')) {
            nextUri = cand;
            break;
          }
        }
        if (nextUri) {
          variants.push({
            bandwidth: bw,
            url: resolvePlaylistAbsoluteUrl(nextUri, playlistFetchUrl),
          });
        }
      }
    }
    if (variants.length > 0) {
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      // Prefer <= 1080p high-efficiency variant when 4K is massive, or top variant
      const chosen = variants[0];
      playlistFetchUrl = buildFetchableStreamUrl(unwrapProxyUrl(chosen.url), false);
      if (chosen.url.includes('/api/stream-proxy')) {
        playlistFetchUrl = chosen.url;
      }
      res = await fetch(playlistFetchUrl, { signal });
      if (!res.ok) {
        throw new Error(`Failed to fetch HLS media variant (HTTP ${res.status})`);
      }
      text = await res.text();
      if (!text.includes('#EXTM3U')) {
        throw new Error('HLS media variant returned an invalid playlist');
      }
    }
  }

  const lines = text.split(/\r?\n/);
  const tasks: HlsSegmentTask[] = [];
  const rewrittenLines: string[] = [];

  let keyCounter = 0;
  let mapCounter = 0;
  let segCounter = 0;
  let pendingByteRange: { length: number; offset: number } | null = null;
  let lastByteRangeEnd = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      rewrittenLines.push(rawLine);
      continue;
    }

    if (trimmed.startsWith('#EXT-X-BYTERANGE:')) {
      const val = trimmed.slice('#EXT-X-BYTERANGE:'.length).trim();
      const parts = val.split('@');
      const len = parseInt(parts[0], 10);
      const offset = parts[1] !== undefined ? parseInt(parts[1], 10) : lastByteRangeEnd;
      if (Number.isFinite(len) && Number.isFinite(offset)) {
        pendingByteRange = { length: len, offset };
        lastByteRangeEnd = offset + len;
      }
      // Omit EXT-X-BYTERANGE in offline playlist because each segment becomes an individual decrypted unit
      continue;
    }

    if (trimmed.startsWith('#EXT-X-KEY:')) {
      const updated = rawLine.replace(/URI="([^"]+)"/i, (_m, uriVal: string) => {
        const unitId = `key-${keyCounter++}`;
        const abs = resolvePlaylistAbsoluteUrl(uriVal, playlistFetchUrl);
        tasks.push({ unitId, url: buildFetchableStreamUrl(unwrapProxyUrl(abs), false) });
        return `URI="offline-hls://${downloadId}/${unitId}"`;
      });
      rewrittenLines.push(updated);
      continue;
    }

    if (trimmed.startsWith('#EXT-X-MAP:')) {
      const updated = rawLine.replace(/URI="([^"]+)"/i, (_m, uriVal: string) => {
        const unitId = `init-${mapCounter++}`;
        const abs = resolvePlaylistAbsoluteUrl(uriVal, playlistFetchUrl);
        tasks.push({ unitId, url: buildFetchableStreamUrl(unwrapProxyUrl(abs), true) });
        return `URI="offline-hls://${downloadId}/${unitId}"`;
      });
      rewrittenLines.push(updated);
      continue;
    }

    if (trimmed.startsWith('#')) {
      rewrittenLines.push(rawLine);
      continue;
    }

    const absSeg = resolvePlaylistAbsoluteUrl(trimmed, playlistFetchUrl);
    const unitId = `seg-${segCounter++}`;
    const rangeHeader = pendingByteRange
      ? `bytes=${pendingByteRange.offset}-${pendingByteRange.offset + pendingByteRange.length - 1}`
      : undefined;
    pendingByteRange = null;

    const finalSegUrl = absSeg.includes('/api/stream-proxy')
      ? absSeg
      : buildFetchableStreamUrl(absSeg, true);

    tasks.push({
      unitId,
      url: finalSegUrl,
      rangeHeader,
    });
    rewrittenLines.push(`offline-hls://${downloadId}/${unitId}`);
  }

  const segCount = tasks.filter((t) => t.unitId.startsWith('seg-')).length;
  if (segCount === 0) {
    throw new Error('HLS playlist contains no downloadable video segments');
  }

  // Ensure VOD playlists terminate cleanly offline
  const hasEndList = rewrittenLines.some((l) => l.trim() === '#EXT-X-ENDLIST');
  if (!hasEndList) {
    rewrittenLines.push('#EXT-X-ENDLIST');
  }

  return {
    rewrittenPlaylist: rewrittenLines.join('\n'),
    tasks,
  };
}

type Subscriber = (items: OfflineDownloadItem[]) => void;

class OfflineDownloadService {
  private subscribers = new Set<Subscriber>();
  private abortControllers = new Map<string, AbortController>();
  private cancelReason = new Map<string, 'canceled' | 'paused'>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private async notifySubscribers(): Promise<void> {
    const all = await this.getAllDownloads();
    for (const fn of this.subscribers) {
      fn(all);
    }
  }

  async getAllDownloads(): Promise<OfflineDownloadItem[]> {
    if (typeof indexedDB === 'undefined') return [];
    let db: IDBDatabase | null = null;
    try {
      db = await openVaultDb();
      const tx = db.transaction(VAULT_ITEMS_STORE, 'readonly');
      const items = await idbRequest<OfflineDownloadItem[]>(
        tx.objectStore(VAULT_ITEMS_STORE).getAll()
      );
      return (items || []).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    } finally {
      db?.close();
    }
  }

  async getDownloadById(id: string): Promise<OfflineDownloadItem | null> {
    if (typeof indexedDB === 'undefined') return null;
    let db: IDBDatabase | null = null;
    try {
      db = await openVaultDb();
      const tx = db.transaction(VAULT_ITEMS_STORE, 'readonly');
      const item = await idbRequest<OfflineDownloadItem | undefined>(
        tx.objectStore(VAULT_ITEMS_STORE).get(id)
      );
      return item || null;
    } catch {
      return null;
    } finally {
      db?.close();
    }
  }

  private async saveItem(item: OfflineDownloadItem): Promise<OfflineDownloadItem> {
    const updated: OfflineDownloadItem = { ...item, updatedAt: Date.now() };
    const db = await openVaultDb();
    try {
      const tx = db.transaction(VAULT_ITEMS_STORE, 'readwrite');
      tx.objectStore(VAULT_ITEMS_STORE).put(updated);
      await idbTxComplete(tx);
    } finally {
      db.close();
    }
    await this.notifySubscribers();
    return updated;
  }

  async reconcileInterruptedDownloads(): Promise<OfflineDownloadItem[]> {
    try {
      const all = await this.getAllDownloads();
      let changed = false;
      for (const item of all) {
        if ((item.status === 'downloading' || item.status === 'queued') && !this.abortControllers.has(item.id)) {
          item.status = 'paused';
          item.errorMessage = 'Download interrupted when session closed. Click Continue to resume.';
          item.updatedAt = Date.now();
          changed = true;
          const db = await openVaultDb();
          try {
            const tx = db.transaction(VAULT_ITEMS_STORE, 'readwrite');
            tx.objectStore(VAULT_ITEMS_STORE).put(item);
            await idbTxComplete(tx);
          } finally {
            db.close();
          }
        }
      }
      if (changed) {
        await this.notifySubscribers();
      }
      return this.getAllDownloads();
    } catch {
      return [];
    }
  }

  async getStorageInfo(): Promise<OfflineVaultStorageInfo> {
    const items = await this.getAllDownloads().catch(() => [] as OfflineDownloadItem[]);
    const vaultBytes = items.reduce((sum, item) => sum + (item.bytesDownloaded || 0), 0);
    const completedCount = items.filter((i) => i.status === 'completed').length;
    let quotaBytes: number | null = null;
    let usageBytes: number | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        quotaBytes = typeof est.quota === 'number' ? est.quota : null;
        usageBytes = typeof est.usage === 'number' ? est.usage : null;
      }
    } catch {
      // Storage estimate unavailable
    }
    return { vaultBytes, completedCount, quotaBytes, usageBytes };
  }

  async startDownload(
    target: ServerPickerTarget,
    preferredSource?: StreamSource,
    existingSources?: StreamSource[],
    existingSubtitles?: SubtitleTrack[]
  ): Promise<OfflineDownloadItem> {
    // Ensure key can be created in secure context first
    const keyInfo = await getOrCreateAppVaultKey();

    let resolvedSources = existingSources || [];
    let resolvedSubtitles = existingSubtitles || [];

    if (preferredSource) {
      if (!resolvedSources.some((s) => s.id === preferredSource.id)) {
        resolvedSources = [preferredSource, ...resolvedSources];
      }
    }

    if (resolvedSources.length === 0) {
      const query = {
        tmdbId: target.mediaId,
        imdbId: target.imdbId,
        dejavuId: target.dejavuId,
        archiveIdentifier: target.archiveIdentifier,
        mediaType: target.mediaType,
        title: target.title,
        genreIds: target.genreIds,
        originalLanguage: target.originalLanguage,
        releaseYear: target.releaseYear,
        seasonNumber: target.seasonNumber,
        episodeNumber: target.episodeNumber,
      };
      const res =
        target.mediaType === 'tv'
          ? await streamProviderService.resolveEpisodeStreams(query)
          : await streamProviderService.resolveMovieStreams(query);
      resolvedSources = res.sources || [];
      resolvedSubtitles = res.subtitles || [];
    }

    const chosenSource =
      (preferredSource && (preferredSource.format === 'mp4' || preferredSource.format === 'hls')
        ? preferredSource
        : null) || pickBestDownloadableSource(resolvedSources);

    const mediaKey = buildOfflineMediaKey(
      target.mediaType,
      target.mediaId,
      target.seasonNumber,
      target.episodeNumber
    );

    const allExisting = await this.getAllDownloads();
    const existingForKey = allExisting.find((d) => d.key === mediaKey);
    const id = existingForKey?.id || `dl-${mediaKey}-${Date.now()}`;

    if (existingForKey && this.abortControllers.has(existingForKey.id)) {
      this.cancelReason.set(existingForKey.id, 'canceled');
      this.abortControllers.get(existingForKey.id)?.abort();
    }

    // Clear stale chunks when starting a fresh download for the same title
    if (existingForKey) {
      await deleteDownloadUnitsFromDb(existingForKey.id);
    }

    if (!chosenSource) {
      const failedStub: OfflineDownloadItem = {
        id,
        key: mediaKey,
        mediaId: target.mediaId,
        mediaType: target.mediaType,
        title: target.title,
        subtitle: target.subtitle,
        posterPath: target.posterPath,
        backdropPath: target.backdropPath,
        fallbackPoster: target.fallbackPoster,
        fallbackBackdrop: target.fallbackBackdrop,
        imdbId: target.imdbId,
        dejavuId: target.dejavuId,
        archiveIdentifier: target.archiveIdentifier,
        originalLanguage: target.originalLanguage,
        releaseYear: target.releaseYear,
        seasonNumber: target.seasonNumber,
        episodeNumber: target.episodeNumber,
        episodeTitle: target.episodeTitle,
        providerName: 'No Direct Mirror',
        quality: 'Unavailable',
        format: 'mp4',
        mimeType: 'video/mp4',
        sourceUrl: '',
        sourceId: '',
        status: 'failed',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        completedUnits: 0,
        totalUnits: 0,
        encryptionAlg: 'AES-GCM-256',
        keyFingerprint: keyInfo.fingerprint,
        errorMessage:
          'No downloadable MP4 or HLS stream was available for this title. Try selecting a server manually.',
        createdAt: existingForKey?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      return this.saveItem(failedStub);
    }

    const format: 'mp4' | 'hls' =
      chosenSource.format === 'hls' || chosenSource.url.toLowerCase().includes('.m3u8')
        ? 'hls'
        : 'mp4';

    const newItem: OfflineDownloadItem = {
      id,
      key: mediaKey,
      mediaId: target.mediaId,
      mediaType: target.mediaType,
      title: target.title,
      subtitle: target.subtitle,
      posterPath: target.posterPath,
      backdropPath: target.backdropPath,
      fallbackPoster: target.fallbackPoster,
      fallbackBackdrop: target.fallbackBackdrop,
      imdbId: target.imdbId,
      dejavuId: target.dejavuId,
      archiveIdentifier: target.archiveIdentifier,
      originalLanguage: target.originalLanguage,
      releaseYear: target.releaseYear,
      seasonNumber: target.seasonNumber,
      episodeNumber: target.episodeNumber,
      episodeTitle: target.episodeTitle,
      providerName: chosenSource.providerName,
      quality: chosenSource.quality || 'HD',
      audioLanguage: chosenSource.audioLanguage,
      format,
      mimeType: format === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/mp4',
      sourceUrl: chosenSource.url,
      sourceId: chosenSource.id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      completedUnits: 0,
      totalUnits: 0,
      encryptionAlg: 'AES-GCM-256',
      keyFingerprint: keyInfo.fingerprint,
      createdAt: existingForKey?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveItem(newItem);
    void this.runDownloadJob(newItem, resolvedSubtitles);
    return newItem;
  }

  async cancelDownload(id: string, pauseOnly = false): Promise<void> {
    const controller = this.abortControllers.get(id);
    this.cancelReason.set(id, pauseOnly ? 'paused' : 'canceled');
    if (controller) {
      controller.abort();
      return;
    }
    const existing = await this.getDownloadById(id);
    if (existing && existing.status !== 'completed') {
      await this.saveItem({
        ...existing,
        status: pauseOnly ? 'paused' : 'canceled',
        errorMessage: pauseOnly
          ? 'Download paused. Click Continue to resume encrypted download.'
          : 'Download canceled. Click Continue to resume where you left off.',
      });
    }
  }

  async continueDownload(id: string): Promise<void> {
    const existing = await this.getDownloadById(id);
    if (!existing) return;
    if (existing.status === 'completed' || existing.status === 'downloading') return;

    if (!existing.sourceUrl) {
      await this.startDownload({
        mediaId: existing.mediaId,
        mediaType: existing.mediaType,
        title: existing.title,
        subtitle: existing.subtitle,
        posterPath: existing.posterPath,
        backdropPath: existing.backdropPath,
        fallbackPoster: existing.fallbackPoster,
        fallbackBackdrop: existing.fallbackBackdrop,
        imdbId: existing.imdbId,
        dejavuId: existing.dejavuId,
        archiveIdentifier: existing.archiveIdentifier,
        originalLanguage: existing.originalLanguage,
        releaseYear: existing.releaseYear,
        seasonNumber: existing.seasonNumber,
        episodeNumber: existing.episodeNumber,
        episodeTitle: existing.episodeTitle,
      });
      return;
    }

    const updated = await this.saveItem({
      ...existing,
      status: 'downloading',
      errorMessage: undefined,
    });
    void this.runDownloadJob(updated, []);
  }

  async deleteDownload(id: string): Promise<void> {
    const controller = this.abortControllers.get(id);
    if (controller) {
      this.cancelReason.set(id, 'canceled');
      controller.abort();
    }
    await deleteDownloadUnitsFromDb(id);
    const db = await openVaultDb();
    try {
      const tx = db.transaction(VAULT_ITEMS_STORE, 'readwrite');
      tx.objectStore(VAULT_ITEMS_STORE).delete(id);
      await idbTxComplete(tx);
    } finally {
      db.close();
    }
    await this.notifySubscribers();
  }

  async clearAllDownloads(): Promise<void> {
    for (const [id, controller] of this.abortControllers.entries()) {
      this.cancelReason.set(id, 'canceled');
      controller.abort();
    }
    const db = await openVaultDb();
    try {
      const tx = db.transaction(
        [VAULT_ITEMS_STORE, VAULT_CHUNKS_STORE, VAULT_HLS_META_STORE],
        'readwrite'
      );
      tx.objectStore(VAULT_ITEMS_STORE).clear();
      tx.objectStore(VAULT_CHUNKS_STORE).clear();
      tx.objectStore(VAULT_HLS_META_STORE).clear();
      await idbTxComplete(tx);
    } finally {
      db.close();
    }
    await this.notifySubscribers();
  }

  private async runDownloadJob(
    itemSnapshot: OfflineDownloadItem,
    rawSubtitles: SubtitleTrack[]
  ): Promise<void> {
    let item = { ...itemSnapshot };
    const controller = new AbortController();
    this.abortControllers.set(item.id, controller);
    this.cancelReason.delete(item.id);

    try {
      if (item.sourceUrl.includes('/api/torrent/stream')) {
        const urlObj = new URL(item.sourceUrl, window.location.origin);
        const prepRes = await fetch(`/api/torrent/prepare?${urlObj.searchParams.toString()}`, {
          method: 'POST',
          signal: controller.signal,
        });
        if (!prepRes.ok) {
          throw new Error('Could not initialize torrent swarm for offline download.');
        }
      }

      if (item.format === 'hls') {
        item = await this.downloadAndEncryptHls(item, controller.signal);
      } else {
        item = await this.downloadAndEncryptMp4(item, controller.signal);
      }

      // Encrypt offline subtitle tracks if available and not yet stored
      if (rawSubtitles.length > 0 && (!item.subtitles || item.subtitles.length === 0)) {
        const storedSubs: OfflineSubtitleTrack[] = [];
        for (let i = 0; i < Math.min(3, rawSubtitles.length); i += 1) {
          if (controller.signal.aborted) break;
          const sub = rawSubtitles[i];
          try {
            const subUrl = buildFetchableStreamUrl(sub.url, false);
            const sRes = await fetch(subUrl, { signal: controller.signal });
            if (!sRes.ok) continue;
            const rawText = await sRes.text();
            if (!rawText.trim()) continue;
            const vttText = sub.format === 'srt' ? srtToVtt(rawText) : rawText;
            const encoded = new TextEncoder().encode(vttText);
            const buf = new ArrayBuffer(encoded.byteLength);
            new Uint8Array(buf).set(encoded);
            await encryptAndStoreUnit(item.id, `sub-${storedSubs.length}`, buf);
            storedSubs.push({
              id: sub.id || `offline-sub-${storedSubs.length}`,
              label: sub.label,
              language: sub.language,
            });
          } catch {
            // Skip unreachable subtitle track
          }
        }
        item.subtitles = storedSubs;
      }

      item.status = 'completed';
      item.progress = 100;
      item.errorMessage = undefined;
      await this.saveItem(item);
    } catch (err) {
      const reason = this.cancelReason.get(item.id);
      const isAbort =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError');
      const latest = (await this.getDownloadById(item.id)) || item;

      if (isAbort) {
        const finalStatus = reason === 'paused' ? 'paused' : 'canceled';
        await this.saveItem({
          ...latest,
          status: finalStatus,
          errorMessage:
            finalStatus === 'paused'
              ? 'Download paused. Click Continue to resume encrypted download.'
              : 'Download canceled. Click Continue to resume or restart.',
        });
      } else {
        const message =
          err instanceof Error
            ? err.message
            : 'Download failed due to a network or stream error.';
        await this.saveItem({
          ...latest,
          status: 'failed',
          errorMessage: `${message} Click Continue to retry.`,
        });
      }
    } finally {
      this.abortControllers.delete(item.id);
      this.cancelReason.delete(item.id);
    }
  }

  private async downloadAndEncryptMp4(
    item: OfflineDownloadItem,
    signal: AbortSignal
  ): Promise<OfflineDownloadItem> {
    const fetchUrl = buildFetchableStreamUrl(item.sourceUrl, false);
    let resumeOffset = item.bytesDownloaded > 0 && item.completedUnits > 0 ? item.bytesDownloaded : 0;
    let nextChunkIndex = item.completedUnits > 0 && resumeOffset > 0 ? item.completedUnits : 0;

    const headers: Record<string, string> = {};
    if (resumeOffset > 0) {
      headers['Range'] = `bytes=${resumeOffset}-`;
    }

    const res = await fetch(fetchUrl, { headers, signal });
    if (!res.ok) {
      throw new Error(`Stream server returned HTTP ${res.status}`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      return this.downloadAndEncryptHls({ ...item, format: 'hls', mimeType: 'application/vnd.apple.mpegurl' }, signal);
    }

    if (resumeOffset > 0 && res.status !== 206) {
      // Server ignored Range header; restart cleanly from 0
      resumeOffset = 0;
      nextChunkIndex = 0;
      await deleteDownloadUnitsFromDb(item.id);
      item = { ...item, bytesDownloaded: 0, completedUnits: 0, totalUnits: 0, progress: 0 };
    }

    const contentRange = res.headers.get('content-range');
    let totalBytes = item.totalBytes || 0;
    if (contentRange) {
      const m = contentRange.match(/\/(\d+)$/);
      if (m) totalBytes = parseInt(m[1], 10);
    } else {
      const cl = parseInt(res.headers.get('content-length') || '0', 10);
      if (cl > 0) totalBytes = resumeOffset + cl;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Readable stream body is not available from stream server.');
    }

    let bytesDownloaded = resumeOffset;
    const staging = new Uint8Array(MP4_CHUNK_BYTES);
    let stagingOffset = 0;
    let lastUiUpdateAt = Date.now();

    const flushStaging = async () => {
      if (stagingOffset === 0) return;
      const chunkBuf = staging.slice(0, stagingOffset).buffer;
      await encryptAndStoreUnit(item.id, `chunk-${nextChunkIndex}`, chunkBuf);
      bytesDownloaded += stagingOffset;
      nextChunkIndex += 1;
      stagingOffset = 0;
      item = {
        ...item,
        totalBytes,
        bytesDownloaded,
        completedUnits: nextChunkIndex,
        totalUnits: totalBytes > 0 ? Math.ceil(totalBytes / MP4_CHUNK_BYTES) : nextChunkIndex,
        progress:
          totalBytes > 0
            ? Math.min(99, Math.round((bytesDownloaded / totalBytes) * 100))
            : Math.min(95, nextChunkIndex * 2),
      };
      await this.saveItem(item);
      lastUiUpdateAt = Date.now();
    };

    try {
      while (true) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        let offset = 0;
        while (offset < value.byteLength) {
          const space = MP4_CHUNK_BYTES - stagingOffset;
          const take = Math.min(space, value.byteLength - offset);
          staging.set(value.subarray(offset, offset + take), stagingOffset);
          stagingOffset += take;
          offset += take;

          if (stagingOffset === MP4_CHUNK_BYTES) {
            await flushStaging();
          }
        }

        const now = Date.now();
        if (now - lastUiUpdateAt > 550) {
          lastUiUpdateAt = now;
          const liveBytes = bytesDownloaded + stagingOffset;
          item = {
            ...item,
            totalBytes,
            bytesDownloaded: liveBytes,
            progress:
              totalBytes > 0
                ? Math.min(99, Math.round((liveBytes / totalBytes) * 100))
                : item.progress,
          };
          await this.saveItem(item);
        }
      }

      await flushStaging();
    } finally {
      reader.releaseLock();
    }

    if (nextChunkIndex === 0) {
      throw new Error('Stream returned zero media bytes.');
    }

    return {
      ...item,
      mimeType: contentType.startsWith('video/') ? contentType : 'video/mp4',
      bytesDownloaded,
      totalBytes: Math.max(totalBytes, bytesDownloaded),
      completedUnits: nextChunkIndex,
      totalUnits: nextChunkIndex,
    };
  }

  private async downloadAndEncryptHls(
    item: OfflineDownloadItem,
    signal: AbortSignal
  ): Promise<OfflineDownloadItem> {
    let tasks: HlsSegmentTask[] = [];
    const existingManifestChunk = await getChunkRecord(item.id, 'manifest');

    const db = await openVaultDb();
    try {
      const tx = db.transaction(VAULT_HLS_META_STORE, 'readonly');
      const existingMeta = await idbRequest<HlsMetaRecord | undefined>(
        tx.objectStore(VAULT_HLS_META_STORE).get(item.id)
      );
      if (existingMeta?.tasks?.length && existingManifestChunk) {
        tasks = existingMeta.tasks;
      }
    } finally {
      db.close();
    }

    if (tasks.length === 0) {
      const plan = await resolveHlsMediaPlaylistPlan(item.sourceUrl, item.id, signal);
      tasks = plan.tasks;

      const manifestBytes = new TextEncoder().encode(plan.rewrittenPlaylist);
      const manifestBuf = new ArrayBuffer(manifestBytes.byteLength);
      new Uint8Array(manifestBuf).set(manifestBytes);
      await encryptAndStoreUnit(item.id, 'manifest', manifestBuf);

      const metaDb = await openVaultDb();
      try {
        const tx = metaDb.transaction(VAULT_HLS_META_STORE, 'readwrite');
        tx.objectStore(VAULT_HLS_META_STORE).put({ downloadId: item.id, tasks });
        await idbTxComplete(tx);
      } finally {
        metaDb.close();
      }
    }

    let completedCount = 0;
    let totalBytesDownloaded = 0;
    const pendingTasks: HlsSegmentTask[] = [];

    for (const task of tasks) {
      const stored = await getChunkRecord(item.id, task.unitId);
      if (stored) {
        completedCount += 1;
        totalBytesDownloaded += stored.byteLength;
      } else {
        pendingTasks.push(task);
      }
    }

    const totalUnits = tasks.length;
    item = {
      ...item,
      completedUnits: completedCount,
      totalUnits,
      bytesDownloaded: totalBytesDownloaded,
      progress: totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0,
    };
    await this.saveItem(item);

    let cursor = 0;
    let lastSaveAt = Date.now();
    const concurrency = 3;

    const worker = async () => {
      while (cursor < pendingTasks.length) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const idx = cursor;
        cursor += 1;
        const task = pendingTasks[idx];
        const headers: Record<string, string> = {};
        if (task.rangeHeader) headers['Range'] = task.rangeHeader;

        const segRes = await fetch(task.url, { headers, signal });
        if (!segRes.ok) {
          throw new Error(`HLS segment failed (HTTP ${segRes.status})`);
        }
        const buf = await segRes.arrayBuffer();
        if (buf.byteLength === 0) {
          throw new Error('HLS segment returned empty media data');
        }
        await encryptAndStoreUnit(item.id, task.unitId, buf);
        completedCount += 1;
        totalBytesDownloaded += buf.byteLength;

        const avgBytes = completedCount > 0 ? totalBytesDownloaded / completedCount : 0;
        const estimatedTotal = Math.round(avgBytes * totalUnits);

        const now = Date.now();
        if (now - lastSaveAt > 450 || completedCount === totalUnits) {
          lastSaveAt = now;
          item = {
            ...item,
            completedUnits: completedCount,
            totalUnits,
            bytesDownloaded: totalBytesDownloaded,
            totalBytes: estimatedTotal,
            progress: Math.min(99, Math.round((completedCount / totalUnits) * 100)),
          };
          await this.saveItem(item);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, pendingTasks.length) }, () => worker())
    );

    return {
      ...item,
      completedUnits: totalUnits,
      totalUnits,
      bytesDownloaded: totalBytesDownloaded,
      totalBytes: totalBytesDownloaded,
    };
  }

  /**
   * Decrypts an encrypted MP4 vault entry inside app memory ONLY and yields a temporary Blob URL.
   * Caller MUST revoke the Blob URL immediately upon closing playback.
   */
  async decryptMp4BlobUrl(downloadId: string): Promise<string> {
    const item = await this.getDownloadById(downloadId);
    if (!item || item.status !== 'completed') {
      throw new Error('Encrypted offline media is incomplete or unavailable.');
    }
    const buffers: ArrayBuffer[] = [];
    for (let i = 0; i < item.completedUnits; i += 1) {
      const plain = await decryptStoredUnit(downloadId, `chunk-${i}`);
      buffers.push(plain);
    }
    const blob = new Blob(buffers, { type: item.mimeType || 'video/mp4' });
    return URL.createObjectURL(blob);
  }

  async decryptHlsManifestText(downloadId: string): Promise<string> {
    const buf = await decryptStoredUnit(downloadId, 'manifest');
    return new TextDecoder().decode(buf);
  }

  async decryptHlsUnit(downloadId: string, unitId: string): Promise<ArrayBuffer> {
    return decryptStoredUnit(downloadId, unitId);
  }

  async decryptOfflineSubtitles(
    downloadId: string
  ): Promise<Array<{ id: string; label: string; language: string; blobUrl: string }>> {
    const item = await this.getDownloadById(downloadId);
    if (!item?.subtitles?.length) return [];
    const out: Array<{ id: string; label: string; language: string; blobUrl: string }> = [];
    for (let i = 0; i < item.subtitles.length; i += 1) {
      const meta = item.subtitles[i];
      try {
        const plain = await decryptStoredUnit(downloadId, `sub-${i}`);
        const blob = new Blob([plain], { type: 'text/vtt' });
        out.push({
          id: meta.id,
          label: meta.label,
          language: meta.language,
          blobUrl: URL.createObjectURL(blob),
        });
      } catch {
        // Ignore missing/corrupted subtitle chunk
      }
    }
    return out;
  }
}

export const offlineDownloadService = new OfflineDownloadService();
