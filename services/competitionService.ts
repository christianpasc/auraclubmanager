
import { supabase } from '../lib/supabase';
import { getCurrentTenantId } from './athleteService';

export interface Competition {
    id?: string;
    tenant_id?: string;
    name: string;
    type?: string;
    category?: string;
    season?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    organizer?: string;
    status?: string;
    description?: string;
    logo_url?: string;
    // Final stats
    final_position?: number;
    total_teams?: number;
    wins?: number;
    draws?: number;
    losses?: number;
    goals_for?: number;
    goals_against?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Game {
    id?: string;
    tenant_id?: string;
    competition_id?: string;
    game_date?: string;
    game_time?: string;
    round?: string;
    home_team?: string;
    away_team?: string;
    is_home_game?: boolean;
    home_score?: number;
    away_score?: number;
    venue?: string;
    address?: string;
    status?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    // Joined
    competition?: Competition;
}

export const competitionService = {
    async getAll() {
        const { data, error } = await supabase
            .from('competitions')
            .select('*')
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data as Competition[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('competitions')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Competition;
    },

    async create(competition: Omit<Competition, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('competitions')
            .insert({ ...competition, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Competition;
    },

    async update(id: string, competition: Partial<Competition>) {
        const { data, error } = await supabase
            .from('competitions')
            .update({ ...competition, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Competition;
    },

    async delete(id: string) {
        const { error } = await supabase.from('competitions').delete().eq('id', id);
        if (error) throw error;
    },
};

export const gameService = {
    async getAll() {
        const { data, error } = await supabase
            .from('games')
            .select(`*, competition:competitions(*)`)
            .order('game_date', { ascending: true });
        if (error) throw error;
        return data as Game[];
    },

    async getByCompetition(competitionId: string) {
        const { data, error } = await supabase
            .from('games')
            .select('*')
            .eq('competition_id', competitionId)
            .order('game_date', { ascending: true });
        if (error) throw error;
        return data as Game[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('games')
            .select(`*, competition:competitions(*)`)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Game;
    },

    async create(game: Omit<Game, 'id' | 'created_at' | 'updated_at' | 'competition'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('games')
            .insert({ ...game, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Game;
    },

    async createMany(games: Omit<Game, 'id' | 'created_at' | 'updated_at' | 'competition'>[]) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const gamesWithTenant = games.map(g => ({ ...g, tenant_id }));
        const { data, error } = await supabase
            .from('games')
            .insert(gamesWithTenant)
            .select();
        if (error) throw error;
        return data as Game[];
    },

    async update(id: string, game: Partial<Game>) {
        const { competition, ...gameData } = game;
        const { data, error } = await supabase
            .from('games')
            .update({ ...gameData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Game;
    },

    async delete(id: string) {
        const { error } = await supabase.from('games').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteByCompetition(competitionId: string) {
        const { error } = await supabase.from('games').delete().eq('competition_id', competitionId);
        if (error) throw error;
    },
};

export interface GamePlayer {
    id?: string;
    tenant_id?: string;
    game_id?: string;
    athlete_id?: string;
    position?: string;
    is_starter?: boolean;
    minutes_played?: number;
    goals?: number;
    assists?: number;
    yellow_cards?: number;
    red_cards?: number;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    // Joined
    athlete?: {
        id: string;
        full_name: string;
        photo_url?: string;
        category?: string;
        position?: string;
    };
}

export const gamePlayerService = {
    async getByGame(gameId: string) {
        const { data, error } = await supabase
            .from('game_players')
            .select(`
                *,
                athlete:athletes(id, full_name, photo_url, category, position)
            `)
            .eq('game_id', gameId)
            .order('is_starter', { ascending: false });
        if (error) throw error;
        return data as GamePlayer[];
    },

    async create(gamePlayer: Omit<GamePlayer, 'id' | 'created_at' | 'updated_at' | 'athlete'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('game_players')
            .insert({ ...gamePlayer, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as GamePlayer;
    },

    async createMany(gamePlayers: Omit<GamePlayer, 'id' | 'created_at' | 'updated_at' | 'athlete'>[]) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const playersWithTenant = gamePlayers.map(p => ({ ...p, tenant_id }));
        const { data, error } = await supabase
            .from('game_players')
            .insert(playersWithTenant)
            .select();
        if (error) throw error;
        return data as GamePlayer[];
    },

    async update(id: string, gamePlayer: Partial<GamePlayer>) {
        const { athlete, ...playerData } = gamePlayer;
        const { data, error } = await supabase
            .from('game_players')
            .update({ ...playerData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as GamePlayer;
    },

    async delete(id: string) {
        const { error } = await supabase.from('game_players').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteByGame(gameId: string) {
        const { error } = await supabase.from('game_players').delete().eq('game_id', gameId);
        if (error) throw error;
    },

    async upsertMany(gameId: string, gamePlayers: Partial<GamePlayer>[]) {
        // Delete existing and recreate
        await this.deleteByGame(gameId);
        if (gamePlayers.length > 0) {
            const toInsert = gamePlayers.map(p => ({
                ...p,
                game_id: gameId,
            }));
            return this.createMany(toInsert as any);
        }
        return [];
    },
};

export const competitionTypes = [
    { value: 'league', label: 'Liga/Campeonato' },
    { value: 'cup', label: 'Copa' },
    { value: 'tournament', label: 'Torneio' },
    { value: 'friendly', label: 'Amistoso' },
];

export const competitionStatuses = [
    { value: 'upcoming', label: 'Próxima', color: 'warning' },
    { value: 'ongoing', label: 'Em Andamento', color: 'success' },
    { value: 'finished', label: 'Finalizada', color: 'neutral' },
    { value: 'cancelled', label: 'Cancelada', color: 'error' },
];

export const gameStatuses = [
    { value: 'scheduled', label: 'Agendado', color: 'neutral' },
    { value: 'in_progress', label: 'Em Andamento', color: 'warning' },
    { value: 'finished', label: 'Finalizado', color: 'success' },
    { value: 'postponed', label: 'Adiado', color: 'warning' },
    { value: 'cancelled', label: 'Cancelado', color: 'error' },
];

