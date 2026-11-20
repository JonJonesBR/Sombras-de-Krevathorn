'use strict';

// Suíte de testes de gameplay de Sombras de Krevathorn, sem dependências npm.
//
// Sobe um servidor estático e um Chrome headless, conecta por CDP e roda os
// cenários de tests/cenarios.js dentro do jogo, um a um.
//
// Precisa de WebSocket global: Node 22, ou Node 20 com --experimental-websocket.
// Uso: node tests/rodar.js   (opcional: CHROME_BIN, PORTA_HTTP, PORTA_CDP)

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const PORTA_HTTP = Number(process.env.PORTA_HTTP) || 8799;
const PORTA_CDP = Number(process.env.PORTA_CDP) || 9334;
const URL_JOGO = 'http://127.0.0.1:' + PORTA_HTTP + '/index.html';
const ESPERA_CARGA = 6000;             // ms até o jogo estar pronto
const TEMPO_MAXIMO = 3 * 60 * 1000;    // teto da suíte inteira

const BINARIOS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const dormir = ms => new Promise(r => setTimeout(r, ms));

function acharChrome() {
  if (process.env.CHROME_BIN) {
    if (!fs.existsSync(process.env.CHROME_BIN)) {
      throw new Error('CHROME_BIN aponta para "' + process.env.CHROME_BIN + '", que não existe');
    }
    return process.env.CHROME_BIN;
  }
  for (let i = 0; i < BINARIOS.length; i++) if (fs.existsSync(BINARIOS[i])) return BINARIOS[i];
  return null;
}

function criarServidor() {
  return http.createServer((req, res) => {
    let caminho = '/';
    try {
      caminho = decodeURIComponent(String(req.url || '/').split('?')[0].split('#')[0]);
    } catch (e) {
      caminho = '/';
    }
    const rel = caminho === '/' ? 'index.html' : caminho.replace(/^\/+/, '');
    const alvo = path.resolve(RAIZ, rel);
    // Nunca servir nada fora da raiz do repositório
    if (alvo !== RAIZ && alvo.indexOf(RAIZ + path.sep) !== 0) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('fora da raiz');
      return;
    }
    fs.readFile(alvo, (erro, dados) => {
      if (erro) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('não encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      });
      res.end(dados);
    });
  });
}

// Cliente CDP mínimo: Runtime/Page por cima do WebSocket global.
function abrirCdp(url, aoExcecao) {
  return new Promise((resolver, rejeitar) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pendentes = new Map();
    let aberto = false;

    ws.onopen = () => {
      aberto = true;
      resolver({
        enviar(method, params) {
          return new Promise((ok, falha) => {
            if (!aberto) { falha(new Error('WebSocket do CDP já fechado')); return; }
            const i = ++id;
            pendentes.set(i, { ok, falha });
            try {
              ws.send(JSON.stringify({ id: i, method: method || '', params: params || {} }));
            } catch (e) {
              pendentes.delete(i);
              falha(e);
            }
          });
        },
        fechar() {
          aberto = false;
          try { ws.close(); } catch (e) { /* já fechado */ }
        }
      });
    };

    ws.onerror = () => { if (!aberto) rejeitar(new Error('não conectou ao WebSocket do CDP')); };
    ws.onclose = () => {
      aberto = false;
      pendentes.forEach(p => p.falha(new Error('a página fechou a conexão do CDP')));
      pendentes.clear();
    };

    ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
      if (msg.id && pendentes.has(msg.id)) {
        const p = pendentes.get(msg.id);
        pendentes.delete(msg.id);
        p.ok(msg);
        return;
      }
      // Exceção não capturada na página: conta como falha da suíte
      if (msg.method === 'Runtime.exceptionThrown' && aoExcecao) aoExcecao(msg.params && msg.params.exceptionDetails);
    };
  });
}

