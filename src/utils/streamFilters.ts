import { StreamSource } from '../types/media';

export type SourceTypeFilter = 'all' | 'direct' | 'nuvio' | 'stremio' | 'cloudstream' | 'p2p';
export type QualityFilter = 'all' | '4k' | '1080p' | '720p' | '480p';
export type SortMode = 'recommended' | 'quality' | 'seeders';

export function extractLanguageTags(audioLanguage?: string): string[] {
  const raw = (audioLanguage || 'Original').trim();
  const lower = raw.toLowerCase();
  const tags: string[] = [];

  if (/\b(hindi|hin)\b/.test(lower)) tags.push('Hindi');
  if (/\b(bengali|bangla|ben)\b/.test(lower)) tags.push('Bengali');
  if (/\b(tamil|tam)\b/.test(lower)) tags.push('Tamil');
  if (/\b(telugu|tel)\b/.test(lower)) tags.push('Telugu');
  if (/\b(malayalam|mal)\b/.test(lower)) tags.push('Malayalam');
  if (/\b(kannada|kan)\b/.test(lower)) tags.push('Kannada');
  if (/\b(marathi|mar)\b/.test(lower)) tags.push('Marathi');
  if (/\b(punjabi|pan)\b/.test(lower)) tags.push('Punjabi');
  if (/\b(english|eng)\b/.test(lower)) tags.push('English');
  if (/\b(french|français|francais|vostfr)\b/.test(lower)) tags.push('French');
  if (/\b(japanese|jpn)\b/.test(lower)) tags.push('Japanese');
  if (/\b(korean|kor)\b/.test(lower)) tags.push('Korean');
  if (/\b(spanish|spa|esp)\b/.test(lower)) tags.push('Spanish');
  if (/\b(italian|ita)\b/.test(lower)) tags.push('Italian');
  if (/\b(portuguese|por)\b/.test(lower)) tags.push('Portuguese');
  if (/\b(german|deu|ger)\b/.test(lower)) tags.push('German');
  if (/\b(russian|rus)\b/.test(lower)) tags.push('Russian');
  if (/\b(ukrainian|ukr)\b/.test(lower)) tags.push('Ukrainian');
  if (/\b(arabic|ara)\b/.test(lower)) tags.push('Arabic');
  if (/\b(turkish|tur)\b/.test(lower)) tags.push('Turkish');
  if (/\b(indonesian|indo)\b/.test(lower)) tags.push('Indonesian');
  if (/\b(thai)\b/.test(lower)) tags.push('Thai');
  if (/\b(chinese|mandarin|cantonese)\b/.test(lower)) tags.push('Chinese');

  if (tags.length === 0) {
    const cleaned = raw.replace(/\s*\(?(multi[\s_-]?audio|dual[\s_-]?audio)\)?/gi, '').trim();
    tags.push(cleaned || 'Original');
  }
  return tags;
}

export function getCanonicalProviderName(source: StreamSource): string {
  if (source.extensionName?.trim()) {
    return source.extensionName.trim();
  }
  const raw = (source.providerName || 'Server').trim();
  return (
    raw
      .replace(/\s*\(Nuvio\)\s*$/i, '')
      .replace(/\s*\(Direct HTTP\)\s*$/i, '')
      .replace(/\s*\(Hindi\s*&\s*Multi(?:-Audio)?\)\s*$/i, '')
      .replace(/\s*\(Public Stream Addon\)\s*$/i, '')
      .trim() || raw
  );
}

export function getSourceFlags(source: StreamSource) {
  const isP2P = source.url.includes('/api/torrent/stream');
  const isCS = Boolean(source.extensionName) || source.id.startsWith('cs-');
  const isNuvio = source.id.startsWith('nuvio-') && !isCS;
  const isStremio = source.id.startsWith('stremio-') && !isCS;
  const isDirectInstant =
    !isP2P &&
    !source.url.includes('remux=1') &&
    source.format !== 'embed' &&
    source.format !== 'youtube' &&
    !isCS;

  return { isP2P, isCS, isNuvio, isStremio, isDirectInstant };
}

export function matchesSourceTypeFilter(
  source: StreamSource,
  filter: SourceTypeFilter
): boolean {
  if (filter === 'all') return true;
  const flags = getSourceFlags(source);
  if (filter === 'direct') return flags.isDirectInstant;
  if (filter === 'nuvio') return flags.isNuvio;
  if (filter === 'stremio') return flags.isStremio;
  if (filter === 'cloudstream') return flags.isCS;
  if (filter === 'p2p') return flags.isP2P;
  return true;
}

export function matchesQualityFilter(source: StreamSource, filter: QualityFilter): boolean {
  if (filter === 'all') return true;
  const qualUpper = (source.quality || '').toUpperCase();
  if (filter === '4k') return qualUpper.includes('4K') || qualUpper.includes('2160');
  if (filter === '1080p') return qualUpper.includes('1080') || qualUpper.includes('FHD');
  if (filter === '720p') return qualUpper.includes('720');
  if (filter === '480p') return qualUpper.includes('480') || qualUpper.includes('SD');
  return true;
}

export function getAvailableProviders(sources: StreamSource[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of sources) {
    const name = getCanonicalProviderName(s);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export function getAvailableLanguages(sources: StreamSource[]): Array<{ lang: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const s of sources) {
    const tags = extractLanguageTags(s.audioLanguage);
    for (const tag of tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  const order = ['Hindi', 'English', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Kannada'];
  return Object.entries(counts)
    .sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    })
    .map(([lang, count]) => ({ lang, count }));
}
