import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { DIMENSION_COLORS, DIMENSION_LABELS, Dimension } from './assessmentService';

export interface PerformanceReview {
  id?: string;
  tenant_id?: string;
  athlete_id: string;
  coach_id?: string | null;
  period_start: string;
  period_end: string;
  summary?: string | null;
  strengths?: string | null;
  improvements?: string | null;
  created_at?: string;
  updated_at?: string;
  coach?: { id: string; full_name: string } | null;
}

// One data point per assessment per skill
export interface ScorePoint {
  date: string;        // assessed_at (YYYY-MM-DD)
  skill_id: string;
  skill_name: string;
  dimension: Dimension;
  score: number;
  scale_min: number;
  scale_max: number;
}

// Aggregated per assessment date per dimension (average)
export interface DimensionSeries {
  dimension: Dimension;
  label: string;
  color: string;
  points: { date: string; avg: number }[];
}

export const evolutionService = {
  // ── Progress data ──────────────────────────────────────────────────────────
  async getProgressData(athleteId: string): Promise<{ series: DimensionSeries[]; rawPoints: ScorePoint[] }> {
    // Fetch all assessments for the athlete with scores + skill info
    const { data, error } = await supabase
      .from('assessments')
      .select(`
        id,
        assessed_at,
        scores:assessment_scores(
          score,
          skill:skills(
            id, name, scale_min, scale_max,
            category:skill_categories(dimension)
          )
        )
      `)
      .eq('athlete_id', athleteId)
      .order('assessed_at');

    if (error) throw error;
    if (!data?.length) return { series: [], rawPoints: [] };

    // Flatten into ScorePoint[]
    const rawPoints: ScorePoint[] = [];
    for (const assessment of data) {
      for (const scoreRow of (assessment.scores ?? []) as any[]) {
        const skill = scoreRow.skill;
        const dimension = skill?.category?.dimension as Dimension | undefined;
        if (!dimension) continue;
        rawPoints.push({
          date: assessment.assessed_at,
          skill_id: skill.id,
          skill_name: skill.name,
          dimension,
          score: scoreRow.score,
          scale_min: skill.scale_min ?? 1,
          scale_max: skill.scale_max ?? 10,
        });
      }
    }

    // Group by dimension → compute average per date
    const dimensions = [...new Set(rawPoints.map(p => p.dimension))] as Dimension[];
    const series: DimensionSeries[] = dimensions.map(dim => {
      const dimPoints = rawPoints.filter(p => p.dimension === dim);
      const dates = [...new Set(dimPoints.map(p => p.date))].sort();
      const points = dates.map(date => {
        const forDate = dimPoints.filter(p => p.date === date);
        // Normalize each score to 0-10 scale before averaging
        const normalized = forDate.map(p => {
          const range = p.scale_max - p.scale_min;
          return range > 0 ? ((p.score - p.scale_min) / range) * 10 : p.score;
        });
        const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;
        return { date, avg: Math.round(avg * 10) / 10 };
      });
      return {
        dimension: dim,
        label: DIMENSION_LABELS[dim],
        color: DIMENSION_COLORS[dim],
        points,
      };
    });

    return { series, rawPoints };
  },

  // ── Performance Reviews ───────────────────────────────────────────────────
  async getReviews(athleteId: string): Promise<PerformanceReview[]> {
    const { data, error } = await supabase
      .from('performance_reviews')
      .select('*, coach:profiles(id,full_name)')
      .eq('athlete_id', athleteId)
      .order('period_start', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PerformanceReview[];
  },

  async createReview(r: Omit<PerformanceReview, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'coach'>): Promise<PerformanceReview> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('performance_reviews')
      .insert({ ...r, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw error;
    return data as PerformanceReview;
  },

  async updateReview(id: string, r: Partial<PerformanceReview>): Promise<PerformanceReview> {
    const { coach: _, ...rest } = r;
    const { data, error } = await supabase
      .from('performance_reviews')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PerformanceReview;
  },

  async deleteReview(id: string): Promise<void> {
    const { error } = await supabase.from('performance_reviews').delete().eq('id', id);
    if (error) throw error;
  },
};
