const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../pages/EnrollmentForm.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add import
if (!content.includes("import { useLanguage }")) {
    content = content.replace(
        "import { storageService } from '../services/storageService';",
        "import { storageService } from '../services/storageService';\nimport { useLanguage } from '../contexts/LanguageContext';"
    );
}

// 2. Add hook inside component
if (!content.includes("const { t } = useLanguage();")) {
    content = content.replace(
        "const EnrollmentForm: React.FC = () => {",
        "const EnrollmentForm: React.FC = () => {\n    const { t } = useLanguage();"
    );
}

// 3. String Replacements
const replacements = [
    // Errors
    ["'Erro ao carregar matrícula'", "t('enrollmentForm.error.loading')"],
    ["'Erro ao salvar matrícula'", "t('enrollmentForm.error.saving')"],
    
    // Header
    ["isEditing ? 'Editar Matrícula' : 'Nova Matrícula'", "isEditing ? t('enrollmentForm.editTitle') : t('enrollmentForm.newTitle')"],
    ["isEditing ? 'Atualize os dados da matrícula' : 'Preencha os dados do atleta e da matrícula'", "isEditing ? t('enrollmentForm.editSubtitle') : t('enrollmentForm.newSubtitle')"],
    
    // Section Titles
    [">Dados do Atleta<", ">{t('enrollmentForm.section.athlete')}<"],
    [">Dados da Matrícula<", ">{t('enrollmentForm.section.enrollment')}<"],
    [">Plano e Pagamento<", ">{t('enrollmentForm.section.plan')}<"],
    [">Contrato<", ">{t('enrollmentForm.section.contract')}<"],
    [">Responsável (para menores de idade)<", ">{t('enrollmentForm.section.guardian')}<"],
    
    // Field Labels
    [">Nome do Responsável<", ">{t('enrollmentForm.field.guardianName')}<"],
    [">Telefone do Responsável<", ">{t('enrollmentForm.field.guardianPhone')}<"],
    [">Data da Matrícula<", ">{t('enrollmentForm.field.enrollmentDate')}<"],
    [">Data de Início<", ">{t('enrollmentForm.field.startDate')}<"],
    [">Tipo de Plano<", ">{t('enrollmentForm.field.planType')}<"],
    [">Mensalidade (R$)<", ">{t('enrollmentForm.field.monthlyFee')} (R$)<"],
    [">Dia de Vencimento<", ">{t('enrollmentForm.field.paymentDay')}<"],
    [">Forma de Pagamento<", ">{t('enrollmentForm.field.paymentMethod')}<"],
    [">Contrato assinado<", ">{t('enrollmentForm.field.contractSigned')}<"],
    [">Data de assinatura<", ">{t('enrollmentForm.field.contractDate')}<"],

    // Specific Status Options Dropdown
    [/>Pendente<\/option>/g, ">{t('enrollmentForm.status.pending')}</option>"],
    [/>Ativa<\/option>/g, ">{t('enrollmentForm.status.active')}</option>"],
    [/>Cancelada<\/option>/g, ">{t('enrollmentForm.status.cancelled')}</option>"],
    [/>Expirada<\/option>/g, ">{t('enrollmentForm.status.expired')}</option>"],
    
    // General Status Label (overlaps with GameForm status typically, but let's use enrollmentForm)
    [">Status<", ">{t('enrollmentForm.field.status')}<"]
];

for (const [search, replace] of replacements) {
    if (search instanceof RegExp) {
        content = content.replace(search, replace);
    } else {
        content = content.split(search).join(replace);
    }
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated EnrollmentForm.tsx');
