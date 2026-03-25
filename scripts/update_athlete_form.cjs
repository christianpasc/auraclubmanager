const fs = require('fs');
const path = require('path');

const pagesDir = path.resolve(__dirname, '../pages');
const afPath = path.join(pagesDir, 'AthleteForm.tsx');
let af = fs.readFileSync(afPath, 'utf8');

// 1. Add hook import
af = af.replace(
    "import { storageService } from '../services/storageService';",
    "import { storageService } from '../services/storageService';\r\nimport { useLanguage } from '../contexts/LanguageContext';"
);

// 2. Add hook to AthleteForm component
af = af.replace(
    'const isEditing = !!id;\r\n',
    'const isEditing = !!id;\r\n    const { t } = useLanguage();\r\n'
);

// 3. Error messages in AthleteForm
af = af.replace("setError('Erro ao carregar dados do atleta');", "setError(t('athleteForm.error.loading'));");
af = af.replace("setError('Erro ao fazer upload da foto');", "setError(t('athleteForm.error.photoUpload'));");
af = af.replace("setError('O nome do atleta é obrigatório');", "setError(t('athleteForm.error.nameRequired'));");
af = af.replace("setError(`Erro ao salvar atleta", "setError(`${t('athleteForm.error.saving')}");

// 4. Tab labels
af = af.replace(
    "{ id: 'general' as TabType, label: 'Geral', icon: User },",
    "{ id: 'general' as TabType, label: t('athleteForm.tab.general'), icon: User },"
);
af = af.replace(
    "{ id: 'wardrobe' as TabType, label: 'Rouparia', icon: Shirt },",
    "{ id: 'wardrobe' as TabType, label: t('athleteForm.tab.wardrobe'), icon: Shirt },"
);
af = af.replace(
    "{ id: 'history' as TabType, label: 'Histórico', icon: History },",
    "{ id: 'history' as TabType, label: t('athleteForm.tab.history'), icon: History },"
);
af = af.replace(
    "{ id: 'physiology' as TabType, label: 'Fisiologia', icon: Activity },",
    "{ id: 'physiology' as TabType, label: t('athleteForm.tab.physiology'), icon: Activity },"
);

// 5. Header in AthleteForm
af = af.replace(
    "{isEditing ? 'Editar Atleta' : 'Novo Atleta'}",
    "{isEditing ? t('athleteForm.editTitle') : t('athleteForm.newTitle')}"
);
af = af.replace(
    "{isEditing ? 'Atualize as informações do atleta' : 'Preencha os dados para cadastrar'}",
    "{isEditing ? t('athleteForm.editSubtitle') : t('athleteForm.newSubtitle')}"
);

// 6. Pass 't' prop to subcomponents
af = af.replace(
    "&& <GeneralTab athlete={athlete}",
    "&& <GeneralTab t={t} athlete={athlete}"
);
af = af.replace(
    "&& <WardrobeTab wardrobe={wardrobe}",
    "&& <WardrobeTab t={t} wardrobe={wardrobe}"
);
af = af.replace(
    "&& <HistoryTab history={trainingHistory}",
    "&& <HistoryTab t={t} history={trainingHistory}"
);
af = af.replace(
    "&& <PhysiologyTab physiology={physiology}",
    "&& <PhysiologyTab t={t} physiology={physiology}"
);

// Update GeneraTab props signature
af = af.replace(
    "const GeneralTab: React.FC<{",
    "const GeneralTab: React.FC<{\r\n    t: (key: string) => string;"
);
af = af.replace(
    "}> = ({ athlete, setAthlete, onPhotoUpload, uploadingPhoto }) => {",
    "}> = ({ t, athlete, setAthlete, onPhotoUpload, uploadingPhoto }) => {"
);

// Update WardrobeTab props signature
af = af.replace(
    "const WardrobeTab: React.FC<{ wardrobe",
    "const WardrobeTab: React.FC<{ t: (key: string) => string; wardrobe"
);
af = af.replace(
    "}> = ({ wardrobe, setWardrobe }) => {",
    "}> = ({ t, wardrobe, setWardrobe }) => {"
);

// Update HistoryTab props signature
af = af.replace(
    "const HistoryTab: React.FC<{ history: AthleteTrainingHistory[] }> = ({ history }) => {",
    "const HistoryTab: React.FC<{ t: (key: string) => string; history: AthleteTrainingHistory[] }> = ({ t, history }) => {"
);

// Update PhysiologyTab props signature - let's write a generic replacer since it might be spread across lines
af = af.replace(
    "const PhysiologyTab: React.FC<{ physiology",
    "const PhysiologyTab: React.FC<{ t: (key: string) => string; physiology"
);
af = af.replace(
    "}> = ({ physiology, setPhysiology }) => {",
    "}> = ({ t, physiology, setPhysiology }) => {"
);

