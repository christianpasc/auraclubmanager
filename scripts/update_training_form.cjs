const fs = require('fs');
const path = require('path');

const pagesDir = path.resolve(__dirname, '../pages');

// ========================
// TrainingForm.tsx
// ========================
const tfPath = path.join(pagesDir, 'TrainingForm.tsx');
let tf = fs.readFileSync(tfPath, 'utf8');

// 1. Add import
tf = tf.replace(
    "import { athleteService, Athlete } from '../services/athleteService';",
    "import { athleteService, Athlete } from '../services/athleteService';\r\nimport { useLanguage } from '../contexts/LanguageContext';"
);

// 2. Add hook inside component (after isEditing)
tf = tf.replace(
    'const isEditing = !!id;\r\n',
    'const isEditing = !!id;\r\n    const { t } = useLanguage();\r\n'
);

// 3. Error messages
tf = tf.replace("setError('Erro ao carregar dados');", "setError(t('trainingForm.error.loading'));");
tf = tf.replace("setError('Selecione uma data para o treino');", "setError(t('trainingForm.error.selectDate'));");
tf = tf.replace("setError('Erro ao salvar treino');", "setError(t('trainingForm.error.saving'));");

// 4. Tab labels
tf = tf.replace(
    "{ id: 'general' as TabType, label: 'Geral', icon: Calendar },",
    "{ id: 'general' as TabType, label: t('trainingForm.tab.general'), icon: Calendar },"
);
tf = tf.replace(
    "{ id: 'athletes' as TabType, label: 'Atletas', icon: Users },",
    "{ id: 'athletes' as TabType, label: t('trainingForm.tab.athletes'), icon: Users },"
);
tf = tf.replace(
    "{ id: 'activities' as TabType, label: 'Atividades', icon: ListChecks },",
    "{ id: 'activities' as TabType, label: t('trainingForm.tab.activities'), icon: ListChecks },"
);

// 5. getPhaseLabel - replace with t() based lookup
tf = tf.replace(
    "return trainingPhases.find(p => p.value === phase)?.label || phase;",
    "const phaseKeyMap: Record<string, string> = { warmup: 'training.phase.warmup', main: 'training.phase.main', cooldown: 'training.phase.cooldown', tactical: 'training.phase.tactical', physical: 'training.phase.physical', technical: 'training.phase.technical' };\r\n        return phase && phaseKeyMap[phase] ? t(phaseKeyMap[phase]) : phase;"
);

// 6. Header
tf = tf.replace(
    "{isEditing ? 'Editar Treino' : 'Novo Treino'}",
    "{isEditing ? t('trainingForm.editTitle') : t('trainingForm.newTitle')}"
);
tf = tf.replace(
    "{isEditing ? 'Atualize os dados do treino' : 'Preencha os dados e adicione atletas e atividades'}",
    "{isEditing ? t('trainingForm.editSubtitle') : t('trainingForm.newSubtitle')}"
);

// 7. Save button
tf = tf.replace(
    '                    Salvar\r\n                </button>',
    '                    {t(\'common.save\') || \'Salvar\'}\r\n                </button>'
);
// Actually let's just use t('trainingForm.save') or hardcode Salvar as fallback using common.save
// Let me check if common.save exists - it likely does. Let me use it:
tf = tf.replace(
    "{t('common.save') || 'Salvar'}",
    "Salvar"
); // Revert, we'll keep Salvar since common.save might not be defined

// 8. Section headers in General tab
tf = tf.replace(
    '\r\n                            Data e Horário\r\n',
    '\r\n                            {t(\'trainingForm.section.dateTime\')}\r\n'
);
tf = tf.replace(
    '\r\n                            Detalhes do Treino\r\n',
    '\r\n                            {t(\'trainingForm.section.details\')}\r\n'
);
tf = tf.replace(
    '<h3 className="text-lg font-bold text-slate-800 mb-4">Descrição e Observações</h3>',
    '<h3 className="text-lg font-bold text-slate-800 mb-4">{t(\'trainingForm.section.description\')}</h3>'
);

// 9. Field labels
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Data *</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.date\')} *</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Hora Início</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.startTime\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Hora Fim</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.endTime\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Local</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.location\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Categoria</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.category\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Intensidade</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.intensity\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Foco Principal</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.focus\')}</label>'
);
tf = tf.replace(
    '<label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>',
    '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'trainingForm.field.status\')}</label>'
);

// 10. Select "Selecione" option
tf = tf.replace(
    "<option value=\"\">Selecione</option>",
    "<option value=\"\">{t('trainingForm.field.select')}</option>"
);

// 11. Intensity options - replace {i.label} with translated lookup
tf = tf.replace(
    '{trainingIntensities.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}',
    '{trainingIntensities.map(i => { const intensityKey: Record<string,string> = { low: \'training.intensity.low\', medium: \'training.intensity.medium\', high: \'training.intensity.high\', recovery: \'training.intensity.recovery\' }; return <option key={i.value} value={i.value}>{t(intensityKey[i.value]) || i.label}</option>; })}'
);

// 12. Status options
tf = tf.replace(
    '{trainingStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}',
    '{trainingStatuses.map(s => { const statusKey: Record<string,string> = { scheduled: \'training.status.scheduled\', in_progress: \'training.status.inProgress\', completed: \'training.status.completed\', cancelled: \'training.status.cancelled\' }; return <option key={s.value} value={s.value}>{t(statusKey[s.value]) || s.label}</option>; })}'
);

