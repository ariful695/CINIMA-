import { LiveChannel } from '../types/media';

const streamProbeCache = new Map<string, boolean>();

/**
 * Deep browser CORS HLS check: verifies master #EXTM3U, first variant playlist if adaptive,
 * and confirms the first media segment (.ts / .m4s) responds with HTTP 200 or 206 via Range probe.
 */
export async function probeChannelPlayableInBrowser(
  streamUrl: string,
  timeoutMs = 3500
): Promise<boolean> {
  if (!streamUrl.startsWith('https://')) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const probeFirstSegment = async (mediaPlaylistText: string, playlistBaseUrl: string): Promise<boolean> => {
    const segmentLine = mediaPlaylistText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    if (!segmentLine) return false;

    const segmentUrl = new URL(segmentLine, playlistBaseUrl).toString();
    const segRes = await fetch(segmentUrl, {
      method: 'GET',
      mode: 'cors',
      headers: { Range: 'bytes=0-1023' },
      signal: controller.signal,
    });
    return segRes.status === 200 || segRes.status === 206;
  };

  try {
    const response = await fetch(streamUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      return false;
    }

    const bodyText = await response.text();
    if (!bodyText.includes('#EXTM3U')) {
      return contentType.startsWith('video/');
    }

    if (bodyText.includes('#EXT-X-STREAM-INF')) {
      const lines = bodyText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      const firstVariant = lines[0];
      if (!firstVariant) return false;

      const resolvedVariantUrl = new URL(firstVariant, response.url || streamUrl).toString();
      const variantRes = await fetch(resolvedVariantUrl, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      if (!variantRes.ok) return false;
      const variantText = await variantRes.text();
      if (!variantText.includes('#EXTM3U') || !variantText.includes('#EXTINF')) return false;
      return probeFirstSegment(variantText, variantRes.url || resolvedVariantUrl);
    }

    if (!bodyText.includes('#EXTINF')) return false;
    return probeFirstSegment(bodyText, response.url || streamUrl);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function probeChannelsBatch(
  channels: LiveChannel[],
  onBatchComplete: (results: Record<string, boolean>) => void,
  concurrency = 6
): Promise<void> {
  for (let i = 0; i < channels.length; i += concurrency) {
    const slice = channels.slice(i, i + concurrency);
    const settled = await Promise.all(
      slice.map(async (ch) => {
        const ok = await probeChannelPlayableInBrowser(ch.streamUrl);
        streamProbeCache.set(ch.streamUrl, ok);
        return {
          id: ch.id,
          playable: ok,
        };
      })
    );

    const map: Record<string, boolean> = {};
    for (const item of settled) {
      map[item.id] = item.playable;
    }
    onBatchComplete(map);
  }
}

export function clearIptvParserCache(): void {
  streamProbeCache.clear();
}

export const iptvParser = {
  probeChannelPlayableInBrowser,
  probeChannelsBatch,
  clearCache: clearIptvParserCache,
};
