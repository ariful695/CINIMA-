import { LiveChannel, M3UPlaylistSource } from '../types/media';

export const BUILTIN_SAMPLE_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="StarSports2Telugu.in@HD" tvg-name="Star Sports 2 Telugu HD" tvg-logo="https://i.imgur.com/m7DvvqF.png" group-title="Sports",Star Sports 2 Telugu HD
https://real-vk.proxy.nellaiiptv.com/SDMEDIA/index.m3u8
#EXTINF:-1 tvg-id="DDSports.in@SD" tvg-name="DD Sports" tvg-logo="https://dtil.tmsimg.com/assets/s158255_ld_h15_aa.png?lock=720x540" group-title="Sports",DD Sports (1080p)
https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8
#EXTINF:-1 tvg-id="MSports.pk@SD" tvg-name="M Sports" tvg-logo="https://msports.pk/wp-content/uploads/2026/02/m-sports-300.png" group-title="Sports",M Sports (1080p)
https://cdn.rabta.stream/M-Sports/index.m3u8
#EXTINF:-1 tvg-id="mux-news-1" tvg-name="[Demo Loop] Mux Test Stream" group-title="Demo Feeds",[Demo Loop] Mux Test Stream (HLS)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="nasa-tv" tvg-name="NASA TV Public Live" group-title="Science",NASA TV Public Live
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8
#EXTINF:-1 tvg-id="redbull-sports" tvg-name="Red Bull TV Live" group-title="Sports",Red Bull TV Live
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8
#EXTINF:-1 tvg-id="bipbop-sports" tvg-name="[Demo Feed] Apple BipBop fMP4" group-title="Demo Feeds",[Demo Feed] Apple BipBop fMP4
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 tvg-id="sintel-ent" tvg-name="[Demo Loop] Mux PTS Shift" group-title="Demo Feeds",[Demo Loop] Mux PTS Shift
https://test-streams.mux.dev/pts_shift/master.m3u8
#EXTINF:-1 tvg-id="tears-movies" tvg-name="[Demo Feed] Tears of Steel" group-title="Demo Feeds",[Demo Feed] Tears of Steel (Unified Demo)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
#EXTINF:-1 tvg-id="bbb-ent" tvg-name="[Demo Loop] Mux Test 001" group-title="Demo Feeds",[Demo Loop] Mux Test 001
https://test-streams.mux.dev/test_001/stream.m3u8
#EXTINF:-1 tvg-id="fmp4-ent" tvg-name="[Demo Feed] Apple BipBop 16x9" group-title="Demo Feeds",[Demo Feed] Apple BipBop 16x9
https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8
`;

function extractAttr(extinfLine: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = extinfLine.match(regex);
  return match?.[1]?.trim() || undefined;
}

function normalizeGroup(rawGroup?: string): string {
  const clean = rawGroup?.trim();
  if (!clean) return 'General';
  return clean;
}

export function parseM3UContent(
  content: string,
  playlistId: string,
  playlistName: string
): LiveChannel[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: LiveChannel[] = [];
  const seenUrls = new Set<string>();
  let pendingMeta: {
    name: string;
    group: string;
    logo?: string;
    tvgId?: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.lastIndexOf(',');
      const displayName =
        commaIndex !== -1 ? line.slice(commaIndex + 1).trim() : '';
      const tvgName = extractAttr(line, 'tvg-name');
      const tvgLogo = extractAttr(line, 'tvg-logo');
      const tvgId = extractAttr(line, 'tvg-id');
      const groupTitle = extractAttr(line, 'group-title');

      pendingMeta = {
        name: displayName || tvgName || `Channel ${channels.length + 1}`,
        group: normalizeGroup(groupTitle),
        logo: tvgLogo,
        tvgId,
      };
    } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      if (!seenUrls.has(line)) {
        seenUrls.add(line);
        const idBase = pendingMeta?.tvgId || `${playlistId}-${channels.length + 1}`;
        channels.push({
          id: `${playlistId}::${idBase}::${channels.length}`,
          name: pendingMeta?.name || `Live Stream ${channels.length + 1}`,
          group: pendingMeta?.group || 'Entertainment',
          logo: pendingMeta?.logo,
          streamUrl: line,
          playlistId,
          playlistName,
          isLive: true,
        });
      }
      pendingMeta = null;
    }
  }

  return channels;
}

export const m3uParserService = {
  async loadPlaylistChannels(playlist: M3UPlaylistSource): Promise<{
    channels: LiveChannel[];
    error?: string;
  }> {
    if (!playlist.enabled) {
      return { channels: [] };
    }

    if (playlist.url === 'builtin://open-channels.m3u') {
      return {
        channels: parseM3UContent(BUILTIN_SAMPLE_M3U, playlist.id, playlist.name),
      };
    }

    if (playlist.rawContent && playlist.rawContent.trim().length > 0) {
      const channels = parseM3UContent(
        playlist.rawContent,
        playlist.id,
        playlist.name
      );
      return { channels };
    }

    try {
      const fetchTarget = playlist.url.startsWith('/api/')
        ? playlist.url
        : `/api/proxy?url=${encodeURIComponent(playlist.url)}`;
      let response = await fetch(fetchTarget);
      if (!response.ok) {
        response = await fetch(playlist.url);
      }
      if (!response.ok) {
        return {
          channels: [],
          error: `Failed to fetch M3U playlist (HTTP ${response.status})`,
        };
      }
      const text = await response.text();
      const channels = parseM3UContent(text, playlist.id, playlist.name);
      return { channels };
    } catch {
      return {
        channels: [],
        error: 'Unable to fetch remote M3U URL (check CORS or network). You can paste raw #EXTM3U content instead.',
      };
    }
  },

  async loadAllEnabledPlaylists(playlists: M3UPlaylistSource[]): Promise<{
    channels: LiveChannel[];
    errors: Record<string, string>;
  }> {
    const enabled = playlists.filter((p) => p.enabled);
    const results = await Promise.all(
      enabled.map(async (pl) => ({
        playlistId: pl.id,
        ...(await this.loadPlaylistChannels(pl)),
      }))
    );

    const channels: LiveChannel[] = [];
    const errors: Record<string, string> = {};

    for (const result of results) {
      channels.push(...result.channels);
      if (result.error) {
        errors[result.playlistId] = result.error;
      }
    }

    return { channels, errors };
  },
};
