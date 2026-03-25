const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../pages/CompetitionForm.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add import
if (!content.includes("import { useLanguage }")) {
    content = content.replace(
        "import {\n    competitionService",
        "import { useLanguage } from '../contexts/LanguageContext';\nimport {\n    competitionService"
    );
}

// 2. Add hook inside component
if (!content.includes("const { t } = useLanguage();")) {
    content = content.replace(
        "const CompetitionForm: React.FC = () => {",
        "const CompetitionForm: React.FC = () => {\n    const { t } = useLanguage();"
    );
}

// 3. String Replacements
const replacements = [
    // Errors
    ["'Erro ao carregar competição'", "t('competitionForm.error.loading')"],
    ["'O nome da competição é obrigatório'", "t('competitionForm.error.nameRequired')"],
    ["'Erro ao salvar competição'", "t('competitionForm.error.saving')"],
    
    // Header
    ["isEditing ? 'Editar Competição' : 'Nova Competição'", "isEditing ? t('competitionForm.editTitle') : t('competitionForm.newTitle')"],
    ["isEditing ? 'Atualize os dados da competição' : 'Preencha os dados e adicione os jogos'", "isEditing ? t('competitionForm.editSubtitle') : t('competitionForm.newSubtitle')"],
    
    // Section Titles
    [">Informações da Competição<", ">{t('competitionForm.section.info')}<"],
    [">🏅 Resultado Final<", ">🏅 {t('competitionForm.section.results')}<"],
    [/Jogos \(\{games\.length\}\)/g, "{t('competitionForm.section.games')} ({games.length})"],
    
    // Field Labels
    [">Nome *<", ">{t('competitionForm.field.name')} *<"],
    [">Tipo<", ">{t('competitionForm.field.type')}<"],
    [">Categoria<", ">{t('competitionForm.field.category')}<"],
    [">Temporada<", ">{t('competitionForm.field.season')}<"],
    [">Início<", ">{t('competitionForm.field.startDate')}<"],
    [">Fim<", ">{t('competitionForm.field.endDate')}<"],
    [">Status<", ">{t('competitionForm.field.status')}<"],
    [">Organizador<", ">{t('competitionForm.field.organizer')}<"],
    [">Descrição<", ">{t('competitionForm.field.description')}<"],
    
    // Stats Section
    [">Colocação Final<", ">{t('competitionForm.stats.finalPosition')}<"],
    [">Total de Equipes<", ">{t('competitionForm.stats.totalTeams')}<"],
    [">Estatísticas<", ">{t('competitionForm.stats.title')}<"],
    [">Vitórias<", ">{t('competitionForm.stats.wins')}<"],
    [">Empates<", ">{t('competitionForm.stats.draws')}<"],
    [">Derrotas<", ">{t('competitionForm.stats.losses')}<"],
    [">Gols Pró<", ">{t('competitionForm.stats.goalsFor')}<"],
    [">Gols Contra<", ">{t('competitionForm.stats.goalsAgainst')}<"],

    // Games Section
    [">Adicionar Jogo<", ">{t('competitionForm.game.add')}<"],
    [">Nenhum jogo cadastrado<", ">{t('competitionForm.game.empty')}<"],
    [">Clique em \"Adicionar Jogo\" para começar<", ">{t('competitionForm.game.emptyDesc')}<"],
    [">Data<", ">{t('gameForm.field.date')}<"],
    [">Horário<", ">{t('gameForm.field.time')}<"],
    [">Mandante<", ">{t('gameForm.field.homeTeam')}<"],
    [">Visitante<", ">{t('gameForm.field.awayTeam')}<"],
    [">Local<", ">{t('competitionForm.game.venue')}<"],
    [">Placar<", ">{t('competitionForm.game.score')}<"],
    [">Jogo em casa<", ">{t('gameForm.field.isHome')}<"],
    
    // Buttons
    [">Salvar<", ">{t('athleteForm.button.save')}<"],
];

for (const [search, replace] of replacements) {
    if (search instanceof RegExp) {
        content = content.replace(search, replace);
    } else {
        content = content.split(search).join(replace);
    }
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated CompetitionForm.tsx');
