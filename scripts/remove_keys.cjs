const fs = require('fs');
const path = require('path');

const contextPath = path.resolve(__dirname, '../contexts/LanguageContext.tsx');
let content = fs.readFileSync(contextPath, 'utf8');

const lines = content.split('\n');
const filteredLines = lines.filter(line => !line.includes("'enrollmentForm.") && !line.includes("'competitionForm."));

fs.writeFileSync(contextPath, filteredLines.join('\n'), 'utf8');
console.log('Successfully removed enrollmentForm and competitionForm keys from LanguageContext.tsx');
