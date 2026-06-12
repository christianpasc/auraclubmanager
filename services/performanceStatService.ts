import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface PerformanceStat {
  id?: string;
  tenant_id?: string;
  athlete_id: string;
  game_id?: string | null;
  stat_key: string;
  stat_value: number;
  recorded_by?: string | null;
  created_at?: string;
}

export interface AthleteStatRow {
  athlete_id: string;
  athlete_name: string;
  stats: Record<string, number>;
}

export interface GameStatMap {
  [athlete_id: string]: Record<string, number>;
}

export const STAT_KEYS: { key: string; label: string; short: string }[] = [
  { key: 'minutes_played',   label: 'Minutos',      short: 'Min' },
  { key: 'goals',            label: 'Gols',         short: 'G' },
  { key: 'assists',          label: 'Assistências', short: 'A' },
  { key: 'shots',            label: 'Chutes',       short: 'Ch' },
  { key: 'shots_on_target',  label: 'Chutes a gol', short: 'CG' },
  { key: 'passes',           label: 'Passes',       short: 'Pa' },
  { key: 'tackles',          label: 'Duelos',       short: 'Du' },
  { key: 'saves',            label: 'Defesas',      short: 'Def' },
  { key: 'yellow_cards',     label: 'Amarelos',     short: 'Am' },
  { key: 'red_cards',        label: 'Vermelhos',    short: 'Ve' },
];

export const performanceStatService = {
  // ── Game stats ────────────────────────────────────────────────────────────
  async getByGame(gameId: string): Promise<GameStatMap> {
    const { data, error } = await supabase
      .from('performance_stats')
      .select('athlete_id, stat_key, stat_value')
      .eq('game_id', gameId);
    if (error) throw error;

    const map: GameStatMap = {};
    for (const row of data ?? []) {
      if (!map[row.athlete_id]) map[row.athlete_id] = {};
      map[row.athlete_id][row.stat_key] = Number(row.stat_value);
    }
    return map;
  },

  async saveGameStats(
    gameId: string,
    rows: { athlete_id: string; stats: Record<string, number> }[]
  ): Promise<void> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

    // Delete all existing stats for this game
    await supabase.from('performance_stats').delete().eq('game_id', gameId);

    const inserts: Omit<PerformanceStat, 'id' | 'created_at'>[] = [];
    for (const row of rows) {
      for (const [stat_key, stat_value] of Object.entries(row.stats)) {
        if (stat_value > 0) {
          inserts.push({ tenant_id: tenantId, athlete_id: row.athlete_id, game_id: gameId, stat_key, stat_value, recorded_by: userId });
        }
      }
    }

    if (inserts.length === 0) return;
    const { error } = await supabase.from('performance_stats').insert(inserts);
    if (error) throw error;
  },

  // ── Athlete stats ─────────────────────────────────────────────────────────
  async getByAthlete(athleteId: string): Promise<PerformanceStat[]> {
    const { data, error } = await supabase
      .from('performance_stats')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PerformanceStat[];
  },

  async getAthleteAggregate(athleteId: string): Promise<Record<string, number>> {
    const stats = await performanceStatService.getByAthlete(athleteId);
    const agg: Record<string, number> = {};
    for (const s of stats) {
      agg[s.stat_key] = (agg[s.stat_key] ?? 0) + Number(s.stat_value);
    }
    return agg;
  },

  // Returns per-game totals for chart rendering
  async getAthletePerGame(
    athleteId: string
  ): Promise<{ game_id: string; stats: Record<string, number> }[]> {
    const { data, error } = await supabase
      .from('performance_stats')
      .select('game_id, stat_key, stat_value')
      .eq('athlete_id', athleteId)
      .not('game_id', 'is', null);
    if (error) throw error;

    const byGame: Record<string, Record<string, number>> = {};
    for (const row of data ?? []) {
      const gid = row.game_id as string;
      if (!byGame[gid]) byGame[gid] = {};
      byGame[gid][row.stat_key] = (byGame[gid][row.stat_key] ?? 0) + Number(row.stat_value);
    }
    return Object.entries(byGame).map(([game_id, stats]) => ({ game_id, stats }));
  },
};