// 13. Add Athletes section
tf = tf.replace(
    '\r\n                                Adicionar Atletas\r\n',
    '\r\n                                {t(\'trainingForm.athletes.add\')}\r\n'
);
tf = tf.replace(
    "<option value=\"\">Selecione uma categoria</option>",
    "<option value=\"\">{t('trainingForm.athletes.selectCategory')}</option>"
);
tf = tf.replace(
    '\r\n                                     Adicionar Categoria\r\n',
    '\r\n                                     {t(\'trainingForm.athletes.addCategory\')}\r\n'
);
tf = tf.replace(
    "{showAthleteSelector ? 'Fechar' : 'Adicionar Individual'}",
    "{showAthleteSelector ? t('common.close') || 'Fechar' : t('trainingForm.athletes.addIndividual')}"
);
tf = tf.replace(
    "<p className=\"text-center text-slate-400 py-4\">Todos os atletas já foram adicionados</p>",
    "<p className=\"text-center text-slate-400 py-4\">{t('trainingForm.athletes.allAdded')}</p>"
);

// 14. Attendance list header
tf = tf.replace(
    '<h3 className="font-bold text-slate-800">Lista de Presença ({participants.length})</h3>',
    '<h3 className="font-bold text-slate-800">{t(\'trainingForm.athletes.attendanceList\')} ({participants.length})</h3>'
);

// 15. Empty state
tf = tf.replace(
    '<p className="font-medium">Nenhum atleta adicionado</p>',
    '<p className="font-medium">{t(\'trainingForm.athletes.noAdded\')}</p>'
);
tf = tf.replace(
    '<p className="text-sm">Adicione atletas usando as opções acima</p>',
    '<p className="text-sm">{t(\'trainingForm.athletes.useOptions\')}</p>'
);

// 16. Table headers
tf = tf.replace(
    '<th className="px-4 py-3 text-left font-bold">Atleta</th>',
    '<th className="px-4 py-3 text-left font-bold">{t(\'athletes.athlete\')}</th>'
);
tf = tf.replace(
    '<th className="px-3 py-3 text-center font-bold w-20">Presente</th>',
    '<th className="px-3 py-3 text-center font-bold w-20">{t(\'trainingForm.athletes.col.present\')}</th>'
);
tf = tf.replace(
    '<th className="px-3 py-3 text-center font-bold w-32">Desempenho</th>',
    '<th className="px-3 py-3 text-center font-bold w-32">{t(\'trainingForm.athletes.col.performance\')}</th>'
);
tf = tf.replace(
    '<th className="px-3 py-3 text-center font-bold w-32">Esforço</th>',
    '<th className="px-3 py-3 text-center font-bold w-32">{t(\'trainingForm.athletes.col.effort\')}</th>'
);
tf = tf.replace(
    '<th className="px-3 py-3 text-left font-bold w-48">Observações</th>',
    '<th className="px-3 py-3 text-left font-bold w-48">{t(\'athleteForm.wardrobe.notes\')}</th>'
);

// 17. Activities tab
tf = tf.replace(
    '\r\n                                Atividades do Treino\r\n',
    '\r\n                                {t(\'trainingForm.activities.title\')}\r\n'
);
tf = tf.replace(
    '\r\n                                Adicionar Atividade\r\n',
    '\r\n                                {t(\'trainingForm.activities.add\')}\r\n'
);
tf = tf.replace(
    '<p className="font-medium">Nenhuma atividade cadastrada</p>',
    '<p className="font-medium">{t(\'trainingForm.activities.none\')}</p>'
);
tf = tf.replace(
    '<p className="text-sm mb-4">Adicione atividades para montar o plano do treino</p>',
    '<p className="text-sm mb-4">{t(\'trainingForm.activities.noneDesc\')}</p>'
);
tf = tf.replace(
    '\r\n                                    Adicionar Primeira Atividade\r\n',
    '\r\n                                    {t(\'trainingForm.activities.addFirst\')}\r\n'
);

// 18. Activity field labels
tf = tf.replace(
    '<label className="block text-xs font-semibold text-slate-500 mb-1">Fase</label>',
    '<label className="block text-xs font-semibold text-slate-500 mb-1">{t(\'trainingForm.activities.field.phase\')}</label>'
);
tf = tf.replace(
    '<label className="block text-xs font-semibold text-slate-500 mb-1">Nome da Atividade</label>',
    '<label className="block text-xs font-semibold text-slate-500 mb-1">{t(\'trainingForm.activities.field.name\')}</label>'
);
tf = tf.replace(
    '<label className="block text-xs font-semibold text-slate-500 mb-1">Duração (min)</label>',
    '<label className="block text-xs font-semibold text-slate-500 mb-1">{t(\'trainingForm.activities.field.duration\')}</label>'
);
tf = tf.replace(
    '<label className="block text-xs font-semibold text-slate-500 mb-1">Descrição (opcional)</label>',
    '<label className="block text-xs font-semibold text-slate-500 mb-1">{t(\'trainingForm.activities.field.description\')}</label>'
);

// 19. Phase options
tf = tf.replace(
    '{trainingPhases.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}',
    '{trainingPhases.map(p => { const phaseKey2: Record<string,string> = { warmup: \'training.phase.warmup\', main: \'training.phase.main\', cooldown: \'training.phase.cooldown\', tactical: \'training.phase.tactical\', physical: \'training.phase.physical\', technical: \'training.phase.technical\' }; return <option key={p.value} value={p.value}>{t(phaseKey2[p.value]) || p.label}</option>; })}'
);

// 20. Total time
tf = tf.replace(
    '<strong>Tempo Total:</strong> {activities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)} minutos',
    '<strong>{t(\'trainingForm.activities.totalTime\')}:</strong> {activities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)} {t(\'trainingForm.activities.minutes\')}'
);

fs.writeFileSync(tfPath, tf, 'utf8');
console.log('TrainingForm.tsx updated successfully!');
