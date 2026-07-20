const fs = require('node:fs');
const path = require('node:path');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');
const { mapImportedDocument } = require('../dist-electron/shared/document-import.js');
const { extractLegacyWordText } = require('../dist-electron/main/services/document-import-service.js');

const folder = process.argv[2];
const perTypeLimit = Math.max(1, Number(process.argv[3] || 30));
if (!folder || !fs.existsSync(folder)) {
  console.error('Usage: node scripts/audit-resume-import.cjs <folder> [per-type-limit]');
  process.exit(1);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

async function extractText(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase();
  const buffer = fs.readFileSync(filePath);
  if (extension === '.doc') return extractLegacyWordText(buffer);
  if (extension === '.docx') return (await mammoth.extractRawText({ buffer })).value;
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
  return buffer.toString('utf8');
}

(async () => {
  const supported = new Set(['.doc', '.docx', '.pdf', '.txt', '.md']);
  const grouped = new Map();
  for (const filePath of walk(folder)) {
    const extension = path.extname(filePath).toLocaleLowerCase();
    if (!supported.has(extension)) continue;
    const rows = grouped.get(extension) || [];
    if (rows.length < perTypeLimit) rows.push(filePath);
    grouped.set(extension, rows);
  }

  const projectSignal = /项目经历|项目经验|项目描述|项目简介|项目名称|project experience|project description/i;
  for (const [extension, files] of grouped) {
    const result = { extension, checked: 0, withProjectSignals: 0, recognizedProjects: 0, falseNegativeCandidates: [], parseErrors: [] };
    for (const filePath of files) {
      try {
        const text = await extractText(filePath);
        const mapped = mapImportedDocument('profile', path.basename(filePath), text, 'local');
        const hasSignal = projectSignal.test(text);
        result.checked += 1;
        if (hasSignal) result.withProjectSignals += 1;
        if ((mapped.projects || []).length) result.recognizedProjects += 1;
        if (hasSignal && !(mapped.projects || []).length) {
          result.falseNegativeCandidates.push(path.relative(folder, filePath));
        }
      } catch (error) {
        result.parseErrors.push(`${path.relative(folder, filePath)}: ${error instanceof Error ? error.message : error}`);
      }
    }
    result.falseNegativeCandidates = result.falseNegativeCandidates.slice(0, 8);
    result.parseErrors = result.parseErrors.slice(0, 8);
    console.log(JSON.stringify(result, null, 2));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