// 7. Replace static strings in GeneralTab
af = af.replace('<label className="block text-sm font-semibold text-slate-700 mb-3">Foto do Atleta</label>', '<label className="block text-sm font-semibold text-slate-700 mb-3">{t(\'athleteForm.photo\')}</label>');
af = af.replace('<span className="text-xs font-medium">Adicionar foto</span>', '<span className="text-xs font-medium">{t(\'athleteForm.addPhoto\')}</span>');
af = af.replace('Alterar foto', '{t(\'athleteForm.changePhoto\')}');
af = af.replace('<User className="w-5 h-5 text-primary" />Informações Pessoais', '<User className="w-5 h-5 text-primary" />{t(\'athleteForm.section.personal\')}');
af = af.replace('Nome Completo *', '{t(\'athleteForm.field.fullName\')} *');
af = af.replace('Data de Nascimento', '{t(\'athleteForm.field.birthDate\')}');
af = af.replace('CPF', '{t(\'athleteForm.field.cpf\')}');
af = af.replace('RG', '{t(\'athleteForm.field.rg\')}');
// Email is universal
af = af.replace('Telefone', '{t(\'athleteForm.field.phone\')}');

// Endereço section
af = af.replace('<MapPin className="w-5 h-5 text-primary" />Endereço', '<MapPin className="w-5 h-5 text-primary" />{t(\'athleteForm.section.address\')}');
af = af.replace('Endereço</label>', '{t(\'athleteForm.field.address\')}</label>');
af = af.replace('Cidade', '{t(\'athleteForm.field.city\')}');
af = af.replace('Estado', '{t(\'athleteForm.field.state\')}');
af = af.replace('CEP', '{t(\'athleteForm.field.zipCode\')}');

// Info esportivas section
af = af.replace('<Shield className="w-5 h-5 text-primary" />Informações Esportivas', '<Shield className="w-5 h-5 text-primary" />{t(\'athleteForm.section.sports\')}');
af = af.replace('Categoria', '{t(\'trainingForm.field.category\')}'); // reuse
af = af.replace('Posição', '{t(\'athleteForm.field.position\')}');
af = af.replace('Pé Dominante', '{t(\'athleteForm.field.dominantFoot\')}');
af = af.replace('Número Camisa', '{t(\'athleteForm.field.jerseyNumber\')}');
af = af.replace('Status', '{t(\'trainingForm.field.status\')}'); // reuse
af = af.replace('<option value="active">Ativo</option><option value="inactive">Inativo</option><option value="injured">Lesionado</option><option value="suspended">Suspenso</option>', 
    '<option value="active">{t(\'athletes.status.active\')}</option><option value="inactive">{t(\'athletes.status.inactive\')}</option><option value="injured">{t(\'athletes.status.injured\')}</option><option value="suspended">{t(\'athletes.status.suspended\')}</option>');
af = af.replace('<option value="Direito">Direito</option><option value="Esquerdo">Esquerdo</option><option value="Ambidestro">Ambidestro</option>',
    '<option value="Direito">{t(\'athleteForm.foot.right\')}</option><option value="Esquerdo">{t(\'athleteForm.foot.left\')}</option><option value="Ambidestro">{t(\'athleteForm.foot.both\')}</option>');
af = af.replace('Data de Entrada', '{t(\'athleteForm.field.joinDate\')}');

// Emergency Contact
af = af.replace('<Phone className="w-5 h-5 text-primary" />Contato de Emergência', '<Phone className="w-5 h-5 text-primary" />{t(\'athleteForm.section.emergency\')}');
af = af.replace('<label className="block text-sm font-semibold text-slate-700 mb-2">Nome</label>', '<label className="block text-sm font-semibold text-slate-700 mb-2">{t(\'athleteForm.field.emergencyName\')}</label>'); // multiple matches actually, but second one is later
af = af.replace('Parentesco', '{t(\'athleteForm.field.relationship\')}');
af = af.replace('placeholder="Ex: Mãe, Pai"', 'placeholder={t(\'athleteForm.field.relationship\')}');

// Guardian
af = af.replace('<Users className="w-5 h-5 text-primary" />Responsável (menores de idade)', '<Users className="w-5 h-5 text-primary" />{t(\'athleteForm.section.guardian\')}');

// Replace "Selecione" options globally
af = af.replaceAll('<option value="">Selecione</option>', '<option value="">{t(\'trainingForm.field.select\')}</option>');