async function pedirAlvo() {
  for (let i = 0; i < 80; i++) {
    try {
      const resposta = await fetch('http://127.0.0.1:' + PORTA_CDP + '/json/list');
      const lista = await resposta.json();
      const pagina = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pagina) return pagina;
    } catch (e) { /* ainda subindo */ }
    await dormir(250);
  }
  throw new Error('o Chrome não abriu a porta de depuração ' + PORTA_CDP);
}

async function avaliar(cliente, expressao) {
  const resposta = await cliente.enviar('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true
  });
  if (resposta.error) throw new Error('CDP: ' + (resposta.error.message || 'erro'));
  const r = resposta.result || {};
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'exceção sem descrição';
    throw new Error(String(desc).split('\n')[0]);
  }
  return r.result ? r.result.value : undefined;
}

function resumirDiagnostico(valor) {
  if (!valor || typeof valor !== 'object') return '';
  const partes = [];
  Object.keys(valor).forEach(chave => {
    if (chave === 'erro') return;
    const v = valor[chave];
    if (v === null || v === undefined) return;
    if (typeof v === 'object') return;
    partes.push(chave + '=' + (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : v));
  });
  return partes.join(' ');
}

// --- Estado do processo, limpo em qualquer saída ---
let servidor = null;
let chrome = null;
let perfil = null;
let cliente = null;
let encerrado = false;
const vigia = setTimeout(() => {
  console.error('\nTEMPO ESGOTADO (3 minutos): encerrando a suíte.');
  encerrarTudo();
  process.exit(1);
}, TEMPO_MAXIMO);

function encerrarTudo() {
  if (encerrado) return;
  encerrado = true;
  try { clearTimeout(vigia); } catch (e) { /* já limpo */ }
  if (cliente) { try { cliente.fechar(); } catch (e) { /* já fechado */ } }
  if (chrome && chrome.exitCode === null && !chrome.killed) {
    try { chrome.kill('SIGKILL'); } catch (e) { /* já morreu */ }
  }
  if (servidor) { try { servidor.close(); } catch (e) { /* já fechado */ } }
  if (perfil) { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* ocupado no Windows */ } }
}

process.on('SIGINT', () => { console.error('\nInterrompido.'); encerrarTudo(); process.exit(1); });
process.on('SIGTERM', () => { encerrarTudo(); process.exit(1); });

