import { LiveChannel } from '../types/media';

export interface LiveTvAddonSource {
  id: string;
  name: string;
  manifestUrl: string;
  category: string;
}

export const VERIFIED_LIVE_TV_ADDONS: LiveTvAddonSource[] = [
  {
    id: 'all-iptv',
    name: 'All IPTV Global & Sports',
    manifestUrl: 'https://fun.lnpx.workers.dev/manifest.json',
    category: 'Sports',
  },
  {
    id: 'nuvio-live-sports',
    name: 'Nuvio Live Sports',
    manifestUrl: 'https://nuviosports.xyz/manifest.json',
    category: 'Sports',
  },
  {
    id: 'fayatv',
    name: 'FayaTV Live & Sports',
    manifestUrl: 'https://fayatv.stravo.site/d/manifest.json',
    category: 'Entertainment',
  },
  {
    id: 'pluto-tv',
    name: 'Pluto TV',
    manifestUrl: 'https://dev.nebulawp.org/stremio/pluto-tv-addon/manifest.json',
    category: 'Entertainment',
  },
  {
    id: 'cncverse-tv',
    name: 'CNCVerse Live TV & Sports',
    manifestUrl: 'https://cncverse.dpdns.org/manifest.json',
    category: 'Sports',
  },
  {
    id: 'watchio-tv',
    name: 'Watchio.live TV',
    manifestUrl: 'https://watchio-addon.pages.dev/manifest.json',
    category: 'General',
  },
  {
    id: 'tvvio',
    name: 'Tvvio',
    manifestUrl: 'https://tvvio.megaembed-frost.workers.dev/manifest.json',
    category: 'Entertainment',
  },
  {
    id: 'argentina-tv',
    name: 'Argentina TV',
    manifestUrl: 'https://peerflix.mov/manifest.json',
    category: 'News',
  },
];

export const CURATED_INDIAN_SPORTS_CHANNELS: LiveChannel[] = [
  {
    id: 'curated-starsports-2-telugu',
    name: 'Star Sports 2 Telugu HD',
    group: 'Sports',
    logo: 'https://lo1.in/ind/starsp2.png',
    streamUrl: '/api/stream-proxy?url=https%3A%2F%2Freal-vk.proxy.nellaiiptv.com%2FSDMEDIA%2Findex.m3u8',
    playlistId: 'curated-sports-pack',
    playlistName: 'Star & Sony Sports Network',
    language: 'Telugu',
    country: 'IN',
    isLive: true,
  },
  {
    id: 'curated-sonysports-ten-3-hindi',
    name: 'Sony Sports Ten 3 HD (Hindi)',
    group: 'Sports',
    logo: 'https://lo1.in/pk/so.png',
    streamUrl: '/api/stream-proxy?url=https%3A%2F%2Fr2.amml.in%2Fsony-ten-3-hd%2Flive.m3u8',
    playlistId: 'curated-sports-pack',
    playlistName: 'Star & Sony Sports Network',
    language: 'Hindi',
    country: 'IN',
    isLive: true,
  },
  {
    id: 'curated-dd-sports',
    name: 'DD Sports HD',
    group: 'Sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/DD_Sports_2023_logo.svg/320px-DD_Sports_2023_logo.svg.png',
    streamUrl: '/api/stream-proxy?url=https%3A%2F%2Fd3qs3d2rkhfqrt.cloudfront.net%2Fout%2Fv1%2Fb17adfe543354fdd8d189b110617cddd%2Findex.m3u8',
    playlistId: 'curated-sports-pack',
    playlistName: 'Star & Sony Sports Network',
    language: 'Hindi',
    country: 'IN',
    isLive: true,
  },
  {
    id: 'curated-m-sports',
    name: 'M Sports HD',
    group: 'Sports',
    logo: 'https://msports.pk/wp-content/uploads/2026/02/m-sports-300.png',
    streamUrl: '/api/stream-proxy?url=https%3A%2F%2Fcdn.rabta.stream%2FM-Sports%2Findex.m3u8',
    playlistId: 'curated-sports-pack',
    playlistName: 'Star & Sony Sports Network',
    language: 'English',
    country: 'PK',
    isLive: true,
  },
];

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function resolveStremioLiveStreamUrl(
  proxiedStreamJsonUrl: string
): Promise<string | null> {
  if (!proxiedStreamJsonUrl.includes('/stream/')) return proxiedStreamJsonUrl;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(proxiedStreamJsonUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { streams?: Array<{ url?: string; externalUrl?: string }> };
    const found = data.streams?.find((st) => {
      const candidate = st.url || st.externalUrl;
      return Boolean(candidate && /^https?:\/\//i.test(candidate));
    });
    return found ? found.url || found.externalUrl || null : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export const liveTvAddonService = {
  resolveStremioLiveStreamUrl,

  async fetchAllAddonChannels(): Promise<LiveChannel[]> {
    const allChannels: LiveChannel[] = [...CURATED_INDIAN_SPORTS_CHANNELS];
    const proxyBase = '/api/proxy?url=';

    await Promise.allSettled(
      VERIFIED_LIVE_TV_ADDONS.map(async (addon) => {
        try {
          const res = await fetchWithTimeout(
            proxyBase + encodeURIComponent(addon.manifestUrl),
            5000
          );
          if (!res.ok) return;
          const manifest = (await res.json()) as {
            catalogs?: Array<{ id: string; type: string; name: string }>;
          };
          if (!Array.isArray(manifest.catalogs)) return;

          const catalog =
            manifest.catalogs.find(
              (c) =>
                c.type === 'tv' ||
                c.type === 'channel' ||
                c.type === 'sports' ||
                c.type === 'live' ||
                c.id.includes('tv') ||
                c.id.includes('sport') ||
                c.id.includes('channel')
            ) || manifest.catalogs[0];

          if (!catalog) return;

          const baseUrl = addon.manifestUrl.replace(/\/manifest\.json.*$/, '');
          const catalogUrl = `${baseUrl}/catalog/${catalog.type || 'tv'}/${catalog.id}.json`;

          const catRes = await fetchWithTimeout(
            proxyBase + encodeURIComponent(catalogUrl),
            5000
          );
          if (!catRes.ok) return;
          const catJson = (await catRes.json()) as {
            metas?: Array<{
              id: string;
              name: string;
              poster?: string;
              logo?: string;
              genres?: string[];
            }>;
          };

          if (!Array.isArray(catJson.metas)) return;

          catJson.metas.forEach((meta, idx) => {
            if (!meta.id || !meta.name) return;
            const catType = catalog.type || 'tv';
            const streamUrl = `${baseUrl}/stream/${catType}/${encodeURIComponent(meta.id)}.json`;
            allChannels.push({
              id: `addon-${addon.id}-${meta.id}-${idx}`,
              name: meta.name.trim(),
              group: meta.genres?.[0] || addon.category,
              logo: meta.logo || meta.poster,
              streamUrl: proxyBase + encodeURIComponent(streamUrl),
              playlistId: addon.id,
              playlistName: addon.name,
              isLive: true,
            });
          });
        } catch {
          // Ignore individual addon failure
        }
      })
    );

    return allChannels;
  },
};
