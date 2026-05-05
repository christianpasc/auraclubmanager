
import { supabase } from '../lib/supabase';
import { getCurrentTenantId, athleteService, physiologyService } from './athleteService';

export type ProspectStatus =
    'observation' | 'registered' | 'technical_eval' | 'approved' | 'rejected' | 'monitoring';

export type ProspectPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ProspectSource   = 'indication' | 'event' | 'social' | 'game' | 'other';

// ── Evaluation types ──────────────────────────────────────────────────────────

export interface PillarScores { [criterion: string]: number | undefined }

export interface ProspectScores {
    technical?:     PillarScores;
    tactical?:      PillarScores;
    physical?:      PillarScores;
    psychological?: PillarScores;
}

export interface Prospect {
    id?: string;
    tenant_id?: string;
    full_name: string;
    birth_date?: string;
    position?: string;
    preferred_foot?: string;
    height_cm?: number;
    weight_kg?: number;
    city?: string;
    state?: string;
    current_club?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    source?: ProspectSource;
    status?: ProspectStatus;
    priority?: ProspectPriority;
    photo_url?: string;
    video_url?: string;
    notes?: string;
    scores?: ProspectScores;
    overall_score?: number | null;
    converted_athlete_id?: string | null;
    converted_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

// ── Static reference data ────────────────────────────────────────────────────

export const FUNNEL_STATUSES: {
    value: ProspectStatus;
    labelKey: string;
    color: string;
    bg: string;
    border: string;
    text: string;
    dot: string;
    next?: ProspectStatus;
}[] = [
    {
        value: 'observation',
        labelKey: 'prospects.status.observation',
        color: 'slate',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
        next: 'registered',
    },
    {
        value: 'registered',
        labelKey: 'prospects.status.registered',
        color: 'blue',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
        next: 'technical_eval',
    },
    {
        value: 'technical_eval',
        labelKey: 'prospects.status.technical_eval',
        color: 'amber',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        next: 'approved',
    },
    {
        value: 'approved',
        labelKey: 'prospects.status.approved',
        color: 'green',
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        dot: 'bg-green-500',
    },
    {
        value: 'rejected',
        labelKey: 'prospects.status.rejected',
        color: 'red',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        dot: 'bg-red-500',
    },
    {
        value: 'monitoring',
        labelKey: 'prospects.status.monitoring',
        color: 'orange',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        dot: 'bg-orange-400',
    },
];

export const PRIORITY_META: Record<ProspectPriority, {
    labelKey: string; bg: string; text: string; border: string;
}> = {
    low:    { labelKey: 'prospects.priority.low',    bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-200' },
    normal: { labelKey: 'prospects.priority.normal', bg: 'bg-blue-100',   text: 'text-blue-600',   border: 'border-blue-200'  },
    high:   { labelKey: 'prospects.priority.high',   bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200'},
    urgent: { labelKey: 'prospects.priority.urgent', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200'   },
};

export const SOURCE_META: Record<ProspectSource, { labelKey: string }> = {
    indication: { labelKey: 'prospects.source.indication' },
    event:      { labelKey: 'prospects.source.event'      },
    social:     { labelKey: 'prospects.source.social'     },
    game:       { labelKey: 'prospects.source.game'       },
    other:      { labelKey: 'prospects.source.other'      },
};

export const EVALUATION_PILLARS: {
    key: keyof ProspectScores;
    labelKey: string;
    weight: number;
    bg: string; text: string; border: string;
    criteria: { key: string; labelKey: string }[];
}[] = [
    {
        key: 'technical', labelKey: 'prospects.eval.technical', weight: 0.35,
        bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
        criteria: [
            { key: 'dribbling',    labelKey: 'prospects.eval.dribbling'   },
            { key: 'passing',      labelKey: 'prospects.eval.passing'     },
            { key: 'shooting',     labelKey: 'prospects.eval.shooting'    },
            { key: 'ball_control', labelKey: 'prospects.eval.ballControl' },
            { key: 'positioning',  labelKey: 'prospects.eval.positioning' },
        ],
    },
    {
        key: 'tactical', labelKey: 'prospects.eval.tactical', weight: 0.25,
        bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
        criteria: [
            { key: 'game_reading',    labelKey: 'prospects.eval.gameReading'    },
            { key: 'pressing',        labelKey: 'prospects.eval.pressing'       },
            { key: 'movement',        labelKey: 'prospects.eval.movement'       },
            { key: 'decision_making', labelKey: 'prospects.eval.decisionMaking' },
        ],
    },
    {
        key: 'physical', labelKey: 'prospects.eval.physical', weight: 0.25,
        bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200',
        criteria: [
            { key: 'speed',     labelKey: 'prospects.eval.speed'     },
            { key: 'strength',  labelKey: 'prospects.eval.strength'  },
            { key: 'endurance', labelKey: 'prospects.eval.endurance' },
            { key: 'agility',   labelKey: 'prospects.eval.agility'   },
        ],
    },
    {
        key: 'psychological', labelKey: 'prospects.eval.psychological', weight: 0.15,
        bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200',
        criteria: [
            { key: 'leadership',     labelKey: 'prospects.eval.leadership'    },
            { key: 'attitude',       labelKey: 'prospects.eval.attitude'      },
            { key: 'under_pressure', labelKey: 'prospects.eval.underPressure' },
            { key: 'coachability',   labelKey: 'prospects.eval.coachability'  },
        ],
    },
];

export const FOOTBALL_POSITIONS = [
    'Goleiro', 'Lateral Direito', 'Lateral Esquerdo',
    'Zagueiro', 'Volante', 'Meia Defensivo',
    'Meia', 'Meia Atacante', 'Ponta Direita',
    'Ponta Esquerda', 'Segundo Atacante', 'Centroavante',
];

// ── Service ──────────────────────────────────────────────────────────────────

export const prospectService = {
    async getAll(): Promise<Prospect[]> {
        const { data, error } = await supabase
            .from('prospects')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as Prospect[];
    },

    async getById(id: string): Promise<Prospect> {
        const { data, error } = await supabase
            .from('prospects')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Prospect;
    },

    async create(prospect: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>): Promise<Prospect> {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');
        const { data, error } = await supabase
            .from('prospects')
            .insert({ ...prospect, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Prospect;
    },

    async update(id: string, prospect: Partial<Prospect>): Promise<Prospect> {
        const { data, error } = await supabase
            .from('prospects')
            .update({ ...prospect, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Prospect;
    },

    async updateStatus(id: string, status: ProspectStatus): Promise<Prospect> {
        return this.update(id, { status });
    },

    async updateScores(id: string, scores: ProspectScores): Promise<Prospect> {
        const overall_score = calcOverallScore(scores) ?? undefined;
        return this.update(id, { scores: scores as any, overall_score });
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('prospects').delete().eq('id', id);
        if (error) throw error;
    },

    async convertToAthlete(prospectId: string): Promise<string> {
        const prospect = await this.getById(prospectId);
        if (prospect.converted_athlete_id) return prospect.converted_athlete_id;

        const athlete = await athleteService.create({
            full_name:                  prospect.full_name,
            birth_date:                 prospect.birth_date,
            position:                   prospect.position,
            dominant_foot:              prospect.preferred_foot,
            city:                       prospect.city,
            state:                      prospect.state,
            email:                      prospect.contact_email,
            phone:                      prospect.contact_phone,
            emergency_contact_name:     prospect.contact_name,
            emergency_contact_phone:    prospect.contact_phone,
            status:                     'active',
            join_date:                  new Date().toISOString().split('T')[0],
        });

        if (prospect.height_cm || prospect.weight_kg) {
            await physiologyService.create(athlete.id!, {
                measurement_date: new Date().toISOString().split('T')[0],
                height_cm: prospect.height_cm,
                weight_kg: prospect.weight_kg,
            });
        }

        await this.update(prospectId, {
            converted_athlete_id: athlete.id,
            converted_at:         new Date().toISOString(),
            status:               'approved',
        });

        return athlete.id!;
    },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function calcAge(birthDate?: string): number | null {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export function calcOverallScore(scores?: ProspectScores): number | null {
    if (!scores || Object.keys(scores).length === 0) return null;
    const pillarAvgs: { avg: number; weight: number }[] = [];
    for (const pillar of EVALUATION_PILLARS) {
        const ps = scores[pillar.key];
        if (!ps) continue;
        const vals = Object.values(ps).filter((v): v is number => typeof v === 'number' && v > 0);
        if (vals.length === 0) continue;
        pillarAvgs.push({ avg: vals.reduce((a, b) => a + b, 0) / vals.length, weight: pillar.weight });
    }
    if (pillarAvgs.length === 0) return null;
    const totalW = pillarAvgs.reduce((s, p) => s + p.weight, 0);
    return Math.round((pillarAvgs.reduce((s, p) => s + p.avg * p.weight, 0) / totalW) * 10) / 10;
}

export function getStatusMeta(status?: ProspectStatus) {
    return FUNNEL_STATUSES.find(s => s.value === status) ?? FUNNEL_STATUSES[0];
}
