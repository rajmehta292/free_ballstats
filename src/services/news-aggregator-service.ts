import { LRUCache } from 'lru-cache';
import type { StreamItem } from '../types/stream.js';

export type NewsCategoryTag = 'matchup' | 'injuries' | 'analytics' | 'business' | 'headlines';

export interface EnrichedNewsArticle {
  title: string;
  description: string;
  link: string;
  image?: string;
  published?: string;
  source: string;
  categoryTag: NewsCategoryTag;
  categoryLabel: string;
  isEventSpecific: boolean;
}

const CHANNEL_STOP_WORDS = new Set([
  'sky',
  'sports',
  'willow',
  'espn',
  'fox',
  'tnt',
  'tbs',
  'abc',
  'cbs',
  'nbc',
  'fs1',
  'nfl',
  'nba',
  'nhl',
  'mlb',
  'ufc',
  'f1',
  'live',
  'hd',
  'fhd',
  'channel',
  'network',
  'stream',
  'tv',
  'main',
  'event',
  'redzone',
]);

function decodeXmlEntities(raw: string): string {
  return (raw || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyArticle(title: string, description: string, matchTerms: string[], hintTag?: NewsCategoryTag): {
  categoryTag: NewsCategoryTag;
  categoryLabel: string;
  isEventSpecific: boolean;
} {
  const hay = `${title} ${description}`.toLowerCase();
  const isEventSpecific = matchTerms.some((term) => term.length >= 3 && hay.includes(term));

  if (/\b(injur|injured|questionable|doubtful|out for|probable|concussion|il\b|dl\b|ir\b|lineup|starting xi|inactive|availability|status|weigh-in|grid penalty|steward)\b/i.test(hay)) {
    return { categoryTag: 'injuries', categoryLabel: '🏥 Injuries & Lineups', isEventSpecific };
  }
  if (/\b(trade|contract|extension|salary|cap|valuation|rights|broadcast|tv deal|nba cup|commissioner|cba|fia|regulation|sponsor|revenue|suspension|fine|business|media)\b/i.test(hay)) {
    return { categoryTag: 'business', categoryLabel: '💼 Business & League', isEventSpecific };
  }
  if (/\b(statcast|expected|xg|epa|efficiency|analytics|pace|telemetry|upgrade|aerodynamic|Strategy|tire|tyre|pitch|breakdown|film|metric|powerplay|net rating|four factors|win probability)\b/i.test(hay)) {
    return { categoryTag: 'analytics', categoryLabel: '📊 Analytics & Strategy', isEventSpecific };
  }
  if (isEventSpecific || hintTag === 'matchup') {
    return { categoryTag: 'matchup', categoryLabel: '🎯 Event Spotlight', isEventSpecific: isEventSpecific || hintTag === 'matchup' };
  }
  if (hintTag === 'injuries') {
    return { categoryTag: 'injuries', categoryLabel: '🏥 Injuries & Lineups', isEventSpecific };
  }
  if (hintTag === 'business') {
    return { categoryTag: 'business', categoryLabel: '💼 Business & League', isEventSpecific };
  }
  if (hintTag === 'analytics') {
    return { categoryTag: 'analytics', categoryLabel: '📊 Analytics & Strategy', isEventSpecific };
  }
  return { categoryTag: 'headlines', categoryLabel: '📰 League Wire', isEventSpecific };
}

class NewsAggregatorService {
  private cache: LRUCache<string, EnrichedNewsArticle[]>;

  constructor() {
    this.cache = new LRUCache<string, EnrichedNewsArticle[]>({
      max: 200,
      ttl: 120000, // 2 minutes fresh multi-source news cache
    });
  }

  /** Build event-specific, injury, analytics, and industry news up to 24 articles */
  public async getEventNews(
    stream: StreamItem,
    sportPath: string | null,
    summaryArticles: any[] = [],
    eventLabelOverride?: string
  ): Promise<EnrichedNewsArticle[]> {
    const cacheKey = `${stream.stream_key}:${sportPath || stream.category}:${eventLabelOverride || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { queries, matchTerms, sportLabel } = this.buildSearchPlan(stream, sportPath, eventLabelOverride);

    const espnPromise = sportPath
      ? this.fetchEspnLeagueNews(sportPath, matchTerms)
      : Promise.resolve<EnrichedNewsArticle[]>([]);

    const rssPromises = queries.map((q) =>
      this.fetchGoogleNewsRss(q.query, matchTerms, q.hintTag)
    );

    const [espnItems, ...rssResults] = await Promise.all([espnPromise, ...rssPromises]);

    const summaryItems: EnrichedNewsArticle[] = (summaryArticles || [])
      .filter((a) => a && (a.headline || a.title))
      .map((a) => {
        const title = String(a.headline || a.title || '').trim();
        const desc = String(a.description || '').trim();
        const cls = classifyArticle(title, desc, matchTerms, 'matchup');
        return {
          title,
          description: desc || `${sportLabel} matchup editorial coverage.`,
          link: a.links?.web?.href || a.link || 'https://www.espn.com',
          image: a.images?.[0]?.url || a.image,
          published: a.published,
          source: 'ESPN Gamecast',
          categoryTag: cls.categoryTag,
          categoryLabel: cls.categoryLabel,
          isEventSpecific: true,
        };
      });

    const combined = [...summaryItems, ...espnItems, ...rssResults.flat()];
    const deduped: EnrichedNewsArticle[] = [];
    const seen = new Set<string>();

    for (const item of combined) {
      if (!item.title) continue;
      // Strip trailing " - Publisher" from Google News titles before deduplicating
      const cleanTitle = item.title.replace(/\s+-\s+[^-]+$/, '').trim();
      const fingerprint = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
      if (!fingerprint || seen.has(fingerprint)) continue;
      seen.add(fingerprint);

      deduped.push({
        ...item,
        title: cleanTitle,
      });
    }

    // Rank: Event-specific stories first, then newest timestamp
    deduped.sort((a, b) => {
      if (a.isEventSpecific !== b.isEventSpecific) {
        return a.isEventSpecific ? -1 : 1;
      }
      const ta = a.published ? Date.parse(a.published) || 0 : 0;
      const tb = b.published ? Date.parse(b.published) || 0 : 0;
      return tb - ta;
    });

    const finalFeed = deduped.slice(0, 24);
    this.cache.set(cacheKey, finalFeed);
    return finalFeed;
  }

  private buildSearchPlan(
    stream: StreamItem,
    sportPath: string | null,
    eventLabelOverride?: string
  ): {
    queries: Array<{ query: string; hintTag: NewsCategoryTag }>;
    matchTerms: string[];
    sportLabel: string;
  } {
    const cat = (stream.category || '').toLowerCase();
    const lg = (stream.league || '').toUpperCase();
    const name = eventLabelOverride || stream.name || '';
    const t1 = stream.team1?.name || '';
    const t2 = stream.team2?.name || '';

    let sportKeyword = lg || cat || 'Sports';
    let industryKeyword = `${sportKeyword} analytics broadcast business`;
    let injuryKeyword = `${sportKeyword} injury lineup news`;

    if (cat === 'racing' || sportPath?.includes('racing') || /f1|formula/i.test(`${lg} ${name}`)) {
      sportKeyword = 'Formula 1 F1';
      industryKeyword = 'Formula 1 F1 FIA technical upgrades car development team business';
      injuryKeyword = 'Formula 1 F1 qualifying grid penalty tire strategy sprint';
    } else if (cat === 'tennis' || sportPath?.includes('tennis')) {
      sportKeyword = 'ATP WTA Tennis';
      industryKeyword = 'ATP WTA Tennis prize money tournament schedule analytics';
      injuryKeyword = 'ATP WTA Tennis draw injury retirement match preview';
    } else if (cat === 'cricket') {
      sportKeyword = 'Cricket ICC IPL T20';
      industryKeyword = 'Cricket IPL ICC broadcast rights franchise auctions analytics';
      injuryKeyword = 'Cricket playing XI pitch report injury update team news';
    } else if (cat === 'combat' || sportPath?.includes('mma')) {
      sportKeyword = 'UFC MMA Boxing';
      industryKeyword = 'UFC Boxing PPV business fighter pay weight class rankings';
      injuryKeyword = 'UFC MMA Boxing fight card weigh-in injury replacement';
    } else if (cat === 'baseball' || sportPath?.includes('baseball')) {
      sportKeyword = 'MLB Baseball';
      industryKeyword = 'MLB free agency Statcast analytics trade rumors payroll';
      injuryKeyword = 'MLB starting lineups injured list bullpen pitching matchups';
    } else if (cat === 'basketball' || sportPath?.includes('basketball')) {
      sportKeyword = lg.includes('NCAA') ? 'NCAA College Basketball' : 'NBA';
      industryKeyword = `${sportKeyword} trade rumors analytics cap CBA`;
      injuryKeyword = `${sportKeyword} injury report starting lineup rotation`;
    } else if (cat === 'football' || sportPath?.includes('football')) {
      sportKeyword = lg.includes('NCAA') ? 'College Football CFB' : 'NFL';
      industryKeyword = `${sportKeyword} Next Gen Stats trade deadline coaching NFL business`;
      injuryKeyword = `${sportKeyword} injury report inactive depth chart`;
    } else if (cat === 'hockey' || sportPath?.includes('hockey')) {
      sportKeyword = 'NHL';
      industryKeyword = 'NHL trade deadline salary cap analytics xGF';
      injuryKeyword = 'NHL starting goalies injury report line combinations';
    } else if (cat === 'soccer' || sportPath?.includes('soccer')) {
      sportKeyword = lg || 'Soccer Football';
      industryKeyword = `${sportKeyword} transfer news Opta xG tactical analysis club business`;
      injuryKeyword = `${sportKeyword} predicted lineups injury team news`;
    }

    const matchTerms: string[] = [];
    for (const raw of [t1, t2, eventLabelOverride || '', stream.name || '']) {
      const cleaned = raw.trim().toLowerCase();
      if (!cleaned) continue;
      const parts = cleaned.split(/\s+(?:vs\.?|at|@|-|:)\s+/i);
      for (const p of parts) {
        const words = p.trim().split(/\s+/).filter((w) => w.length >= 4 && !CHANNEL_STOP_WORDS.has(w));
        for (const w of words) {
          matchTerms.push(w);
        }
      }
    }

    const isNamedMatchup = Boolean(
      (t1 && t2 && !/team\s*[ab12]|redzone/i.test(`${t1} ${t2}`)) ||
      (/\bvs\b|\bat\b/i.test(name) && !CHANNEL_STOP_WORDS.has(name.toLowerCase()))
    );

    const primaryEventQuery = isNamedMatchup
      ? `${t1 || name} ${t2} ${sportKeyword}`.trim()
      : `${name && !CHANNEL_STOP_WORDS.has(name.toLowerCase()) ? name + ' ' : ''}${sportKeyword} latest news preview`.trim();

    const specificInjuryQuery = isNamedMatchup
      ? `"${t1 || name}" OR "${t2 || name}" ${injuryKeyword}`.trim()
      : injuryKeyword;

    return {
      queries: [
        { query: primaryEventQuery, hintTag: 'matchup' },
        { query: specificInjuryQuery, hintTag: 'injuries' },
        { query: industryKeyword, hintTag: 'business' },
      ],
      matchTerms: Array.from(new Set(matchTerms)),
      sportLabel: sportKeyword,
    };
  }

  private async fetchEspnLeagueNews(
    sportPath: string,
    matchTerms: string[]
  ): Promise<EnrichedNewsArticle[]> {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/news?limit=20`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json.articles || []).slice(0, 18).map((a: any) => {
        const title = String(a.headline || '').trim();
        const desc = String(a.description || '').trim();
        const cls = classifyArticle(title, desc, matchTerms);
        return {
          title,
          description: desc || 'Full league news analysis from ESPN.',
          link: a.links?.web?.href || 'https://www.espn.com',
          image: a.images?.[0]?.url,
          published: a.published,
          source: a.byline ? `ESPN • ${String(a.byline).slice(0, 28)}` : 'ESPN',
          categoryTag: cls.categoryTag,
          categoryLabel: cls.categoryLabel,
          isEventSpecific: cls.isEventSpecific,
        };
      });
    } catch {
      return [];
    }
  }

  private async fetchGoogleNewsRss(
    query: string,
    matchTerms: string[],
    hintTag: NewsCategoryTag
  ): Promise<EnrichedNewsArticle[]> {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) return [];
      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      const parsed: EnrichedNewsArticle[] = [];

      for (const block of items.slice(0, 8)) {
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
        const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const srcMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
        const descMatch = block.match(/<description>([\s\S]*?)<\/description>/);

        const rawTitle = decodeXmlEntities(titleMatch?.[1] || '');
        const link = decodeXmlEntities(linkMatch?.[1] || '');
        const source = decodeXmlEntities(srcMatch?.[1] || 'Sports Wire');
        const rawDesc = decodeXmlEntities(descMatch?.[1] || '');
        const cleanDesc =
          rawDesc && rawDesc.toLowerCase() !== rawTitle.toLowerCase()
            ? rawDesc.slice(0, 180)
            : `Reported by ${source}. Click to read full breakdown and context.`;

        if (!rawTitle || !link) continue;
        const cls = classifyArticle(rawTitle, cleanDesc, matchTerms, hintTag);

        parsed.push({
          title: rawTitle,
          description: cleanDesc,
          link,
          published: pubMatch?.[1] ? new Date(pubMatch[1]).toISOString() : undefined,
          source,
          categoryTag: cls.categoryTag,
          categoryLabel: cls.categoryLabel,
          isEventSpecific: cls.isEventSpecific,
        });
      }

      return parsed;
    } catch {
      return [];
    }
  }
}

export const newsAggregatorService = new NewsAggregatorService();
