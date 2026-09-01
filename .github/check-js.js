// Validação de sintaxe dos scripts inline do index.html (single-file).
// Uso: node .github/check-js.js [arquivo]
// Compila cada bloco <script> sem executar (vm.Script) — pega erros de
// sintaxe/parse que quebrariam o jogo em runtime (scripts posteriores pulam).
'use strict';
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'index.html';
const src = fs.readFileSync(file, 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, errors = 0, checked = 0;

while ((m = re.exec(src)) !== null) {
  idx++;
  const attrs = m[1] || '';
  const code = m[2] || '';
  // Pula scripts com src (externos) e vazios
  if (/\bsrc\s*=/.test(attrs)) continue;
  if (!code.trim()) continue;
  checked++;
  try {
    new vm.Script(code, { filename: `${file}#script${idx}` });
  } catch (e) {
    errors++;
    console.error(`[ERRO DE SINTAXE] script #${idx} (${file}): ${e.message}`);
  }
}

console.log(`check-js: ${checked} scripts inline validados, ${errors} erros.`);
if (errors > 0) process.exit(1);