async function principal() {
  if (typeof WebSocket === 'undefined') {
    console.error('Este Node não tem WebSocket global.');
    console.error('Use Node 22 ou rode: node --experimental-websocket tests/rodar.js');
    return 1;
  }

  const binario = acharChrome();
  if (!binario) {
    console.error('Chrome/Chromium não encontrado. Instale um deles ou aponte CHROME_BIN para o executável:');
    console.error('  ' + BINARIOS.join('\n  '));
    return 1;
  }

  const cenarios = require('./cenarios.js');
  if (!Array.isArray(cenarios) || !cenarios.length) {
    console.error('tests/cenarios.js não devolveu uma lista de cenários.');
    return 1;
  }

  // 1) Servidor estático
  servidor = criarServidor();
  await new Promise((ok, falha) => {
    servidor.once('error', falha);
    servidor.listen(PORTA_HTTP, '127.0.0.1', ok);
  });
  console.log('servidor em http://127.0.0.1:' + PORTA_HTTP + ' (raiz ' + RAIZ + ')');

  // 2) Chrome headless
  perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'krev-test-'));
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--remote-debugging-port=' + PORTA_CDP,
    '--user-data-dir=' + perfil,
    '--window-size=390,844',
    '--lang=pt-BR',
    '--accept-lang=pt-BR',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank'
  ];
  console.log('Chrome: ' + binario);
  chrome = spawn(binario, args, { stdio: 'ignore' });
  chrome.on('error', erro => { console.error('Falha ao abrir o Chrome: ' + erro.message); });

  const pagina = await pedirAlvo();
  const excecoes = [];
  let cenarioAtual = 'carregamento';
  cliente = await abrirCdp(pagina.webSocketDebuggerUrl, detalhes => {
    const desc = (detalhes && detalhes.exception && (detalhes.exception.description || detalhes.exception.value)) ||
      (detalhes && detalhes.text) || 'exceção sem descrição';
    excecoes.push({ cenario: cenarioAtual, texto: String(desc).split('\n')[0] });
  });

  await cliente.enviar('Runtime.enable');
  await cliente.enviar('Page.enable');
  await cliente.enviar('Page.navigate', { url: URL_JOGO });
  await dormir(ESPERA_CARGA);

  // `player` e `map` só existem depois de começar a run: aqui basta o jogo ter carregado.
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i++) {
    const carregado = await avaliar(cliente,
      'typeof update === "function" && typeof CONFIG === "object" && typeof ElementalSystem === "object" && typeof player !== "undefined"');
    pronto = carregado === true;
    if (!pronto) await dormir(250);
  }
  if (!pronto) throw new Error('o jogo não carregou a tempo (' + ESPERA_CARGA + ' ms de espera inicial + 15 s de tentativas)');

  // 3) Cenários
  const resultados = [];
  let falhou = false;
  for (let i = 0; i < cenarios.length; i++) {
    const cenario = cenarios[i];
    cenarioAtual = cenario.nome;
    const antes = excecoes.length;
    let falhas = [];
    let valor = null;
    const inicio = Date.now();
    try {
      valor = await avaliar(cliente, cenario.codigo);
      if (valor && valor.erro) falhas.push('erro devolvido pelo cenário: ' + valor.erro);
      const proprias = typeof cenario.verificar === 'function' ? cenario.verificar(valor || {}) : [];
      falhas = falhas.concat(proprias);
    } catch (e) {
      falhas.push('exceção: ' + e.message);
    }
    const novas = excecoes.slice(antes);
    if (novas.length) falhas.push('exceção na página: ' + novas.map(x => x.texto).join(' | '));

    const ok = falhas.length === 0;
    if (!ok) falhou = true;
    resultados.push({
      nome: cenario.nome,
      ok,
      falhas,
      diagnostico: resumirDiagnostico(valor),
      ms: Date.now() - inicio
    });

    console.log('');
    console.log((ok ? '[OK]    ' : '[FALHOU] ') + cenario.nome + '  (' + resultados[resultados.length - 1].ms + ' ms)');
    if (resultados[resultados.length - 1].diagnostico) console.log('         ' + resultados[resultados.length - 1].diagnostico);
    falhas.forEach(f => console.log('         - ' + f));
  }
  cenarioAtual = 'encerramento';

  // 4) Tabela final
  const largura = resultados.reduce((n, r) => Math.max(n, r.nome.length), 10);
  console.log('');
  console.log('=== Resultado ===');
  console.log('Cenário'.padEnd(largura) + '  Situação   ms     diagnóstico');
  resultados.forEach(r => {
    console.log(r.nome.padEnd(largura) + '  ' + (r.ok ? 'PASSOU ' : 'FALHOU ') + '  ' +
      String(r.ms).padEnd(5) + '  ' + (r.diagnostico || ''));
  });
  const passaram = resultados.filter(r => r.ok).length;
  console.log('');
  console.log(passaram + ' de ' + resultados.length + ' cenários passaram.');

  // Exceção solta (fora dos cenários) também reprova
  const fora = excecoes.filter(e => !resultados.some(r => r.nome === e.cenario));
  if (fora.length) {
    falhou = true;
    console.log('Exceções fora dos cenários:');
    fora.forEach(e => console.log('  - ' + e.texto));
  }

  return falhou ? 1 : 0;
}

principal()
  .then(codigo => { encerrarTudo(); process.exit(codigo); })
  .catch(erro => {
    console.error('ERRO: ' + (erro && erro.message ? erro.message : erro));
    encerrarTudo();
    process.exit(1);
  });
