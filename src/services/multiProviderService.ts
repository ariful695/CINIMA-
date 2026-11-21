import {
  StreamResolutionResult,
  StreamSource,
  SubtitleTrack,
} from '../types/media';
import { IStreamProviderService, StreamQueryParams, streamProviderService } from './streamProviderService';
import { streamConnector } from './streamConnector';

/**
 * MultiProviderService implements strategy pattern / cycling through different scraping and streaming
 * strategies when primary providers fail or return invalid/unresolvable URLs.
 */
export class MultiProviderService implements IStreamProviderService {
  /**
   * Tries primary strategy (Direct AnikotoTV watch), falls back to search strategy,
   * custom endpoints, and secondary mirrors if needed.
   */
  async resolveMovieStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    const strategies: Array<() => Promise<StreamResolutionResult>> = [
      // Strategy 1: Primary Stream Connector (AnikotoTV direct & search mirrors)
      () => streamConnector.resolveMovieStreams(params),
      // Strategy 2: Base Stream Provider Service (Stremio, Dejavu, Custom endpoints, Trailers)
      () => streamProviderService.resolveMovieStreams(params),
    ];

    const allSources: StreamSource[] = [];
    const allSubtitles: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        for (const source of result.sources) {
          if (source.url && !seenUrls.has(source.url)) {
            seenUrls.add(source.url);
            allSources.push(source);
          }
        }
        for (const sub of result.subtitles || []) {
          if (!allSubtitles.some((s) => s.url === sub.url)) {
            allSubtitles.push(sub);
          }
        }
      } catch {
        // Continue to next strategy if current strategy fails
      }
    }

    if (allSources.length > 0 && !allSources.some((s) => s.isDefault)) {
      allSources[0].isDefault = true;
    }

    return {
      sources: allSources,
      subtitles: allSubtitles,
    };
  }

  async resolveEpisodeStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    const strategies: Array<() => Promise<StreamResolutionResult>> = [
      // Strategy 1: Primary Anime / TV Episode Connector (AnikotoTV S/E & search)
      () => streamConnector.resolveEpisodeStreams(params),
      // Strategy 2: Base Stream Provider Service (Stremio, Dejavu, Custom endpoints)
      () => streamProviderService.resolveEpisodeStreams(params),
    ];

    const allSources: StreamSource[] = [];
    const allSubtitles: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        for (const source of result.sources) {
          if (source.url && !seenUrls.has(source.url)) {
            seenUrls.add(source.url);
            allSources.push(source);
          }
        }
        for (const sub of result.subtitles || []) {
          if (!allSubtitles.some((s) => s.url === sub.url)) {
            allSubtitles.push(sub);
          }
        }
      } catch {
        // Continue to next strategy
      }
    }

    if (allSources.length > 0 && !allSources.some((s) => s.isDefault)) {
      allSources[0].isDefault = true;
    }

    return {
      sources: allSources,
      subtitles: allSubtitles,
    };
  }
}

export const multiProviderService = new MultiProviderService();
