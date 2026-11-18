import { LRUCache } from 'lru-cache';
import type { StreamItem } from '../types/stream.js';
import { isRedZoneStream } from './redzone-intel-service.js';

export interface CatalogStreamTicker {
  stream_key: string;
  sportType: string;
  headline: string;       // e.g. "NYK 104 - TOR 98" or "Heineken Las Vegas GP" or "UFC 334: Gane vs. Hokit"
  subline: string;        // e.g. "4:12 - 4th • Knicks +6" or "P1 Antonelli 390 • P2 Verstappen 279 • P3 Russell 262"
  secondaryLine?: string; // e.g. UFC last completed fight result "Last: Harrison def. Nunes"
  statusBadge: string;    // e.g. "LIVE • Q4", "RED ZONE", "FINAL", "PRE-GAME", "F1 STANDINGS"
  isLiveState: 'pre' | 'in' | 'post';
  accent: 'red' | 'green' | 'gold' | 'cyan' | 'purple';
  awayAbbr?: string;
  awayScore?: string;
  homeAbbr?: string;
  homeScore?: string;
}

export interface CatalogLiveContextPayload {
  updatedAt: string;
  tickers: Record<string, CatalogStreamTicker>;
  sportHighlights: {
    ufc?: {
      eventName: string;
      currentOrMainFight: string;
      lastCompletedFight?: string;
    };
    f1?: {
      eventName: string;
      statusText: string;
      topDrivers: Array<{ rank: number; name: string; points: string }>;
    };
    tennis?: {
      tournamentName: string;
      featuredMatch: string;
    };
  };
}

