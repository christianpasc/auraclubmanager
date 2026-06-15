
import { supabase } from '../lib/supabase';
import { Game } from './competitionService';
import { Training } from './trainingService';

export interface DashboardStats {
    totalAthletes: number;
    activeEnrollments: number;
    totalEnrollments: number;
    pendingFeesCount: number;
    overdueFeesCount: number;
}

export interface UpcomingGame extends Game {
    competition?: {
        id: string;
        name: string;
        type?: string;
    };
}

export interface FinancialFlowData {
    name: string;
    revenue: number;
    expenses: number;
}

export interface AssessmentSummary {
    recentCount: number;
    avgByDimension: { dimension: string; label: string; avg: number }[];
}

export interface AthleteStatusItem {
    status: string;
    count: number;
}

export interface InvitationGameSummary {
    gameLabel: string;
    accepted: number;
    declined: number;
    pending: number;
    total: number;
}

export const dashboardService = {
    async getStats(): Promise<DashboardStats> {
        // Get total athletes count
        const { count: athletesCount, error: athletesError } = await supabase
            .from('athletes')
            .select('*', { count: 'exact', head: true });

        if (athletesError) throw athletesError;

        // Get enrollments counts
        const { data: enrollments, error: enrollmentsError } = await supabase
            .from('enrollments')
            .select('status');

        if (enrollmentsError) throw enrollmentsError;

        const activeEnrollments = enrollments?.filter(e => e.status === 'active').length || 0;
        const totalEnrollments = enrollments?.length || 0;

        // Get pending monthly fees count
        const { count: pendingFeesCount, error: pendingFeesError } = await supabase
            .from('monthly_fees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (pendingFeesError) throw pendingFeesError;

        // Get overdue monthly fees count
        const { count: overdueFeesCount, error: overdueFeesError } = await supabase
            .from('monthly_fees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'overdue');

        if (overdueFeesError) throw overdueFeesError;

        return {
            totalAthletes: athletesCount || 0,
            activeEnrollments,
            totalEnrollments,
            pendingFeesCount: pendingFeesCount || 0,
            overdueFeesCount: overdueFeesCount || 0,
        };
    },

    async getUpcomingGames(limit: number = 3): Promise<UpcomingGame[]> {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('games')
            .select(`
                *,
                competition:competitions(id, name, type)
            `)
            .gte('game_date', today)
            .order('game_date', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data as UpcomingGame[];
    },

    async getNextTraining(): Promise<Training | null> {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format

        // First, try to get trainings scheduled for today or later
        const { data, error } = await supabase
            .from('trainings')
            .select('*')
            .gte('training_date', today)
            .in('status', ['scheduled', 'in_progress'])
            .order('training_date', { ascending: true })
            .order('training_time', { ascending: true })
            .limit(10);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        // Filter to find the next training that hasn't passed yet
        for (const training of data) {
            if (training.training_date > today) {
                return training as Training;
            }
            // If it's today, check if the time hasn't passed yet
            if (training.training_date === today) {
                if (!training.training_time || training.training_time >= currentTime) {
                    return training as Training;
                }
            }
        }

        return null;
    },

    async getFinancialFlowData(viewType: 'weekly' | 'monthly' = 'monthly'): Promise<FinancialFlowData[]> {
        const now = new Date();
        let startDate: Date;

        if (viewType === 'weekly') {
            // Last 7 weeks
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - (7 * 7));
        } else {
            // Last 6 months
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 5);
            startDate.setDate(1);
        }

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) throw error;

        const flowData: FinancialFlowData[] = [];

        if (viewType === 'weekly') {
            // Group by week
            for (let i = 6; i >= 0; i--) {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - (i * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const weekTransactions = transactions?.filter(t => {
                    const date = new Date(t.date);
                    return date >= weekStart && date <= weekEnd;
                }) || [];

                const revenue = weekTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + Number(t.amount), 0);
                const expenses = weekTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                flowData.push({
                    name: `Sem ${7 - i}`,
                    revenue,
                    expenses,
                });
            }
        } else {
            // Group by month
            const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date(now);
                monthDate.setMonth(monthDate.getMonth() - i);
                const month = monthDate.getMonth();
                const year = monthDate.getFullYear();

                const monthTransactions = transactions?.filter(t => {
                    const date = new Date(t.date);
                    return date.getMonth() === month && date.getFullYear() === year;
                }) || [];

                const revenue = monthTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + Number(t.amount), 0);
                const expenses = monthTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                flowData.push({
                    name: monthNames[month],
                    revenue,
                    expenses,
                });
            }
        }

        return flowData;
    },

    async getAssessmentSummary(): Promise<AssessmentSummary> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: assessments } = await supabase
            .from('assessments')
            .select('id, created_at');

        if (!assessments || assessments.length === 0) {
            return { recentCount: 0, avgByDimension: [] };
        }

        const recentCount = assessments.filter(
            a => new Date(a.created_at) >= thirtyDaysAgo
        ).length;

        const { data: scores } = await supabase
            .from('assessment_scores')
            .select(`
                score,
                skill:skills(
                    scale_min,
                    scale_max,
                    category:skill_categories(dimension)
                )
            `)
            .in('assessment_id', assessments.map(a => a.id));

        const byDimension: Record<string, { sum: number; count: number }> = {};
        for (const row of scores || []) {
            const skill = row.skill as any;
            const dim = skill?.category?.dimension;
            if (!dim || row.score == null) continue;
            const min = Number(skill.scale_min ?? 0);
            const max = Number(skill.scale_max ?? 10);
            const normalized = max > min ? ((Number(row.score) - min) / (max - min)) * 10 : Number(row.score);
            if (!byDimension[dim]) byDimension[dim] = { sum: 0, count: 0 };
            byDimension[dim].sum += normalized;
            byDimension[dim].count++;
        }

        const DIMENSION_LABELS: Record<string, string> = {
            technical: 'Técnico',
            tactical: 'Tático',
            physical: 'Físico',
            psychological: 'Psicológico',
        };

        const avgByDimension = Object.entries(byDimension).map(([dimension, { sum, count }]) => ({
            dimension,
            label: DIMENSION_LABELS[dimension] || dimension,
            avg: Math.round((sum / count) * 10) / 10,
        }));

        return { recentCount, avgByDimension };
    },

    async getStorePendingOrders(): Promise<number> {
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        return count || 0;
    },

    async getRecentGameResults(limit: number = 3): Promise<UpcomingGame[]> {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('games')
            .select('*, competition:competitions(id, name, type)')
            .lt('game_date', today)
            .not('home_score', 'is', null)
            .order('game_date', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []) as UpcomingGame[];
    },

    async getAthleteStatusDistribution(): Promise<AthleteStatusItem[]> {
        const { data } = await supabase
            .from('athletes')
            .select('status');

        const counts: Record<string, number> = {};
        for (const a of data || []) {
            const s = a.status || 'active';
            counts[s] = (counts[s] || 0) + 1;
        }

        return Object.entries(counts).map(([status, count]) => ({ status, count }));
    },

    async getInvitationSummary(): Promise<InvitationGameSummary[]> {
        const { data } = await supabase
            .from('invitations')
            .select('game_id, status, game:games(home_team, away_team, game_date)')
            .not('game_id', 'is', null);

        if (!data) return [];

        const byGame: Record<string, { label: string; date: string; accepted: number; declined: number; pending: number }> = {};

        for (const inv of data) {
            const game = inv.game as any;
            if (!inv.game_id || !game) continue;
            if (!byGame[inv.game_id]) {
                byGame[inv.game_id] = {
                    label: `${game.home_team || '?'} × ${game.away_team || '?'}`,
                    date: game.game_date || '',
                    accepted: 0,
                    declined: 0,
                    pending: 0,
                };
            }
            if (inv.status === 'accepted') byGame[inv.game_id].accepted++;
            else if (inv.status === 'declined') byGame[inv.game_id].declined++;
            else byGame[inv.game_id].pending++;
        }

        return Object.values(byGame)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 4)
            .map(({ label, accepted, declined, pending }) => ({
                gameLabel: label,
                accepted,
                declined,
                pending,
                total: accepted + declined + pending,
            }));
    },
};
