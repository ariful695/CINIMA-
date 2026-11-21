import {
  StreamResolutionResult,
  StreamSource,
  SubtitleTrack,
} from '../types/media';
import { IStreamProviderService, StreamQueryParams } from './streamProviderService';

/**
 * ProxyServerService utilizes a configurable CORS-proxy middleware to fetch data
 * from streaming sites that restrict client-side cross-origin requests.
 */
export class ProxyServerService {
  private corsProxyUrl: string = '/api/proxy?url=';

  setProxyUrl(url: string) {
    this.corsProxyUrl = url;
  }

  getProxyUrl(): string {
    return this.corsProxyUrl;
  }

  async fetchViaProxy(targetUrl: string): Promise<string> {
    const proxyEndpoint = `${this.corsProxyUrl}${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyEndpoint);
    if (!response.ok) {
      throw new Error(`Proxy fetch failed with status ${response.status}`);
    }
    return await response.text();
  }

  async fetchJsonViaProxy<T>(targetUrl: string): Promise<T> {
    const text = await this.fetchViaProxy(targetUrl);
    return JSON.parse(text) as T;
  }
}

export const proxyServerService = new ProxyServerService();

function slugify(title: string): string {
  return (title || 'media')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class StreamConnectorService implements IStreamProviderService {
  /**
   * Resolves movie streams using https://anikototv.bz/ with direct watch and keyword search mirrors
   */
  async resolveMovieStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    const slug = slugify(params.title);
    const watchUrl = `https://anikototv.bz/watch/${slug}`;
    const searchUrl = `https://anikototv.bz/search?keyword=${encodeURIComponent(params.title)}`;

    const sources: StreamSource[] = [
      {
        id: `anikototv-movie-${params.tmdbId}`,
        providerName: 'AnikotoTV Direct',
        label: `AnikotoTV · ${params.title}`,
        quality: '1080p HD',
        url: watchUrl,
        format: 'embed',
        note: 'Direct watch page on anikototv.bz via proxy',
        isDefault: true,
        isDirectPlayable: true,
      },
      {
        id: `anikototv-search-${params.tmdbId}`,
        providerName: 'AnikotoTV Search',
        label: `AnikotoTV Search · ${params.title}`,
        quality: 'Keyword Match',
        url: searchUrl,
        format: 'embed',
        note: 'Search on anikototv.bz via proxy',
        isDefault: false,
        isDirectPlayable: true,
      },
    ];

    return {
      sources,
      subtitles: [],
    };
  }

  /**
   * Resolves episode streams for TV series and anime using https://anikototv.bz/
   */
  async resolveEpisodeStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    const slug = slugify(params.title);
    const season = params.seasonNumber || 1;
    const episode = params.episodeNumber || 1;
    
    const episodeUrl = `https://anikototv.bz/watch/${slug}-season-${season}/ep-${episode}`;
    const searchQuery = `${params.title} Season ${season} Episode ${episode}`;
    const searchUrl = `https://anikototv.bz/search?keyword=${encodeURIComponent(searchQuery)}`;

    const sources: StreamSource[] = [
      {
        id: `anikototv-episode-${params.tmdbId}-${season}-${episode}`,
        providerName: 'AnikotoTV Anime Hub',
        label: `AnikotoTV · S${season} E${episode}`,
        quality: '1080p HD',
        url: episodeUrl,
        format: 'embed',
        note: 'Direct episode watch page on anikototv.bz via proxy',
        isDefault: true,
        isDirectPlayable: true,
      },
      {
        id: `anikototv-search-${params.tmdbId}-${season}-${episode}`,
        providerName: 'AnikotoTV Search',
        label: `AnikotoTV Search · S${season} E${episode}`,
        quality: 'Keyword Match',
        url: searchUrl,
        format: 'embed',
        note: 'Search on anikototv.bz via proxy',
        isDefault: false,
        isDirectPlayable: true,
      },
    ];

    return {
      sources,
      subtitles: [],
    };
  }
}

export const streamConnector = new StreamConnectorService();