function norm(s?: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function teamMatches(competitor: any, rawTeamName: string): boolean {
  if (!rawTeamName || !competitor?.team) return false;
  const target = norm(rawTeamName);
  if (target.length < 3) return false;

  const candidates = [
    norm(competitor.team.displayName),
    norm(competitor.team.shortDisplayName),
    norm(competitor.team.name),
    norm(competitor.team.location),
    norm(competitor.team.abbreviation),
  ].filter(Boolean);

  return candidates.some((c) => {
    if (c.length < 2) return false;
    if (c === target) return true;
    if (target.length >= 4 && c.includes(target)) return true;
    if (c.length >= 4 && target.includes(c)) return true;
    return false;
  });
}

async function fetchJsonSafe(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

class CatalogTickerService {
  private cache: LRUCache<string, CatalogLiveContextPayload>;
  private lastKnownGood: CatalogLiveContextPayload | null = null;
  private inFlight: Promise<CatalogLiveContextPayload> | null = null;

  constructor() {
    this.cache = new LRUCache<string, CatalogLiveContextPayload>({
      max: 4,
      ttl: 30000, // 30s catalog live ticker cache
    });
  }

  public async getLiveContext(streams: StreamItem[]): Promise<CatalogLiveContextPayload> {
    const cached = this.cache.get('global');
    if (cached) return cached;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.buildLiveContext(streams)
      .then((res) => {
        this.cache.set('global', res);
        this.lastKnownGood = res;
        this.inFlight = null;
        return res;
      })
      .catch(() => {
        this.inFlight = null;
        return this.lastKnownGood || {
          updatedAt: new Date().toISOString(),
          tickers: {},
          sportHighlights: {},
        };
      });

    return this.inFlight;
  }

  private async buildLiveContext(streams: StreamItem[]): Promise<CatalogLiveContextPayload> {
    // Demand-driven category detection for heavy team-sport scoreboards; UFC/F1/ATP highlights always stay hydrated
    const cats = new Set(streams.map((s) => (s.category || '').toLowerCase()));
    const textAll = streams.map((s) => `${s.name} ${s.league}`.toLowerCase()).join(' | ');
    const needsBasketball = cats.has('basketball') || textAll.includes('nba') || textAll.includes('ncaa');
    const needsFootball = cats.has('football') || textAll.includes('nfl') || textAll.includes('redzone');
    const needsHockey = cats.has('hockey') || textAll.includes('nhl');
    const needsBaseball = cats.has('baseball') || textAll.includes('mlb');
    const needsSoccer = cats.has('soccer') || textAll.includes('premier') || textAll.includes('champions');

    const optFetch = (cond: boolean, url: string) => cond ? fetchJsonSafe(url) : Promise.resolve(null);

    const [
      nbaSb,
      nflSb,
      nhlSb,
      mlbSb,
      ncaabSb,
      cfbSb,
      eplSb,
      uclSb,
      laligaSb,
      ufcSb,
      f1Sb,
      f1Standings,
      atpSb,
    ] = await Promise.all([
      optFetch(needsBasketball, 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'),
      optFetch(needsFootball, 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'),
      optFetch(needsHockey, 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'),
      optFetch(needsBaseball, 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'),
      optFetch(needsBasketball, 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'),
      optFetch(needsFootball, 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'),
      optFetch(needsSoccer, 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'),
      optFetch(needsSoccer, 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard'),
      optFetch(needsSoccer, 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard'),
      fetchJsonSafe('https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'),
      fetchJsonSafe('https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard'),
      fetchJsonSafe('https://site.api.espn.com/apis/v2/sports/racing/f1/standings'),
      fetchJsonSafe('https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard'),
    ]);

    const tickers: Record<string, CatalogStreamTicker> = {};
    const nflEvents: any[] = nflSb?.events || [];

    // 1. Build UFC Highlight (Current / Main Bout + Last Completed Fight Result)
    let ufcHighlight: CatalogLiveContextPayload['sportHighlights']['ufc'] | undefined;
    const ufcEvent = ufcSb?.events?.[0];
    if (ufcEvent) {
      const bouts: any[] = ufcEvent.competitions || [];
      const liveBout = bouts.find((b) => b.status?.type?.state === 'in');
      const nextBout = bouts.find((b) => b.status?.type?.state === 'pre');
      const completedBouts = bouts.filter((b) => b.status?.type?.state === 'post');
      const lastDone = completedBouts.length > 0 ? completedBouts[completedBouts.length - 1] : null;
      const mainOrCur = liveBout || nextBout || bouts[bouts.length - 1];

      const fmtFight = (b: any): string => {
        if (!b) return ufcEvent.name || 'UFC Fight Card';
        const c0 = b.competitors?.[0];
        const c1 = b.competitors?.[1];
        const n0 = c0?.athlete?.shortName || c0?.athlete?.displayName || 'Fighter 1';
        const n1 = c1?.athlete?.shortName || c1?.athlete?.displayName || 'Fighter 2';
        if (b.status?.type?.state === 'post') {
          const winner = c0?.winner ? n0 : c1?.winner ? n1 : n0;
          const loser = c0?.winner ? n1 : n0;
          return `${winner} def. ${loser} (${b.status?.type?.shortDetail || 'Final'})`;
        }
        return `${n0} vs ${n1} (${b.status?.type?.shortDetail || 'Bout'})`;
      };

      const prevFight = lastDone && lastDone !== mainOrCur ? lastDone : completedBouts[completedBouts.length - 2];
      ufcHighlight = {
        eventName: ufcEvent.shortName || ufcEvent.name || 'UFC Event',
        currentOrMainFight: liveBout ? `LIVE: ${fmtFight(liveBout)}` : fmtFight(mainOrCur),
        lastCompletedFight: prevFight ? fmtFight(prevFight) : undefined,
      };
    }

    // 2. Build F1 Highlight (GP Event + Top-3 Championship Standings)
    let f1Highlight: CatalogLiveContextPayload['sportHighlights']['f1'] | undefined;
    const f1Ev = f1Sb?.events?.[0];
    const driverEntries: any[] = f1Standings?.children?.[0]?.standings?.entries || [];
    const topDrivers = driverEntries.slice(0, 3).map((e, idx) => {
      const ptsObj = (e.stats || []).find((st: any) => st.name === 'championshipPts' || st.name === 'points');
      return {
        rank: idx + 1,
        name: e.athlete?.shortName || e.athlete?.displayName || `Driver ${idx + 1}`,
        points: ptsObj?.displayValue || '0',
      };
    });
    if (f1Ev || topDrivers.length > 0) {
      f1Highlight = {
        eventName: f1Ev?.name || 'Formula 1 World Championship',
        statusText: f1Ev?.status?.type?.shortDetail || 'F1 Standings',
        topDrivers,
      };
    }

    // 3. Build Tennis Highlight
    let tennisHighlight: CatalogLiveContextPayload['sportHighlights']['tennis'] | undefined;
    const atpEv = atpSb?.events?.[0];
    if (atpEv) {
      const singlesGrp = (atpEv.groupings || []).find((g: any) => /singles/i.test(g.grouping?.displayName || '')) || atpEv.groupings?.[0];
      const match = (singlesGrp?.competitions || []).find((m: any) => m.status?.type?.state === 'in') || singlesGrp?.competitions?.[0];
      const m0 = match?.competitors?.[0]?.athlete?.displayName || '';
      const m1 = match?.competitors?.[1]?.athlete?.displayName || '';
      tennisHighlight = {
        tournamentName: atpEv.name || 'ATP Tour',
        featuredMatch: m0 && m1 ? `${m0} vs ${m1} (${match?.status?.type?.shortDetail || ''})` : (atpEv.status?.type?.shortDetail || 'Tournament Active'),
      };
    }

    // Scoreboard pools by sport category
    const poolsByCat: Record<string, any[]> = {
      basketball: [...(nbaSb?.events || []), ...(ncaabSb?.events || [])],
      football: [...nflEvents, ...(cfbSb?.events || [])],
      hockey: nhlSb?.events || [],
      baseball: mlbSb?.events || [],
      soccer: [...(eplSb?.events || []), ...(uclSb?.events || []), ...(laligaSb?.events || [])],
    };

    for (const s of streams) {
      const cat = (s.category || '').toLowerCase();
      const lg = (s.league || '').toLowerCase();

      // Special: RedZone multi-game card summary
      if (isRedZoneStream(s)) {
        const liveNfl = nflEvents.filter((e) => e.status?.type?.state === 'in');
        const rzGames = liveNfl.filter((e) => e.competitions?.[0]?.situation?.isRedZone);
        const topEv = rzGames[0] || liveNfl[0] || nflEvents[0];
        const c0 = topEv?.competitions?.[0]?.competitors?.[1];
        const c1 = topEv?.competitions?.[0]?.competitors?.[0];
        tickers[s.stream_key] = {
          stream_key: s.stream_key,
          sportType: 'nfl_redzone',
          headline:
            rzGames.length > 0
              ? `🚨 ${rzGames.length} IN RED ZONE • ${liveNfl.length} LIVE GAMES`
              : liveNfl.length > 0
              ? `🏈 ${liveNfl.length} LIVE GAMES • MULTI-GAME WHIPAROUND`
              : `📋 NFL SLATE • ${nflEvents.length} GAMES`,
          subline: topEv
            ? `Spotlight: ${c0?.team?.abbreviation || 'AWY'} ${c0?.score || 0} - ${c1?.score || 0} ${c1?.team?.abbreviation || 'HME'} (${topEv.status?.type?.shortDetail || ''})`
            : 'Live scorebug, WP swings & PPR leaders',
          statusBadge: rzGames.length > 0 ? 'RED ZONE' : liveNfl.length > 0 ? 'LIVE SLATE' : 'SLATE RADAR',
          isLiveState: liveNfl.length > 0 ? 'in' : 'pre',
          accent: rzGames.length > 0 ? 'red' : 'gold',
        };
        continue;
      }

      // Special: Combat / UFC
      if (cat === 'combat' || lg.includes('ufc') || /ufc|fight|boxing/i.test(s.name || '')) {
        if (ufcHighlight) {
          tickers[s.stream_key] = {
            stream_key: s.stream_key,
            sportType: 'combat',
            headline: `🥊 ${ufcHighlight.currentOrMainFight}`,
            subline: ufcHighlight.eventName,
            secondaryLine: ufcHighlight.lastCompletedFight ? `Last Fight: ${ufcHighlight.lastCompletedFight}` : undefined,
            statusBadge: ufcHighlight.currentOrMainFight.startsWith('LIVE:') ? 'LIVE BOUT' : 'FIGHT CARD',
            isLiveState: ufcHighlight.currentOrMainFight.startsWith('LIVE:') ? 'in' : 'pre',
            accent: 'red',
          };
        }
        continue;
      }

      // Special: Racing / F1
      if (cat === 'racing' || lg.includes('f1') || /f1|formula|grand prix/i.test(s.name || '')) {
        if (f1Highlight) {
          const topStr = f1Highlight.topDrivers.map((d) => `P${d.rank} ${d.name} (${d.points})`).join(' • ');
          tickers[s.stream_key] = {
            stream_key: s.stream_key,
            sportType: 'racing',
            headline: `🏎️ ${f1Highlight.eventName}`,
            subline: topStr || 'Telemetry & Constructor Standings',
            statusBadge: f1Highlight.statusText,
            isLiveState: /lap|practice|qualy|sprint|live/i.test(f1Highlight.statusText) ? 'in' : 'pre',
            accent: 'cyan',
          };
        }
        continue;
      }

      // Special: Tennis
      if (cat === 'tennis' || lg.includes('atp') || lg.includes('wta')) {
        if (tennisHighlight) {
          tickers[s.stream_key] = {
            stream_key: s.stream_key,
            sportType: 'tennis',
            headline: `🎾 ${tennisHighlight.tournamentName}`,
            subline: tennisHighlight.featuredMatch,
            statusBadge: 'TOUR FEED',
            isLiveState: 'in',
            accent: 'gold',
          };
        }
        continue;
      }

      // Special: Cricket
      if (cat === 'cricket' || lg.includes('willow') || lg.includes('ipl') || lg.includes('icc')) {
        tickers[s.stream_key] = {
          stream_key: s.stream_key,
          sportType: 'cricket',
          headline: `🏏 ${s.name} • Live Cricket Wire`,
          subline: 'CricViz Phase Run Rates • 360° Wagon Wheel & Live Feed',
          statusBadge: 'CRICKET HD',
          isLiveState: 'in',
          accent: 'green',
        };
        continue;
      }

      // Team Sports Scoreboard Matchup
      const pool = poolsByCat[cat] || [];
      const parts = (s.name || '').split(/\s+(?:vs\.?|at|@)\s+/i);
      const t1Hint = s.team1?.name || parts[0]?.trim() || '';
      const t2Hint = s.team2?.name || parts[1]?.trim() || '';

      const ev = pool.find((e) => {
        const comps = e.competitions?.[0]?.competitors || [];
        return (
          comps.some((c: any) => teamMatches(c, t1Hint)) &&
          comps.some((c: any) => teamMatches(c, t2Hint))
        );
      });

      if (ev) {
        const comp = ev.competitions?.[0] || {};
        const comps = comp.competitors || [];
        const c1 = comps.find((c: any) => teamMatches(c, t1Hint)) || comps[1] || comps[0];
        const c2 = comps.find((c: any) => c !== c1 && teamMatches(c, t2Hint)) || comps.find((c: any) => c !== c1) || comps[0];

        const rawState = ev.status?.type?.state;
        const st: 'pre' | 'in' | 'post' = rawState === 'pre' ? 'pre' : rawState === 'in' ? 'in' : 'post';
        const rawShort = ev.status?.type?.shortDetail || 'Scheduled';
        const shortDetail = /^scheduled$/i.test(rawShort.trim())
          ? (ev.status?.type?.detail || rawShort)
          : rawShort;
        const bcNames = Array.from(new Set([
          ...(comp.broadcasts?.[0]?.names || []),
          ...((comp.geoBroadcasts || []).map((g: any) => g.media?.shortName).filter(Boolean)),
        ])).slice(0, 2).join(', ');

        const a1 = c1?.team?.abbreviation || 'TM1';
        const a2 = c2?.team?.abbreviation || 'TM2';
        const sc1 = st === 'pre' ? (c1?.records?.[0]?.summary || '--') : String(c1?.score ?? 0);
        const sc2 = st === 'pre' ? (c2?.records?.[0]?.summary || '--') : String(c2?.score ?? 0);

        const sit = comp.situation || {};
        const isRz = Boolean(st === 'in' && sit.isRedZone);
        const headline =
          st === 'pre'
            ? `${a1} (${sc1}) vs ${a2} (${sc2})`
            : `${a1} ${sc1} - ${sc2} ${a2}`;

        const extraSit = isRz
          ? `🚨 RED ZONE • ${sit.downDistanceText || 'Inside 20'}`
          : st === 'in' && sit.downDistanceText
          ? `${shortDetail} • ${sit.downDistanceText}`
          : st === 'pre'
          ? `🕒 ${shortDetail}${comp.odds?.[0]?.details ? ` • ${comp.odds[0].details}` : ''}${bcNames ? ` • 📺 ${bcNames}` : ''}`
          : `${shortDetail}${comp.venue?.address?.city ? ` • ${comp.venue.address.city}` : ''}`;

        tickers[s.stream_key] = {
          stream_key: s.stream_key,
          sportType: cat,
          headline,
          subline: extraSit,
          statusBadge: isRz ? 'RED ZONE' : st === 'in' ? shortDetail : st === 'post' ? 'FINAL' : 'UPCOMING',
          isLiveState: st,
          accent: isRz ? 'red' : st === 'in' ? 'cyan' : st === 'post' ? 'green' : 'purple',
          awayAbbr: a1,
          awayScore: sc1,
          homeAbbr: a2,
          homeScore: sc2,
        };
      }
    }

    return {
      updatedAt: new Date().toISOString(),
      tickers,
      sportHighlights: {
        ufc: ufcHighlight,
        f1: f1Highlight,
        tennis: tennisHighlight,
      },
    };
  }
}

export const catalogTickerService = new CatalogTickerService();