// 8. Replace static strings in WardrobeTab
af = af.replace('<Shirt className="w-5 h-5 text-primary" />Tamanhos', '<Shirt className="w-5 h-5 text-primary" />{t(\'athleteForm.wardrobe.sizes\')}');
af = af.replace('Camisa</label>', '{t(\'athleteForm.wardrobe.shirt\')}</label>');
af = af.replace('Shorts</label>', '{t(\'athleteForm.wardrobe.shorts\')}</label>');
af = af.replace('Chuteira</label>', '{t(\'athleteForm.wardrobe.cleats\')}</label>');
af = af.replace('Nº Uniforme</label>', '{t(\'athleteForm.wardrobe.uniformNumber\')}</label>');
af = af.replace('<h3 className="text-lg font-bold text-slate-800 mb-4">Materiais Entregues</h3>', '<h3 className="text-lg font-bold text-slate-800 mb-4">{t(\'athleteForm.wardrobe.delivered\')}</h3>');
af = af.replace('<span className="font-semibold text-slate-700">Uniforme de Jogo</span>', '<span className="font-semibold text-slate-700">{t(\'athleteForm.wardrobe.uniform\')}</span>');
af = af.replace('<span className="font-semibold text-slate-700">Kit de Treino</span>', '<span className="font-semibold text-slate-700">{t(\'athleteForm.wardrobe.trainingKit\')}</span>');
af = af.replace('<span className="font-semibold text-slate-700">Mochila/Bolsa</span>', '<span className="font-semibold text-slate-700">{t(\'athleteForm.wardrobe.bag\')}</span>');
// Data Entrega (multiple times) -> t(\'athleteForm.wardrobe.deliveryDate\')
af = af.replaceAll('Data Entrega</label>', '{t(\'athleteForm.wardrobe.deliveryDate\')}</label>');
af = af.replace('Observações</label>', '{t(\'athleteForm.wardrobe.notes\')}</label>');
af = af.replace('placeholder="Observações sobre materiais, pendências, etc."', 'placeholder={t(\'athleteForm.wardrobe.notes\')}');

// 9. Replace static strings in HistoryTab
af = af.replace('<History className="w-5 h-5 text-primary" />Histórico de Treinos e Jogos', '<History className="w-5 h-5 text-primary" />{t(\'athleteForm.history.title\')}');
af = af.replace('<p className="font-medium">Nenhum histórico registrado</p>', '<p className="font-medium">{t(\'athleteForm.history.none\')}</p>');
af = af.replace('<p className="text-sm">O histórico será preenchido conforme o atleta participa de treinos e jogos.</p>', '<p className="text-sm">{t(\'athleteForm.history.noneDesc\')}</p>');

// History tab table headers
af = af.replace('<th className="px-4 py-3 text-left font-bold">Data</th>', '<th className="px-4 py-3 text-left font-bold">{t(\'trainingForm.field.date\')}</th>');
af = af.replace('<th className="px-3 py-3 text-left font-bold">Evento</th>', '<th className="px-3 py-3 text-left font-bold">{t(\'trainingForm.field.category\')}</th>'); // Evento is roughly equivalent to category/type
af = af.replace('<th className="px-3 py-3 text-center font-bold">Tipo</th>', '<th className="px-3 py-3 text-center font-bold">{t(\'trainingForm.field.category\')}</th>'); 
af = af.replace('<th className="px-3 py-3 text-center font-bold">Avaliação</th>', '<th className="px-3 py-3 text-center font-bold">{t(\'athleteForm.history.rating\')}</th>');

// 10. Replace static strings in PhysiologyTab
// There are several headers in physiology tab we haven't seen yet but let's do the ones we know
af = af.replace('<Activity className="w-5 h-5 text-primary" />Medidas Corporais', '<Activity className="w-5 h-5 text-primary" />{t(\'athleteForm.physiology.measurements\')}');
af = af.replace('Altura (cm)', '{t(\'athleteForm.physiology.height\')}');
af = af.replace('Peso (kg)', '{t(\'athleteForm.physiology.weight\')}');
af = af.replace('% Gordura', '{t(\'athleteForm.physiology.bodyFat\')}');
af = af.replace('IMC', '{t(\'athleteForm.physiology.bmi\')}');

af = af.replace('<Heart className="w-5 h-5 text-primary" />Dados Cardiovasculares', '<Heart className="w-5 h-5 text-primary" />{t(\'athleteForm.physiology.cardiovascular\')}');
af = af.replace('FC Repouso (bpm)', '{t(\'athleteForm.physiology.restingHR\')}');
af = af.replace('FC Máxima (bpm)', '{t(\'athleteForm.physiology.maxHR\')}');
af = af.replace('PA Sistólica', '{t(\'athleteForm.physiology.systolic\')}');
af = af.replace('PA Diastólica', '{t(\'athleteForm.physiology.diastolic\')}');

af = af.replace('<Activity className="w-5 h-5 text-primary" />Informações Médicas', '<Activity className="w-5 h-5 text-primary" />{t(\'athleteForm.physiology.medical\')}');
af = af.replace('Tipo Sanguíneo', '{t(\'athleteForm.physiology.bloodType\')}');
af = af.replace('Alergias', '{t(\'athleteForm.physiology.allergies\')}');
af = af.replace('Lesões', '{t(\'athleteForm.physiology.injuries\')}');
af = af.replace('Notas Médicas', '{t(\'athleteForm.physiology.medicalNotes\')}');


fs.writeFileSync(afPath, af, 'utf8');
console.log('AthleteForm.tsx updated successfully!');
