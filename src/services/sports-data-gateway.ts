import { LRUCache } from 'lru-cache';

export interface NormalizedInjuryItem {
  athleteId?: string;
  player: string;
  position: string;
  teamName: string;
  teamAbbr: string;
  status: string;
  returnDate?: string;
  comment: string;
  headshot?: string;
}

export interface RealShotEvent {
  id: string;
  playerId?: string;
  playerName: string;
  teamAbbr: string;
  teamSide: 'team1' | 'team2';
  period: number;
  clock: string;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  made: boolean;
  value: 2 | 3;
  zone: 'restricted_area' | 'paint_non_ra' | 'midrange' | 'corner_3_left' | 'corner_3_right' | 'above_break_3';
  shotType: string;
  xEfg: number;
}

export interface ScoringRunBurst {
  teamAbbr: string;
  teamName: string;
  pointsFor: number;
  pointsAgainst: number;
  startPeriod: number;
  startClock: string;
  endPeriod: number;
  endClock: string;
  summary: string;
}

export type ProviderName = 'espn' | 'nhl_official' | 'mlb_official' | 'thesportsdb';

export interface ProvenanceMeta {
  provider: ProviderName | 'gateway';
  fallbackUsed: boolean;
  fetchedAt: string;
  cacheStatus: 'MISS' | 'HIT' | 'COALESCED' | 'STALE_FALLBACK';
  confidence: 'verified' | 'estimated' | 'stale';
  latencyMs: number;
}

interface ProviderHealthMetric {
  provider: ProviderName;
  status: 'healthy' | 'degraded' | 'open';
  requests: number;
  failures: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastSuccessAt?: string;
  lastError?: string;
  circuitOpenUntil: number;
}

/**
 * Federated Zero-Database Sports Data Gateway
 * Aggregates & normalizes live public JSON telemetry across multiple upstream providers
 * (ESPN Web/Site APIs, Official NHL API, Official MLB StatsAPI, TheSportsDB) with circuit breakers,
 * request coalescing, SWR caching, strict provenance, CSV/JSON formatting & H2H intelligence.
 */
class SportsDataGateway {
  // Tiered SWR LRU caches (fresh burst 15s + stale safety net 10m if all upstreams fail)
  private burstCache: LRUCache<string, any>;
  private staleCache: LRUCache<string, any>;
  private inflight: Map<string, Promise<any>> = new Map();
  private providerHealth: Map<ProviderName, ProviderHealthMetric> = new Map();
  private apiUsage = {
    totalRequests: 0,
    csvExports: 0,
    byTier: { 'public-free': 0, 'pro-key': 0 } as Record<string, number>,
    topRoutes: new Map<string, number>(),
  };

  constructor() {
    this.burstCache = new LRUCache<string, any>({
      max: 250,
      ttl: 15000,
    });
    this.staleCache = new LRUCache<string, any>({
      max: 250,
      ttl: 600000, // 10 min stale-while-revalidate backup
    });
    const providers: ProviderName[] = ['espn', 'nhl_official', 'mlb_official', 'thesportsdb'];
    for (const p of providers) {
      this.providerHealth.set(p, {
        provider: p,
        status: 'healthy',
        requests: 0,
        failures: 0,
        consecutiveFailures: 0,
        avgLatencyMs: 0,
        circuitOpenUntil: 0,
      });
    }
  }

