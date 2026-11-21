import { LiveChannel } from '../types/media';
import {
  clearIptvParserCache,
  fetchAndParseIptvM3u,
  getMasterIptvUrl,
  iptvParser,
} from './iptvParser';

export interface IptvRegionOption {
  code: string;
  label: string;
  url: string;
}

const getIptvConfig = () => ({
  masterIndexUrl: getMasterIptvUrl(),
  indexCategoryUrl:
    window.__KINO_API_CONFIG__?.iptvOrg?.indexCategoryUrl ||
    'https://iptv-org.github.io/iptv/index.category.m3u',
  categoryBaseUrl:
    window.__KINO_API_CONFIG__?.iptvOrg?.categoryBaseUrl ||
    'https://iptv-org.github.io/iptv/categories',
  countryBaseUrl:
    window.__KINO_API_CONFIG__?.iptvOrg?.countryBaseUrl ||
    'https://iptv-org.github.io/iptv/countries',
});

export function getIptvRegions(): IptvRegionOption[] {
  const cfg = getIptvConfig();
  return [
    { code: 'master', label: 'Master Index (iptv-org Global)', url: cfg.masterIndexUrl },
    { code: 'global', label: 'Category Index (iptv-org)', url: cfg.indexCategoryUrl },
    { code: 'us', label: 'United States (US)', url: `${cfg.countryBaseUrl}/us.m3u` },
    { code: 'gb', label: 'United Kingdom (GB)', url: `${cfg.countryBaseUrl}/gb.m3u` },
    { code: 'in', label: 'India (IN)', url: `${cfg.countryBaseUrl}/in.m3u` },
    { code: 'bd', label: 'Bangladesh (BD)', url: `${cfg.countryBaseUrl}/bd.m3u` },
    { code: 'ca', label: 'Canada (CA)', url: `${cfg.countryBaseUrl}/ca.m3u` },
    { code: 'au', label: 'Australia (AU)', url: `${cfg.countryBaseUrl}/au.m3u` },
    { code: 'jp', label: 'Japan (JP)', url: `${cfg.countryBaseUrl}/jp.m3u` },
    { code: 'kr', label: 'South Korea (KR)', url: `${cfg.countryBaseUrl}/kr.m3u` },
    { code: 'de', label: 'Germany (DE)', url: `${cfg.countryBaseUrl}/de.m3u` },
    { code: 'fr', label: 'France (FR)', url: `${cfg.countryBaseUrl}/fr.m3u` },
    { code: 'es', label: 'Spain (ES)', url: `${cfg.countryBaseUrl}/es.m3u` },
    { code: 'br', label: 'Brazil (BR)', url: `${cfg.countryBaseUrl}/br.m3u` },
    { code: 'custom', label: 'Custom M3U Playlists Only', url: '' },
  ];
}

export const iptvOrgService = {
  async fetchRegionChannels(
    regionCode: string,
    forceRefresh = false
  ): Promise<{ channels: LiveChannel[]; error?: string }> {
    if (regionCode === 'custom') {
      return { channels: [] };
    }

    if (regionCode === 'master') {
      const result = await iptvParser.fetchMasterChannels(forceRefresh);
      return {
        channels: result.channels,
        error: result.error,
      };
    }

    const regions = getIptvRegions();
    const target = regions.find((r) => r.code === regionCode) || regions[0];
    if (!target.url) return { channels: [] };

    const result = await fetchAndParseIptvM3u({
      url: target.url,
      playlistId: `iptv-org-${target.code}`,
      playlistName: `iptv-org · ${target.code.toUpperCase()}`,
      forceRefresh,
    });

    return {
      channels: result.channels,
      error: result.error,
    };
  },

  clearCache(): void {
    clearIptvParserCache();
  },
};
