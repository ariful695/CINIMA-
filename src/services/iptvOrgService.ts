import { LiveChannel } from '../types/media';
import { clearIptvParserCache } from './iptvParser';

export const iptvOrgService = {
  async fetchRegionChannels(
    _regionCode?: string,
    _forceRefresh = false
  ): Promise<{ channels: LiveChannel[]; error?: string }> {
    return { channels: [] };
  },

  clearCache(): void {
    clearIptvParserCache();
  },
};