  private async fetchProviderJson(provider: ProviderName, url: string): Promise<any> {
    const metric = this.providerHealth.get(provider)!;
    if (Date.now() < metric.circuitOpenUntil) {
      throw new Error(`Circuit open for provider ${provider}`);
    }
    const t0 = Date.now();
    metric.requests += 1;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FreeBallStats-Gateway/4.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`Upstream status ${res.status} from ${provider}`);
      }
      const json = await res.json();
      const lat = Date.now() - t0;
      metric.consecutiveFailures = 0;
      metric.status = 'healthy';
      metric.lastSuccessAt = new Date().toISOString();
      metric.avgLatencyMs = metric.avgLatencyMs === 0 ? lat : Math.round(metric.avgLatencyMs * 0.7 + lat * 0.3);
      return json;
    } catch (err: any) {
      metric.failures += 1;
      metric.consecutiveFailures += 1;
      metric.lastError = err?.message || 'Unknown error';
      if (metric.consecutiveFailures >= 4) {
        metric.status = 'open';
        metric.circuitOpenUntil = Date.now() + 30000;
      } else {
        metric.status = 'degraded';
      }
      throw err;
    }
  }

  private async fetchJson(url: string): Promise<any> {
    return this.fetchProviderJson('espn', url);
  }

  /** Request-coalesced SWR executor returning payload stamped with exact provenance metadata */
  private async executeWithCoalescing<T>(
    cacheKey: string,
    ttlMs: number,
    fetcher: () => Promise<{ data: T; provider: ProviderName; fallbackUsed: boolean; latencyMs: number }>
  ): Promise<T & { provenance: ProvenanceMeta }> {
    const hit = this.burstCache.get(cacheKey);
    if (hit) {
      return {
        ...hit,
        provenance: { ...hit.provenance, cacheStatus: 'HIT' },
      };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      const res = await existing;
      return {
        ...res,
        provenance: { ...res.provenance, cacheStatus: 'COALESCED' },
      };
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        const enriched = {
          ...(result.data as any),
          provenance: {
            provider: result.provider,
            fallbackUsed: result.fallbackUsed,
            fetchedAt: new Date().toISOString(),
            cacheStatus: 'MISS',
            confidence: 'verified',
            latencyMs: result.latencyMs,
          } satisfies ProvenanceMeta,
        };
        this.burstCache.set(cacheKey, enriched, { ttl: ttlMs });
        this.staleCache.set(cacheKey, enriched);
        return enriched;
      } catch (err) {
        const stale = this.staleCache.get(cacheKey);
        if (stale) {
          return {
            ...stale,
            provenance: {
              ...(stale.provenance || {}),
              cacheStatus: 'STALE_FALLBACK',
              confidence: 'stale',
              fallbackUsed: true,
            } satisfies ProvenanceMeta,
          };
        }
        throw err;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /** Apply optional sparse field selection (?fields=col1,col2) and pagination (?limit=&offset=) */
  public shapeRows<T extends Record<string, any>>(
    rows: T[],
    opts?: { fields?: string; limit?: number; offset?: number }
  ): { items: Partial<T>[]; pagination: { total: number; offset: number; limit: number; returned: number } } {
    const total = rows.length;
    const offset = Math.max(0, Number(opts?.offset || 0));
    const limit = opts?.limit !== undefined && Number(opts.limit) > 0 ? Math.min(200, Number(opts.limit)) : total;
    let sliced: any[] = rows.slice(offset, offset + limit);

    if (opts?.fields && opts.fields.trim()) {
      const wanted = opts.fields.split(',').map((f) => f.trim()).filter(Boolean);
      if (wanted.length > 0) {
        sliced = sliced.map((row) => {
          const picked: Record<string, any> = {};
          for (const f of wanted) {
            if (f in row) picked[f] = row[f];
          }
          return picked;
        });
      }
    }

    return {
      items: sliced,
      pagination: { total, offset, limit, returned: sliced.length },
    };
  }

  public recordApiUsage(route: string, apiKey?: string, isCsv = false) {
    this.apiUsage.totalRequests += 1;
    if (isCsv) this.apiUsage.csvExports += 1;
    const tier = apiKey && apiKey.trim().length >= 6 ? 'pro-key' : 'public-free';
    this.apiUsage.byTier[tier] = (this.apiUsage.byTier[tier] || 0) + 1;
    this.apiUsage.topRoutes.set(route, (this.apiUsage.topRoutes.get(route) || 0) + 1);
  }

  public getProviderHealth() {
    return {
      status: Array.from(this.providerHealth.values()).some((m) => m.status === 'healthy') ? 'operational' : 'degraded',
      checkedAt: new Date().toISOString(),
      cacheStats: {
        burstEntries: this.burstCache.size,
        staleEntries: this.staleCache.size,
        inflightCoalesced: this.inflight.size,
      },
      apiUsage: {
        totalRequests: this.apiUsage.totalRequests,
        csvExports: this.apiUsage.csvExports,
        byTier: this.apiUsage.byTier,
        topEndpoints: Array.from(this.apiUsage.topRoutes.entries()).slice(0, 12).map(([endpoint, hits]) => ({ endpoint, hits })),
      },
      providers: Array.from(this.providerHealth.values()).map((m) => ({
        ...m,
        circuitOpen: Date.now() < m.circuitOpenUntil,
      })),
    };
  }

  /** Expose machine-readable capability matrix across every sport & league */
  public getCapabilities() {
    return {
      gatewayVersion: '4.0.0',
      architecture: 'Zero-Database Stateless Federated Gateway (SWR Memory Cache + Request Coalescing + Multi-Provider Failover)',
      features: {
        formats: ['json', 'csv'],
        sparseFieldSelection: true,
        pagination: true,
        liveSseScoreboard: true,
        naturalLanguageQuery: true,
        realShotCoordinates: ['basketball/nba'],
        h2hIntelligence: true,
      },
      leagues: [
        { sport: 'basketball', league: 'nba', label: 'NBA', providers: ['espn', 'thesportsdb'], capabilities: { scoreboard: true, standings: true, rosters: true, depthCharts: true, injuries: true, leaders: true, playByPlay: true, shotCoordinates: true, winProbability: true, odds: true, scoringRuns: true } },
        { sport: 'basketball', league: 'mens-college-basketball', label: 'NCAAM Basketball', providers: ['espn'], capabilities: { scoreboard: true, standings: true, rosters: false, depthCharts: false, injuries: false, leaders: false, playByPlay: true, shotCoordinates: true, winProbability: true, odds: true, scoringRuns: true } },
        { sport: 'football', league: 'nfl', label: 'NFL Football', providers: ['espn', 'thesportsdb'], capabilities: { scoreboard: true, standings: true, rosters: true, depthCharts: true, injuries: true, leaders: true, playByPlay: true, shotCoordinates: false, winProbability: true, odds: true, scoringRuns: false } },
        { sport: 'hockey', league: 'nhl', label: 'NHL Hockey', providers: ['espn', 'nhl_official', 'thesportsdb'], capabilities: { scoreboard: true, standings: true, rosters: true, depthCharts: true, injuries: true, leaders: true, playByPlay: true, shotCoordinates: false, winProbability: false, odds: true, scoringRuns: false } },
        { sport: 'baseball', league: 'mlb', label: 'MLB Baseball', providers: ['espn', 'mlb_official', 'thesportsdb'], capabilities: { scoreboard: true, standings: true, rosters: true, depthCharts: true, injuries: true, leaders: true, playByPlay: true, shotCoordinates: false, winProbability: true, odds: true, scoringRuns: false } },
        { sport: 'soccer', league: 'eng.1', label: 'Premier League Soccer', providers: ['espn', 'thesportsdb'], capabilities: { scoreboard: true, standings: true, rosters: true, depthCharts: false, injuries: true, leaders: false, playByPlay: true, shotCoordinates: false, winProbability: false, odds: true, scoringRuns: false } },
      ],
    };
  }

  /** Convert any flat array of objects to clean RFC-4180 CSV */
  public toCsv(rows: Array<Record<string, any>>): string {
    if (!rows || rows.length === 0) return '';
    const keys = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      keys.join(','),
      ...rows.map((r) => keys.map((k) => esc(r[k])).join(',')),
    ].join('\n');
  }

  private resolveSportLeague(sport?: string, league?: string): { sport: string; league: string } {
    const s = (sport || 'basketball').toLowerCase().trim();
    const defaults: Record<string, string> = {
      basketball: 'nba',
      football: 'nfl',
      hockey: 'nhl',
      baseball: 'mlb',
      soccer: 'eng.1',
    };
    const l = (league || defaults[s] || 'nba').toLowerCase().trim();
    return { sport: s, league: l };
  }

  private extractIdFromLinks(links: any[]): string | undefined {
    if (!Array.isArray(links)) return undefined;
    for (const l of links) {
      const m = String(l?.href || '').match(/\/id\/(\d+)/);
      if (m) return m[1];
    }
    return undefined;
  }

  /**
   * 1. Live Multi-Sport Scoreboard (+ Spread/O/U Odds, Provenance & NHL Official Failover)
   */
  public async getScoreboard(rawSport?: string, rawLeague?: string, date?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const key = `sb:${sport}:${league}:${date || 'today'}`;

    return this.executeWithCoalescing(key, 15000, async () => {
      const t0 = Date.now();
      const dateQs = date ? `?dates=${encodeURIComponent(date.replace(/-/g, ''))}` : '';
      try {
        const raw = await this.fetchProviderJson('espn', `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard${dateQs}`);
        const events = (raw?.events || []).map((ev: any) => {
          const comp = ev.competitions?.[0] || {};
          const cs: any[] = comp.competitors || [];
          const home = cs.find((c: any) => c.homeAway === 'home') || cs[0] || {};
          const away = cs.find((c: any) => c.homeAway === 'away') || cs[1] || {};
          const odd = comp.odds?.[0];

          return {
            eventId: String(ev.id || ''),
            name: ev.name || `${away.team?.displayName || 'Away'} @ ${home.team?.displayName || 'Home'}`,
            date: ev.date,
            state: comp.status?.type?.state || 'pre',
            statusDetail: comp.status?.type?.shortDetail || comp.status?.type?.detail || 'Scheduled',
            venue: comp.venue?.fullName || '',
            broadcast: (comp.broadcasts?.[0]?.names || []).join(', ') || '',
            awayTeam: away.team?.displayName || '',
            awayAbbr: away.team?.abbreviation || '',
            awayScore: Number(away.score ?? 0),
            awayRecord: away.records?.[0]?.summary || '',
            awayLogo: away.team?.logo || '',
            homeTeam: home.team?.displayName || '',
            homeAbbr: home.team?.abbreviation || '',
            homeScore: Number(home.score ?? 0),
            homeRecord: home.records?.[0]?.summary || '',
            homeLogo: home.team?.logo || '',
            spread: odd?.details || '',
            overUnder: odd?.overUnder ?? null,
            oddsProvider: odd?.provider?.name || '',
          };
        });
        return {
          data: { sport, league, fetchedAt: new Date().toISOString(), source: 'Live ESPN Scoreboard API', count: events.length, events },
          provider: 'espn' as ProviderName,
          fallbackUsed: false,
          latencyMs: Date.now() - t0,
        };
      } catch (err) {
        // Real secondary adapter failover for NHL via api-web.nhle.com
        if (sport === 'hockey' && league === 'nhl') {
          const nhlRaw = await this.fetchProviderJson('nhl_official', 'https://api-web.nhle.com/v1/schedule/now');
          const gamesToday: any[] = nhlRaw?.gameWeek?.[0]?.games || [];
          const events = gamesToday.map((g: any) => ({
            eventId: String(g.id || ''),
            name: `${g.awayTeam?.placeName?.default || g.awayTeam?.abbrev} at ${g.homeTeam?.placeName?.default || g.homeTeam?.abbrev}`,
            date: g.startTimeUTC,
            state: g.gameState === 'LIVE' || g.gameState === 'CRIT' ? 'in' : g.gameState === 'OFF' || g.gameState === 'FINAL' ? 'post' : 'pre',
            statusDetail: g.gameState || 'Scheduled',
            venue: g.venue?.default || '',
            broadcast: '',
            awayTeam: g.awayTeam?.placeName?.default || g.awayTeam?.abbrev || '',
            awayAbbr: g.awayTeam?.abbrev || '',
            awayScore: Number(g.awayTeam?.score ?? 0),
            awayRecord: '',
            awayLogo: g.awayTeam?.logo || '',
            homeTeam: g.homeTeam?.placeName?.default || g.homeTeam?.abbrev || '',
            homeAbbr: g.homeTeam?.abbrev || '',
            homeScore: Number(g.homeTeam?.score ?? 0),
            homeRecord: '',
            homeLogo: g.homeTeam?.logo || '',
            spread: '',
            overUnder: null,
            oddsProvider: '',
          }));
          return {
            data: { sport, league, fetchedAt: new Date().toISOString(), source: 'Official NHL API Fallback', count: events.length, events },
            provider: 'nhl_official' as ProviderName,
            fallbackUsed: true,
            latencyMs: Date.now() - t0,
          };
        }
        throw err;
      }
    });
  }

  /**
   * 2. Normalized Multi-Sport Standings (with Official NHL & MLB Secondary Adapter Failover)
   */
  public async getStandings(rawSport?: string, rawLeague?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const key = `st:${sport}:${league}`;

    return this.executeWithCoalescing(key, 300000, async () => {
      const t0 = Date.now();
      try {
        const raw = await this.fetchProviderJson('espn', `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`);
        const groups: any[] = raw?.children || (raw?.standings ? [{ name: league.toUpperCase(), standings: raw.standings }] : []);
        const teams: any[] = [];

        for (const grp of groups) {
          const confName = grp.name || league.toUpperCase();
          const entries: any[] = grp.standings?.entries || [];
          entries.forEach((e: any, idx: number) => {
            const stats: any[] = e.stats || [];
            const getStat = (n: string) => stats.find((s: any) => s.name === n || s.abbreviation === n);
            const wins = Number(getStat('wins')?.value ?? 0);
            const losses = Number(getStat('losses')?.value ?? 0);
            const ties = Number(getStat('ties')?.value ?? 0);
            const ppg = Number(Number(getStat('avgPointsFor')?.value ?? getStat('pointsFor')?.value ?? 0).toFixed(1));
            const oppPpg = Number(Number(getStat('avgPointsAgainst')?.value ?? getStat('pointsAgainst')?.value ?? 0).toFixed(1));

            teams.push({
              rank: idx + 1,
              conference: confName,
              teamId: String(e.team?.id || ''),
              team: e.team?.displayName || 'Team',
              abbr: e.team?.abbreviation || '',
              logo: e.team?.logos?.[0]?.href || '',
              wins,
              losses,
              ties,
              winPct: getStat('winPercent')?.displayValue || (wins + losses > 0 ? (wins / (wins + losses)).toFixed(3) : '.000'),
              gamesBehind: getStat('gamesBehind')?.displayValue || '-',
              pointsFor: ppg,
              pointsAgainst: oppPpg,
              diff: getStat('pointDifferential')?.displayValue || getStat('differential')?.displayValue || (ppg && oppPpg ? (ppg - oppPpg).toFixed(1) : '0'),
              streak: getStat('streak')?.displayValue || '-',
              last10: getStat('Last Ten Games')?.displayValue || '-',
            });
          });
        }
        return {
          data: { sport, league, fetchedAt: new Date().toISOString(), source: 'Live ESPN Standings API', count: teams.length, teams },
          provider: 'espn' as ProviderName,
          fallbackUsed: false,
          latencyMs: Date.now() - t0,
        };
      } catch (err) {
        if (sport === 'hockey' && league === 'nhl') {
          const nhl = await this.fetchProviderJson('nhl_official', 'https://api-web.nhle.com/v1/standings/now');
          const teams = (nhl?.standings || []).map((t: any, idx: number) => ({
            rank: idx + 1,
            conference: t.conferenceName || t.conferenceAbbrev || 'NHL',
            teamId: t.teamAbbrev?.default || String(idx),
            team: t.teamName?.default || 'NHL Team',
            abbr: t.teamAbbrev?.default || '',
            logo: t.teamLogo || '',
            wins: Number(t.wins ?? 0),
            losses: Number(t.losses ?? 0),
            ties: Number(t.otLosses ?? 0),
            winPct: String(Number(t.pointPctg ?? 0).toFixed(3)),
            gamesBehind: '-',
            pointsFor: Number(t.goalFor ?? 0),
            pointsAgainst: Number(t.goalAgainst ?? 0),
            diff: String(t.goalDifferential ?? 0),
            streak: `${t.streakCode || ''}${t.streakCount || ''}`,
            last10: `${t.l10Wins || 0}-${t.l10Losses || 0}-${t.l10OtLosses || 0}`,
          }));
          return {
            data: { sport, league, fetchedAt: new Date().toISOString(), source: 'Official NHL API Fallback', count: teams.length, teams },
            provider: 'nhl_official' as ProviderName,
            fallbackUsed: true,
            latencyMs: Date.now() - t0,
          };
        }
        if (sport === 'baseball' && league === 'mlb') {
          const mlb = await this.fetchProviderJson('mlb_official', 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104');
          const teams: any[] = [];
          for (const rec of (mlb?.records || [])) {
            for (const tr of (rec.teamRecords || [])) {
              teams.push({
                rank: Number(tr.divisionRank || teams.length + 1),
                conference: rec.division?.name || 'MLB',
                teamId: String(tr.team?.id || ''),
                team: tr.team?.name || 'MLB Team',
                abbr: (tr.team?.name || 'MLB').slice(0, 3).toUpperCase(),
                logo: '',
                wins: Number(tr.wins ?? 0),
                losses: Number(tr.losses ?? 0),
                ties: 0,
                winPct: tr.winningPercentage || '.500',
                gamesBehind: tr.gamesBack || '-',
                pointsFor: Number(tr.runsScored ?? 0),
                pointsAgainst: Number(tr.runsAllowed ?? 0),
                diff: String(tr.runDifferential ?? 0),
                streak: tr.streak?.streakCode || '-',
                last10: '-',
              });
            }
          }
          return {
            data: { sport, league, fetchedAt: new Date().toISOString(), source: 'Official MLB StatsAPI Fallback', count: teams.length, teams },
            provider: 'mlb_official' as ProviderName,
            fallbackUsed: true,
            latencyMs: Date.now() - t0,
          };
        }
        throw err;
      }
    });
  }

  /**
   * 3. League-Wide Live Injury Wire (with optional team filter)
   */
  public async getInjuries(rawSport?: string, rawLeague?: string, teamFilter?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const key = `inj:${sport}:${league}`;
    let items: NormalizedInjuryItem[] = this.burstCache.get(key);

    if (!items) {
      const raw = await this.fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`);
      items = [];
      for (const tm of (raw?.injuries || [])) {
        const teamName = tm.displayName || 'Team';
        const teamAbbr = tm.injuries?.[0]?.athlete?.team?.abbreviation || teamName.split(' ').pop()?.slice(0, 3).toUpperCase() || '';
        for (const inj of (tm.injuries || [])) {
          const ath = inj.athlete || {};
          items.push({
            athleteId: this.extractIdFromLinks(ath.links) || (ath.id ? String(ath.id) : undefined),
            player: ath.displayName || 'Player',
            position: ath.position?.abbreviation || '-',
            teamName,
            teamAbbr: ath.team?.abbreviation || teamAbbr,
            status: inj.status || inj.type?.description || 'Questionable',
            returnDate: inj.details?.returnDate || undefined,
            comment: inj.shortComment || inj.longComment || '',
            headshot: ath.headshot?.href || undefined,
          });
        }
      }
      this.burstCache.set(key, items);
    }

    const tf = (teamFilter || '').toLowerCase().trim();
    const filtered = tf
      ? items.filter((i) => i.teamName.toLowerCase().includes(tf) || i.teamAbbr.toLowerCase() === tf || i.player.toLowerCase().includes(tf))
      : items;

    return {
      sport,
      league,
      fetchedAt: new Date().toISOString(),
      source: 'Live ESPN Injury Wire',
      count: filtered.length,
      injuries: filtered,
    };
  }

  /**
   * 4. Live Multi-Sport Statistical Leaders
   */
  public async getLeaders(rawSport?: string, rawLeague?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const key = `ldr:${sport}:${league}`;
    const cached = this.burstCache.get(key);
    if (cached) return cached;

    const raw = await this.fetchJson(`https://site.api.espn.com/apis/site/v3/sports/${sport}/${league}/leaders`);
    const categories = (raw?.leaders?.categories || []).map((c: any) => ({
      name: String(c.name || ''),
      displayName: String(c.displayName || c.name || ''),
      abbreviation: String(c.abbreviation || ''),
      leaders: (c.leaders || []).slice(0, 15).map((l: any, idx: number) => ({
        rank: idx + 1,
        athleteId: String(l.athlete?.id || ''),
        player: l.athlete?.displayName || 'Player',
        team: l.athlete?.team?.abbreviation || '',
        position: l.athlete?.position?.abbreviation || '',
        headshot: l.athlete?.headshot?.href || '',
        value: l.displayValue,
        numericValue: Number(l.value ?? 0),
      })),
    }));

    const payload = {
      sport,
      league,
      fetchedAt: new Date().toISOString(),
      source: 'Live ESPN Stat Leaders API',
      count: categories.length,
      categories,
    };
    this.burstCache.set(key, payload);
    return payload;
  }

  /**
   * 5. Live 360° Team Intelligence Hub (Record + Depth Chart + Active Roster + Schedule + Team Injuries + News)
   */
  public async getTeamHub(rawSport: string | undefined, rawLeague: string | undefined, teamQuery: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const teamsRaw = await this.fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=40`);
    const allTeams: any[] = (teamsRaw?.sports?.[0]?.leagues?.[0]?.teams || []).map((t: any) => t.team).filter(Boolean);

    const q = (teamQuery || '').toLowerCase().trim();
    const matched =
      allTeams.find((t) => String(t.id) === q || (t.abbreviation || '').toLowerCase() === q) ||
      allTeams.find((t) => (t.displayName || '').toLowerCase().includes(q) || (t.shortDisplayName || '').toLowerCase() === q) ||
      allTeams[0];

    if (!matched) {
      throw new Error(`No team found matching "${teamQuery}" in ${sport}/${league}`);
    }

    const teamId = String(matched.id);
    const safeFetch = async (url: string) => {
      try { return await this.fetchJson(url); } catch { return null; }
    };

    const [detailRaw, rosterRaw, depthRaw, schedRaw, injuriesResp, standingsResp] = await Promise.all([
      safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}`),
      safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/roster`),
      safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/depthcharts`),
      safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`),
      this.getInjuries(sport, league, matched.abbreviation).catch(() => ({ injuries: [] })),
      this.getStandings(sport, league).catch(() => ({ teams: [] })),
    ]);

    const teamObj = detailRaw?.team || matched;
    const standing = (standingsResp.teams || []).find((s: any) => s.teamId === teamId || s.abbr === teamObj.abbreviation);

    // Parse roster (handles flat or grouped)
    const rosterRawAthletes: any[] = [];
    if (Array.isArray(rosterRaw?.athletes)) {
      if (rosterRaw.athletes[0]?.items) {
        for (const grp of rosterRaw.athletes) rosterRawAthletes.push(...(grp.items || []));
      } else {
        rosterRawAthletes.push(...rosterRaw.athletes);
      }
    }
    const roster = rosterRawAthletes.map((a: any) => ({
      id: String(a.id || ''),
      name: a.fullName || a.displayName || 'Player',
      jersey: a.jersey ? String(a.jersey) : '-',
      position: a.position?.abbreviation || '-',
      age: a.age ?? null,
      height: a.displayHeight || '',
      weight: a.displayWeight || '',
      college: a.college?.name || '',
      headshot: a.headshot?.href || `https://a.espncdn.com/i/headshots/${league}/players/full/${a.id}.png`,
    }));

    // Parse Depth Chart
    const depthChart: Record<string, Array<{ id: string; name: string }>> = {};
    const dcPositions = depthRaw?.depthchart?.[0]?.positions || {};
    for (const [posKey, posData] of Object.entries<any>(dcPositions)) {
      depthChart[posKey.toUpperCase()] = (posData?.athletes || []).map((a: any) => ({
        id: String(a.id || ''),
        name: a.displayName || a.shortName || 'Player',
      }));
    }

    // Parse Schedule (Completed results & Upcoming games)
    const recentGames: any[] = [];
    const upcomingGames: any[] = [];
    for (const ev of (schedRaw?.events || [])) {
      const comp = ev.competitions?.[0] || {};
      const cs: any[] = comp.competitors || [];
      const me = cs.find((c: any) => String(c.team?.id) === teamId) || cs[0] || {};
      const opp = cs.find((c: any) => String(c.team?.id) !== teamId) || cs[1] || {};
      const state = comp.status?.type?.state || 'pre';
      const item = {
        eventId: String(ev.id || ''),
        date: ev.date,
        opponent: opp.team?.displayName || opp.team?.abbreviation || 'Opponent',
        opponentAbbr: opp.team?.abbreviation || '',
        opponentLogo: opp.team?.logos?.[0]?.href || '',
        homeAway: me.homeAway === 'home' ? 'vs' : '@',
        status: comp.status?.type?.shortDetail || 'Scheduled',
        result: me.winner === true ? 'W' : me.winner === false ? 'L' : '',
        score: state !== 'pre' ? `${me.score?.displayValue ?? me.score ?? '-'} - ${opp.score?.displayValue ?? opp.score ?? '-'}` : '',
      };
      if (state === 'post') recentGames.push(item);
      else upcomingGames.push(item);
    }

    return {
      sport,
      league,
      fetchedAt: new Date().toISOString(),
      source: 'Live ESPN Team 360° API',
      team: {
        id: teamId,
        name: teamObj.displayName || matched.displayName,
        abbreviation: teamObj.abbreviation || matched.abbreviation,
        logo: teamObj.logos?.[0]?.href || '',
        record: teamObj.record?.items?.[0]?.summary || (standing ? `${standing.wins}-${standing.losses}` : '-'),
        standingSummary: teamObj.standingSummary || (standing ? `#${standing.rank} ${standing.conference}` : ''),
        standing,
      },
      depthChart,
      rosterCount: roster.length,
      roster,
      injuries: injuriesResp.injuries || [],
      recentGames: recentGames.slice(-8).reverse(),
      upcomingGames: upcomingGames.slice(0, 8),
    };
  }

  /**
   * Classify ESPN basketball coordinate (x: 0..50ft width, y: 0..47ft from hoop) into CourtOptix SVG + zone
   */
  public parseRealBasketballShot(play: any, team1Id: string, t1Abbr: string, t2Abbr: string): RealShotEvent | null {
    if (!play?.shootingPlay || !play?.coordinate) return null;
    if (/free throw/i.test(play.text || '')) return null;
    const rawX = Number(play.coordinate.x);
    const rawY = Number(play.coordinate.y);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;
    // Ignore out-of-bounds sentinel coordinates ESPN occasionally emits (e.g. -214748365)
    if (rawX < -5 || rawX > 55 || rawY < -5 || rawY > 50) return null;

    const clampX = Math.max(0, Math.min(50, rawX));
    const clampY = Math.max(-2, Math.min(42, rawY));
    const dist = Math.hypot(clampX - 25, Math.max(0, clampY));
    const isThree = play.scoreValue === 3 || /three point|3-pt|3pt/i.test(play.text || '');

    let zone: RealShotEvent['zone'] = 'midrange';
    if (dist <= 4.5 && !isThree) {
      zone = 'restricted_area';
    } else if (Math.abs(clampX - 25) <= 8 && clampY <= 14.5 && !isThree) {
      zone = 'paint_non_ra';
    } else if (isThree && clampX <= 5.5 && clampY <= 10.5) {
      zone = 'corner_3_left';
    } else if (isThree && clampX >= 44.5 && clampY <= 10.5) {
      zone = 'corner_3_right';
    } else if (isThree) {
      zone = 'above_break_3';
    }

    const svgX = Math.round(10 + (clampX / 50) * 480);
    const svgY = Math.round(Math.max(18, Math.min(395, 52 + clampY * 8.4)));

    const playTeamId = String(play.team?.id || '');
    const isT1 = playTeamId === String(team1Id);
    const participant = play.participants?.[0]?.athlete;

    return {
      id: String(play.id || `${svgX}_${svgY}_${Math.random()}`),
      playerId: participant?.id ? String(participant.id) : undefined,
      playerName: participant?.displayName || (play.text || '').split(' ').slice(0, 2).join(' ') || 'Player',
      teamAbbr: isT1 ? t1Abbr : t2Abbr,
      teamSide: isT1 ? 'team1' : 'team2',
      period: Number(play.period?.number || 1),
      clock: String(play.clock?.displayValue || '12:00'),
      x: svgX,
      y: svgY,
      rawX: clampX,
      rawY: clampY,
      made: Boolean(play.scoringPlay),
      value: isThree ? 3 : 2,
      zone,
      shotType: String(play.type?.text || play.text || 'Field Goal'),
      xEfg: zone === 'restricted_area' ? 66.5 : zone === 'paint_non_ra' ? 44.0 : zone === 'midrange' ? 42.5 : zone === 'above_break_3' ? 54.5 : 59.0,
    };
  }

  /**
   * Detect PBPStats-style Scoring Runs ("Kill Shots" >= 8-0 unanswered runs) from live play-by-play
   */
  public computeScoringRuns(plays: any[], team1Id: string, t1Abbr: string, t1Name: string, t2Abbr: string, t2Name: string): ScoringRunBurst[] {
    const scoringPlays = (plays || []).filter((p: any) => p?.scoringPlay && Number(p.scoreValue) > 0);
    const runs: ScoringRunBurst[] = [];
    let curTeam = '';
    let ptsFor = 0;
    let startPeriod = 1;
    let startClock = '12:00';
    let endPeriod = 1;
    let endClock = '12:00';

    const flush = () => {
      if (ptsFor >= 8 && curTeam) {
        const isT1 = curTeam === String(team1Id);
        const abbr = isT1 ? t1Abbr : t2Abbr;
        const name = isT1 ? t1Name : t2Name;
        runs.push({
          teamAbbr: abbr,
          teamName: name,
          pointsFor: ptsFor,
          pointsAgainst: 0,
          startPeriod,
          startClock,
          endPeriod,
          endClock,
          summary: `${abbr} ${ptsFor}-0 unanswered run (Q${startPeriod} ${startClock} → Q${endPeriod} ${endClock})`,
        });
      }
    };

    for (const p of scoringPlays) {
      const tid = String(p.team?.id || '');
      const val = Number(p.scoreValue || 0);
      const qtr = Number(p.period?.number || 1);
      const clk = String(p.clock?.displayValue || '');
      if (tid === curTeam) {
        ptsFor += val;
        endPeriod = qtr;
        endClock = clk;
      } else {
        flush();
        curTeam = tid;
        ptsFor = val;
        startPeriod = qtr;
        startClock = clk;
        endPeriod = qtr;
        endClock = clk;
      }
    }
    flush();
    return runs.sort((a, b) => b.pointsFor - a.pointsFor).slice(0, 6);
  }

  /**
   * 6. Play-by-Play + Real Shot Coordinates + Scoring Runs + Win Probability Endpoint
   */
  public async getPlayByPlayAnalytics(eventId: string, rawSport?: string, rawLeague?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const summary = await this.fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${encodeURIComponent(eventId)}`);

    const comp = summary?.header?.competitions?.[0] || {};
    const cs: any[] = comp.competitors || [];
    const c1 = cs[0] || {};
    const c2 = cs[1] || {};
    const t1Id = String(c1.id || c1.team?.id || '1');
    const t1Abbr = c1.team?.abbreviation || 'TM1';
    const t2Abbr = c2.team?.abbreviation || 'TM2';
    const t1Name = c1.team?.displayName || 'Team 1';
    const t2Name = c2.team?.displayName || 'Team 2';

    const plays: any[] = summary?.plays || [];
    const shotCoordinates: RealShotEvent[] = sport === 'basketball'
      ? plays.map((p) => this.parseRealBasketballShot(p, t1Id, t1Abbr, t2Abbr)).filter(Boolean) as RealShotEvent[]
      : [];

    const scoringRuns = this.computeScoringRuns(plays, t1Id, t1Abbr, t1Name, t2Abbr, t2Name);
    const pick = summary?.pickcenter?.[0];

    const formattedPlays = plays.slice(-60).reverse().map((p: any) => ({
      id: String(p.id || ''),
      period: p.period?.displayValue || `Q${p.period?.number || 1}`,
      clock: p.clock?.displayValue || '',
      team: String(p.team?.id) === t1Id ? t1Abbr : (p.team?.id ? t2Abbr : ''),
      text: p.text || '',
      score: `${p.awayScore ?? '-'} - ${p.homeScore ?? '-'}`,
      scoringPlay: Boolean(p.scoringPlay),
      x: p.coordinate?.x ?? null,
      y: p.coordinate?.y ?? null,
    }));

    return {
      eventId,
      sport,
      league,
      fetchedAt: new Date().toISOString(),
      source: 'Live ESPN Summary / PBP API',
      matchup: `${t1Name} vs ${t2Name}`,
      status: comp.status?.type?.shortDetail || 'Live',
      bettingOdds: pick
        ? {
            provider: pick.provider?.name || 'Consensus',
            spread: pick.details || '',
            overUnder: pick.overUnder ?? null,
          }
        : null,
      totalPlays: plays.length,
      shotCoordinatesCount: shotCoordinates.length,
      shotCoordinates,
      scoringRuns,
      winProbabilityPoints: (summary?.winprobability || []).length,
      recentPlays: formattedPlays,
    };
  }

  /**
   * 7. Universal Live Search (Athletes + Teams across ESPN)
   */
  public async searchAll(query: string, sport?: string) {
    const q = (query || '').trim();
    if (!q) return { query: q, count: 0, results: [] };
    const raw = await this.fetchJson(`https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(q)}&limit=12`);
    const items: any[] = (raw?.items || [])
      .filter((it: any) => !sport || (it.sport || '').toLowerCase() === sport.toLowerCase())
      .map((it: any) => {
        const s = it.sport || 'basketball';
        const l = it.league || 'nba';
        const id = String(it.id || '');
        return {
          id,
          type: it.type || 'player',
          name: it.displayName || it.name || '',
          sport: s,
          league: l,
          team: it.teamRelationships?.[0]?.core?.displayName || '',
          teamAbbr: it.teamRelationships?.[0]?.core?.abbreviation || '',
          position: it.position?.abbreviation || '',
          headshot: it.type === 'player' ? `https://a.espncdn.com/i/headshots/${l}/players/full/${id}.png` : undefined,
          apiEndpoint: it.type === 'player' ? `/api/v1/athlete/${s}/${l}/${id}` : `/api/v1/data/team/${s}/${l}/${id}`,
        };
      });
    return {
      query: q,
      fetchedAt: new Date().toISOString(),
      source: 'Live ESPN Global Search API',
      count: items.length,
      results: items,
    };
  }

  /**
   * 8. Head-to-Head Matchup Intelligence Matrix (merges Standings, Form, Depth Charts, Injuries & Common Game Odds)
   */
  public async getHeadToHeadIntel(teamAQuery: string, teamBQuery: string, rawSport?: string, rawLeague?: string) {
    const { sport, league } = this.resolveSportLeague(rawSport, rawLeague);
    const t0 = Date.now();
    const [hubA, hubB, sb] = await Promise.all([
      this.getTeamHub(sport, league, teamAQuery),
      this.getTeamHub(sport, league, teamBQuery),
      this.getScoreboard(sport, league).catch(() => ({ events: [] })),
    ]);

    const stA = hubA.team.standing || {};
    const stB = hubB.team.standing || {};
    const winPctA = Number(stA.winPct || 0.5);
    const winPctB = Number(stB.winPct || 0.5);
    const diffA = Number(stA.diff || 0);
    const diffB = Number(stB.diff || 0);

    const recentWins = (games: any[]) => (games || []).slice(0, 5).filter((g) => g.result === 'W').length;
    const formA = recentWins(hubA.recentGames);
    const formB = recentWins(hubB.recentGames);

    // Check if they face each other on the active scoreboard
    const activeMatch = (sb.events || []).find((ev: any) =>
      (ev.awayAbbr === hubA.team.abbreviation && ev.homeAbbr === hubB.team.abbreviation) ||
      (ev.awayAbbr === hubB.team.abbreviation && ev.homeAbbr === hubA.team.abbreviation)
    );

    const edgeScore = Number((winPctA * 40 + diffA * 2.2 + formA * 2 - (winPctB * 40 + diffB * 2.2 + formB * 2)).toFixed(1));
    const favored = edgeScore >= 0 ? hubA.team : hubB.team;

    return {
      sport,
      league,
      provenance: {
        provider: 'espn' as ProviderName,
        fallbackUsed: false,
        fetchedAt: new Date().toISOString(),
        cacheStatus: 'MISS' as const,
        confidence: 'estimated' as const,
        latencyMs: Date.now() - t0,
      },
      matchupHeadline: `${hubA.team.name} (${hubA.team.record}) vs ${hubB.team.name} (${hubB.team.record})`,
      modelEdgeSummary: `${favored.name} hold the statistical composite edge (+${Math.abs(edgeScore)} pts model margin across WIN%, scoring differential, and L5 form). Note: composite edge is an analytical estimate derived from standings & recent results.`,
      activeScoreboardGame: activeMatch || null,
      comparisonMetrics: [
        { metric: 'Overall Record', teamA: hubA.team.record, teamB: hubB.team.record },
        { metric: 'Conference Standing', teamA: hubA.team.standingSummary || '-', teamB: hubB.team.standingSummary || '-' },
        { metric: 'Scoring For (PPG)', teamA: stA.pointsFor ?? '-', teamB: stB.pointsFor ?? '-' },
        { metric: 'Scoring Against (OPP)', teamA: stA.pointsAgainst ?? '-', teamB: stB.pointsAgainst ?? '-' },
        { metric: 'Net Point Diff', teamA: stA.diff ?? '-', teamB: stB.diff ?? '-' },
        { metric: 'Last 5 Form', teamA: `${formA}-` + `${Math.max(0, Math.min(5, (hubA.recentGames || []).slice(0, 5).length) - formA)}`, teamB: `${formB}-` + `${Math.max(0, Math.min(5, (hubB.recentGames || []).slice(0, 5).length) - formB)}` },
        { metric: 'Active Injuries', teamA: `${(hubA.injuries || []).length} Listed`, teamB: `${(hubB.injuries || []).length} Listed` },
      ],
      teamA: { ...hubA.team, injuries: hubA.injuries, depthChart: hubA.depthChart, recentGames: hubA.recentGames.slice(0, 5) },
      teamB: { ...hubB.team, injuries: hubB.injuries, depthChart: hubB.depthChart, recentGames: hubB.recentGames.slice(0, 5) },
    };
  }
}

export const sportsDataGateway = new SportsDataGateway();
