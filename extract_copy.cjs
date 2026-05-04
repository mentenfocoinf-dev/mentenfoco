const fs = require('fs');
const path = require('path');

const targetDirs = [
  'src/routes',
  'src/pages',
  'src/components',
  'src/data',
  'src/locales'
];

const specificFiles = [
  'seed_users.cjs',
  'seed_users.js',
  'supabase/seed.sql'
];

const outputFile = path.join(__dirname, 'Mente_En_Foco_Contexto_Copy.md');

// Extensiones permitidas
const allowedExts = ['.ts', '.tsx', '.json', '.cjs', '.js', '.jsx', '.sql'];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else {
      if (allowedExts.includes(path.extname(fullPath))) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

let allFiles = [];

// Escanear directorios
for (const dir of targetDirs) {
  const fullPath = path.join(__dirname, dir);
  allFiles = allFiles.concat(scanDirectory(fullPath));
}

// Agregar archivos especificos
for (const file of specificFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    allFiles.push(fullPath);
  }
}

// Procesar y concatenar
let outputContent = '# Contexto Copy: Mente En Foco\n\n';

for (const filePath of allFiles) {
  const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  outputContent += `### Archivo: ${relativePath}\n\n`;
  outputContent += '```\n';
  outputContent += content;
  outputContent += '\n```\n\n';
}

fs.writeFileSync(outputFile, outputContent, 'utf-8');
console.log("Extracción completada. El archivo 'Mente_En_Foco_Contexto_Copy.md' está listo en la raíz del proyecto para ser analizado por el equipo de Copywriting.");
