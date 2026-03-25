const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../pages/EnrollmentForm.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const replacements = [
    // Field Labels
    [">Nome Completo *<", ">{t('athleteForm.field.name')} *<"],
    [">Data de Nascimento<", ">{t('athleteForm.field.birthDate')}<"],
    [">Categoria<", ">{t('athleteForm.field.category')}<"],
    [">Selecione<", ">Selecione<"], // Assuming "Selecione" is okay for now or use `t('common.select')` if exists. Let's leave it or replace it. I'll replace with "Selecione" which does nothing, but wait, `athleteForm.field.category` translations might be enough. I'll skip Selecione.
    [">CPF<", ">{t('athleteForm.field.cpf')}<"],
    [">Telefone<", ">{t('athleteForm.field.phone')}<"],
    [">E-mail<", ">{t('athleteForm.field.email')}<"],
    [">Observações<", ">{t('athleteForm.field.notes')}<"],
    [">Responsável (para menores de idade)<", ">{t('enrollmentForm.section.guardian')}<"],
    
    // Placeholders
    ['placeholder="Nome completo do atleta"', "placeholder={t('athleteForm.placeholder.name')}"],
    ['placeholder="000.000.000-00"', "placeholder={t('athleteForm.placeholder.cpf')}"],
    ['placeholder="(00) 00000-0000"', "placeholder={t('athleteForm.placeholder.phone')}"],
    ['placeholder="atleta@email.com"', "placeholder={t('athleteForm.placeholder.email')}"],
    ['placeholder="150.00"', "placeholder=\"150.00\""], 
    ['placeholder="Observações adicionais..."', "placeholder={t('athleteForm.placeholder.notes')}"],
    
    // Buttons/Text
    [">Salvar<", ">{t('athleteForm.button.save')}<"],
    [">Foto<", ">{t('athleteForm.photo.upload')}<"]
];

for (const [search, replace] of replacements) {
    if (search instanceof RegExp) {
        content = content.replace(search, replace);
    } else {
        content = content.split(search).join(replace);
    }
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated EnrollmentForm.tsx (Pass 2)');
