import { StreamSource } from '../types/media';
import { StreamQueryParams } from './streamProviderService';
import { cloudStreamRepoService } from './cloudStreamRepoService';
import { storageService } from './storageService';

/**
 * Maps downloaded CloudStream plugins onto genuine, compatible resolved streams
 * without mislabeling audio languages or promoting broken/unverified mirrors.
 */
export const cloudStreamProviderResolver = {
  resolveStreams(
    params: StreamQueryParams,
    candidateSources: StreamSource[] = []
  ): StreamSource[] {
    if (!storageService.isProviderToggleEnabled('cloudstream')) {
      return [];
    }

    const repos = cloudStreamRepoService.getRepositories();
    const defaultIds = new Set(['cspr', 'phisher', 'megix', 'mega', 'dogior', 'cskarma']);
    // Prioritize newly added / custom CloudStream repositories before built-in defaults
    const orderedRepos = [
      ...repos.filter((r) => !defaultIds.has(r.id)),
      ...repos.filter((r) => defaultIds.has(r.id)),
    ];

    const isAnimeMedia =
      Boolean(params.genreIds?.includes(16)) || params.originalLanguage === 'ja';
    const isCompatiblePluginType = (provType: string): boolean => {
      if (provType === 'Livestream') return false;
      if (provType === 'Others') return true;
      if (provType === 'Anime') return isAnimeMedia;
      if (params.mediaType === 'tv') {
        // Most general CloudStream movie plugins also carry series, except explicitly Movies-only if enough Series plugins exist
        return provType === 'Series' || provType === 'Movies';
      }
      return provType === 'Movies' || provType === 'Series';
    };

    const downloadedPlugins: string[] = [];
    const seenPlugins = new Set<string>();
    // First pass: exact type match (Series for tv, Movies for movie, Anime for anime)
    for (const repo of orderedRepos) {
      for (const prov of repo.providers) {
        if (!prov.downloaded || !isCompatiblePluginType(prov.type)) continue;
        const exactMatch =
          (params.mediaType === 'tv' && prov.type === 'Series') ||
          (params.mediaType === 'movie' && prov.type === 'Movies') ||
          (isAnimeMedia && prov.type === 'Anime') ||
          prov.type === 'Others';
        if (exactMatch && !seenPlugins.has(prov.name.toLowerCase())) {
          seenPlugins.add(prov.name.toLowerCase());
          downloadedPlugins.push(prov.name);
        }
      }
    }
    // Second pass: remaining multi-type downloaded plugins
    for (const repo of orderedRepos) {
      for (const prov of repo.providers) {
        if (!prov.downloaded || !isCompatiblePluginType(prov.type)) continue;
        if (!seenPlugins.has(prov.name.toLowerCase())) {
          seenPlugins.add(prov.name.toLowerCase());
          downloadedPlugins.push(prov.name);
        }
      }
    }

    if (downloadedPlugins.length === 0 || candidateSources.length === 0) {
      return [];
    }

    const allPlayable = candidateSources.filter(
      (s) =>
        s.format !== 'youtube' &&
        s.format !== 'embed' &&
        (s.isVerified !== false || s.url.startsWith('/api/'))
    );
    const eligibleCandidates = candidateSources.filter(
      (s) =>
        s.format !== 'youtube' &&
        s.format !== 'embed' &&
        s.isVerified !== false &&
        s.isDirectPlayable !== false
    );
    const pool = eligibleCandidates.length > 0 ? eligibleCandidates : allPlayable;

    if (pool.length === 0 && allPlayable.length === 0) {
      return [];
    }

    const cloudStreamSources: StreamSource[] = [];
    const usedCandidateIds = new Set<string>();
    const seenDedupeKeys = new Set<string>();

    const pickCandidate = (
      predicate: (s: StreamSource) => boolean,
      sourcePool: StreamSource[] = pool
    ): StreamSource | null => {
      const fresh = sourcePool.find((s) => !usedCandidateIds.has(s.id) && predicate(s));
      if (fresh) {
        usedCandidateIds.add(fresh.id);
        return fresh;
      }
      return null;
    };

    const isTamil = (s: StreamSource) =>
      /\btamil\b/i.test(`${s.audioLanguage || ''} ${s.label}`);
    const isTelugu = (s: StreamSource) =>
      /\btelugu\b/i.test(`${s.audioLanguage || ''} ${s.label}`);
    const isHindi = (s: StreamSource) =>
      /\b(hindi|hin)\b|🇮🇳/i.test(`${s.audioLanguage || ''} ${s.label}`) ||
      /desiflix/i.test(s.providerName || '');
    const isDualHindi = (s: StreamSource) =>
      /dual|multi|\+/i.test(s.audioLanguage || '') &&
      /\bhindi\b/i.test(`${s.audioLanguage || ''} ${s.label}`);
    const isAnime = (s: StreamSource) =>
      /anime|sub|dub|japanese|korean|chinese/i.test(
        `${s.audioLanguage || ''} ${s.label} ${s.providerName}`
      );
    const isP2P = (s: StreamSource) =>
      s.url.includes('/api/torrent/stream') || (s.seeders !== undefined && s.seeders > 0);
    const isHls = (s: StreamSource) => s.format === 'hls' || s.url.includes('.m3u8');

    const cappedPlugins = downloadedPlugins.slice(0, 36);
    for (const pluginName of cappedPlugins) {
      const lower = pluginName.toLowerCase();
      let matchedCandidate: StreamSource | null = null;

      if (lower.includes('tamil')) {
        matchedCandidate = pickCandidate(isTamil, allPlayable);
      } else if (lower.includes('telugu')) {
        matchedCandidate = pickCandidate(isTelugu, allPlayable);
      } else if (
        lower.includes('multimovies') ||
        lower.includes('desiflix') ||
        lower.includes('filmy') ||
        lower.includes('hdhub4u') ||
        lower.includes('desicinemas') ||
        lower.includes('hindmoviez')
      ) {
        matchedCandidate =
          pickCandidate(isHindi, allPlayable) ||
          pickCandidate(isDualHindi, allPlayable);
      } else if (
        lower.includes('superstream') ||
        lower.includes('streamplay') ||
        lower.includes('moviebox') ||
        lower.includes('showbox') ||
        lower.includes('netmirror') ||
        lower.includes('vidrock') ||
        lower.includes('castle')
      ) {
        matchedCandidate =
          pickCandidate((s) => isHls(s) && !isP2P(s)) ||
          pickCandidate((s) => !isP2P(s));
      } else if (
        lower.includes('yts') ||
        lower.includes('torrentio') ||
        lower.includes('torrastream') ||
        lower.includes('stremiox')
      ) {
        matchedCandidate =
          pickCandidate(isP2P) ||
          pickCandidate((s) => s.format === 'mp4');
      } else if (
        lower.includes('animedekho') ||
        lower.includes('animepahe') ||
        lower.includes('hianime') ||
        lower.includes('aniwatch') ||
        lower.includes('animezone') ||
        lower.includes('animekai')
      ) {
        matchedCandidate = pickCandidate(isAnime);
      } else {
        matchedCandidate =
          pickCandidate((s) => isHls(s) && !isP2P(s)) ||
          pickCandidate((s) => s.format === 'mp4' && !isP2P(s));
      }

      if (matchedCandidate) {
        const langKey = (matchedCandidate.audioLanguage || '').trim().toLowerCase();
        const dedupeKey = `${matchedCandidate.url}::${langKey}`;
        if (seenDedupeKeys.has(dedupeKey)) {
          continue;
        }
        seenDedupeKeys.add(dedupeKey);

        cloudStreamSources.push({
          ...matchedCandidate,
          id: `cs-${lower.replace(/[^a-z0-9]/g, '')}-${matchedCandidate.id}`,
          providerName: matchedCandidate.providerName,
          extensionName: pluginName,
          note: matchedCandidate.note
            ? `${matchedCandidate.note} · ${pluginName}`
            : `CloudStream (${pluginName})`,
          isDefault: false,
        });
      }
    }

    return cloudStreamSources;
  },
};
