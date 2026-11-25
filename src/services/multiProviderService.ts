import {
  StreamResolutionResult,
  StreamSource,
  SubtitleTrack,
} from '../types/media';
import { IStreamProviderService, StreamQueryParams, streamProviderService } from './streamProviderService';

/**
 * MultiProviderService implements strategy pattern / cycling through different scraping and streaming
 * strategies when primary providers fail or return invalid/unresolvable URLs.
 */
export class MultiProviderService implements IStreamProviderService {
  async resolveMovieStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    return streamProviderService.resolveMovieStreams(params);
  }

  async resolveEpisodeStreams(params: StreamQueryParams): Promise<StreamResolutionResult> {
    return streamProviderService.resolveEpisodeStreams(params);
  }
}

export const multiProviderService = new MultiProviderService();
