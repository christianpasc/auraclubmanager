
export type ModuleKey =
    | 'athletes'
    | 'training'
    | 'games'
    | 'enrollments'
    | 'finance'
    | 'competitions'
    | 'scouting'
    | 'tactical'
    | 'assessments'
    | 'development_plans'
    | 'drill_library'
    | 'video_analysis'
    | 'performance_stats'
    | 'structure'
    | 'site_marketing'
    | 'facilities';

export interface PlanModule {
    key: ModuleKey;
    labelPt: string;
    description: string;
    emoji: string;
}

export const PLAN_MODULES: PlanModule[] = [
    { key: 'athletes',     labelPt: 'Cadastro de Atletas', description: 'Gerenciar atletas e fichas do clube',    emoji: '👥' },
    { key: 'training',     labelPt: 'Treinos',              description: 'Planejar e registrar sessões de treino', emoji: '⚽' },
    { key: 'games',        labelPt: 'Jogos',                description: 'Registrar partidas e resultados',        emoji: '🏆' },
    { key: 'enrollments',  labelPt: 'Matrículas',           description: 'Matrículas e mensalidades de alunos',    emoji: '📋' },
    { key: 'finance',      labelPt: 'Financeiro',           description: 'Controle financeiro completo',           emoji: '💰' },
    { key: 'competitions', labelPt: 'Competições',          description: 'Gerenciar torneios e competições',       emoji: '🥇' },
    { key: 'scouting',     labelPt: 'Prospecção',           description: 'Sistema de scouting de novos atletas',   emoji: '🔭' },
    { key: 'tactical',          labelPt: 'Mesa Tática',                description: 'Lousa tática interativa',                              emoji: '📊' },
    { key: 'assessments',       labelPt: 'Avaliações Técnicas',        description: 'Avaliar habilidades dos atletas por dimensão',          emoji: '📋' },
    { key: 'development_plans', labelPt: 'Planos de Desenvolvimento',  description: 'PDI com metas individuais por atleta',                  emoji: '🎯' },
    { key: 'drill_library',     labelPt: 'Biblioteca de Treinos',      description: 'Exercícios e planos de sessão categorizados',           emoji: '📚' },
    { key: 'video_analysis',    labelPt: 'Análise de Vídeo',           description: 'Upload, recorte e marcação de vídeos com controle de acesso', emoji: '🎬' },
    { key: 'performance_stats', labelPt: 'Estatísticas de Desempenho', description: 'Estatísticas por atleta e por jogo',                   emoji: '📊' },
    { key: 'structure',     labelPt: 'Estrutura',           description: 'Temporadas, categorias, turmas e responsáveis',        emoji: '🗂️' },
    { key: 'site_marketing', labelPt: 'Site & Marketing',   description: 'Site do clube, convites, loja virtual e patrocinadores', emoji: '🌐' },
    { key: 'facilities',    labelPt: 'Instalações',         description: 'Reserva de quadras, campos e salas',                    emoji: '📅' },
];

export type ModuleFeatures = Partial<Record<ModuleKey, boolean>>;

// Returns true when the module is accessible.
// Empty {} means no restrictions → all modules enabled (backwards compatible).
// Only when the key is explicitly set to false (or absent from a non-empty object) is it locked.
export function isModuleEnabled(moduleFeatures: ModuleFeatures, key: ModuleKey): boolean {
    if (Object.keys(moduleFeatures).length === 0) return true;
    return moduleFeatures[key] === true;
}

// Permissive union of several ModuleFeatures objects: if any source has no
// restrictions ({}), the result has none either; otherwise a key is enabled
// if it's true in any source. Used to merge the legacy school/club module
// lists into one without ever taking away access a tenant already has today.
export function mergeModuleFeatures(...sources: ModuleFeatures[]): ModuleFeatures {
    if (sources.some(s => Object.keys(s).length === 0)) return {};
    const merged: ModuleFeatures = {};
    for (const source of sources) {
        for (const key of Object.keys(source) as ModuleKey[]) {
            if (source[key] === true) merged[key] = true;
        }
    }
    return merged;
}
