const fs = require('fs');
const path = require('path');

const pagesDir = path.resolve(__dirname, '../pages');
const gfPath = path.join(pagesDir, 'GameForm.tsx');
let gf = fs.readFileSync(gfPath, 'utf8');

// 1. Add import
gf = gf.replace(
    "import { athleteService, Athlete } from '../services/athleteService';",
    "import { athleteService, Athlete } from '../services/athleteService';\r\nimport { useLanguage } from '../contexts/LanguageContext';"
);

// 2. Add hook inside component
gf = gf.replace(
    'const isEditing = !!id;\r\n',
    'const isEditing = !!id;\r\n    const { t } = useLanguage();\r\n'
);

// 3. Error messages
gf = gf.replace("setError('Erro ao carregar dados');", "setError(t('gameForm.error.loading'));");
gf = gf.replace("setError('Selecione uma competição');", "setError(t('gameForm.error.selectCompetition'));");
gf = gf.replace("setError('Erro ao salvar jogo');", "setError(t('gameForm.error.saving'));");

// 4. Tab labels
gf = gf.replace(
    "{ id: 'general' as TabType, label: 'Geral', icon: Calendar },",
    "{ id: 'general' as TabType, label: t('gameForm.tab.general'), icon: Calendar },"
);
gf = gf.replace(
    "{ id: 'lineup' as TabType, label: 'Relacionados', icon: Users },",
    "{ id: 'lineup' as TabType, label: t('gameForm.tab.lineup'), icon: Users },"
);

// 5. Header
gf = gf.replace(
    "{isEditing ? 'Editar Jogo' : 'Novo Jogo'}",
    "{isEditing ? t('gameForm.editTitle') : t('gameForm.newTitle')}"
);
gf = gf.replace(
    "{isEditing ? 'Atualize os dados do jogo' : 'Preencha os dados e adicione os relacionados'}",
    "{isEditing ? t('gameForm.editSubtitle') : t('gameForm.newSubtitle')}"
);

// 6. Save button
// Since common.save wasn't used, we'll keep Salvar, or check if we added a key. We didn't, so leaving Salvar

// 7. Section headers
gf = gf.replace(
    '\r\n                            Competição e Rodada\r\n',
    '\r\n                            {t(\'gameForm.section.competition\')}\r\n'
);
gf = gf.replace(
    '\r\n                            Data e Horário\r\n',
    '\r\n                            {t(\'trainingForm.section.dateTime\')}\r\n' // Reusing trainingForm's dateTime key
);
gf = gf.replace(
    '<h3 className="text-lg font-bold text-slate-800 mb-6">Confronto</h3>',
    '<h3 className="text-lg font-bold text-slate-800 mb-6">{t(\'gameForm.section.matchup\')}</h3>'
);

// 8. Field labels
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Competição *</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.competition\')} *</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Rodada / Fase</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.round\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.status\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Data</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.date\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Horário</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.time\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Local</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.venue\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Endereço</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.address\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Mandante</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.homeTeam\')}</label>'
);
gf = gf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Visitante</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'gameForm.field.awayTeam\')}</label>'
);
gf = gf.replace(
    '<span className="text-sm text-slate-600">Jogo em casa (somos o mandante)</span>',
    '<span className="text-sm text-slate-600">{t(\'gameForm.field.homeGame\')}</span>'
);

// 9. Select "Selecione" options
// Make sure to replace all globally
gf = gf.replaceAll("<option value=\"\">Selecione</option>", "<option value=\"\">{t('gameForm.field.select')}</option>");

// 10. Status dropdown options
gf = gf.replace(
    '{gameStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}',
    '{gameStatuses.map(s => { const statusKey: Record<string,string> = { scheduled: \'game.status.scheduled\', in_progress: \'game.status.inProgress\', finished: \'game.status.finished\', postponed: \'game.status.postponed\', cancelled: \'game.status.cancelled\' }; return <option key={s.value} value={s.value}>{t(statusKey[s.value]) || s.label}</option>; })}'
);

// 11. Add Players section
gf = gf.replace(
    '\r\n                                Adicionar Jogadores\r\n',
    '\r\n                                {t(\'gameForm.lineup.addPlayers\')}\r\n'
);
gf = gf.replace(
    "<option value=\"\">Selecione uma categoria</option>",
    "<option value=\"\">{t('gameForm.lineup.selectCategory')}</option>"
);
gf = gf.replace(
    '\r\n                                    Adicionar Categoria\r\n',
    '\r\n                                    {t(\'gameForm.lineup.addCategory\')}\r\n'
);
gf = gf.replace(
    "{showAthleteSelector ? 'Fechar' : 'Adicionar Individual'}",
    "{showAthleteSelector ? t('common.close') || 'Fechar' : t('gameForm.lineup.addIndividual')}"
);
gf = gf.replace(
    "<p className=\"text-center text-slate-400 py-4\">Todos os atletas já foram adicionados</p>",
    "<p className=\"text-center text-slate-400 py-4\">{t('gameForm.lineup.allAdded')}</p>"
);

// 12. Lineup list header
gf = gf.replace(
    '<h3 className="font-bold text-slate-800">Relacionados ({players.length})</h3>',
    '<h3 className="font-bold text-slate-800">{t(\'gameForm.lineup.related\')} ({players.length})</h3>'
);

// 13. Empty state
gf = gf.replace(
    '<p className="font-medium">Nenhum jogador relacionado</p>',
    '<p className="font-medium">{t(\'gameForm.lineup.noPlayers\')}</p>'
);
gf = gf.replace(
    '<p className="text-sm">Adicione jogadores usando as opções acima</p>',
    '<p className="text-sm">{t(\'gameForm.lineup.useOptions\')}</p>'
);

// 14. Table headers
gf = gf.replace(
    '<th className="px-4 py-3 text-left font-bold">Jogador</th>',
    '<th className="px-4 py-3 text-left font-bold">{t(\'gameForm.lineup.col.player\')}</th>'
);
gf = gf.replace(
    '<th className="px-3 py-3 text-left font-bold w-36">Posição</th>',
    '<th className="px-3 py-3 text-left font-bold w-36">{t(\'gameForm.lineup.col.position\')}</th>'
);
gf = gf.replace(
    '<th className="px-3 py-3 text-center font-bold w-16">Titular</th>',
    '<th className="px-3 py-3 text-center font-bold w-16">{t(\'gameForm.lineup.col.starter\')}</th>'
);
gf = gf.replace(
    '<th className="px-3 py-3 text-center font-bold w-20">Min</th>',
    '<th className="px-3 py-3 text-center font-bold w-20">{t(\'gameForm.lineup.col.minutes\')}</th>'
);

// 15. Placeholders
gf = gf.replace(
    'placeholder="Ex: Rodada 1, Quartas de Final"',
    'placeholder={t(\'gameForm.field.round\')}'
);
gf = gf.replace(
    'placeholder="Estádio / Campo"',
    'placeholder={t(\'gameForm.field.venue\')}'
);
gf = gf.replace(
    'placeholder="Endereço completo"',
    'placeholder={t(\'gameForm.field.address\')}'
);

fs.writeFileSync(gfPath, gf, 'utf8');
console.log('GameForm.tsx updated successfully!');
