const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '../../modulos/painel902/js/app.js');
const src = fs.readFileSync(appPath, 'utf8');

function functionSource(name){
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, 'Função ' + name + ' não encontrada no app.js');
  const brace = src.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escape = false;
  for(let i=brace;i<src.length;i++){
    const ch=src[i];
    if(quote){
      if(escape){ escape=false; continue; }
      if(ch==='\\'){ escape=true; continue; }
      if(ch===quote) quote=null;
      continue;
    }
    if(ch==="'" || ch==='"' || ch==='\x60'){ quote=ch; continue; }
    if(ch==='{') depth++;
    if(ch==='}' && --depth===0) return src.slice(start,i+1);
  }
  throw new Error('Não foi possível extrair '+name);
}

const reclassify = functionSource('reclassify');
const parse902 = functionSource('parseExcelRows');
const rota624 = functionSource('rota624Compativel');
const checkpointSuspeito = functionSource('checkpointNaoConfirmadoSuspeito');
const monitor = functionSource('atualizarMonitorColeta');

test('902: documento preenchido tem prioridade de finalização', () => {
  assert.match(parse902, /const autoFinalizar\s*=\s*numeroDocumento\s*!==\s*['"]{2}/);
  assert.match(parse902, /if\s*\(autoFinalizar\)\s*\{/);
  assert.match(parse902, /status:\s*['"]Finalizado['"]/);
  assert.match(parse902, /902_NUMERO_DOCUMENTO/);
});

test('902: identidade e limpeza de alias exigem mesma Filial + PC', () => {
  assert.match(parse902, /const id\s*=\s*\[ref,\s*filial,\s*pv\]\.join\(['"]\|['"]\)/);
  assert.match(parse902, /norm\(activeRow\?\.filial\)\s*===\s*filialNorm/);
  assert.match(parse902, /norm\(activeRow\?\.pv\)\s*===\s*pcNorm/);
});

test('624: rota só é compatível com UF origem e destino presentes e iguais', () => {
  assert.match(rota624, /if\s*\(!o\s*\|\|\s*!d\s*\|\|\s*!reg\.ufOrigem\s*\|\|\s*!reg\.ufDestino\)\s*return false/);
  assert.match(rota624, /o===norm\(reg\.ufOrigem\)\s*&&\s*d===norm\(reg\.ufDestino\)/);
});

test('EXPO: cidade de origem trava fluxo geral em Coleta', () => {
  assert.match(reclassify, /rowInOriginCity\(row\)/);
  assert.match(reclassify, /row\.bucket\s*=\s*['"]ativo['"];\s*row\.status\s*=\s*['"]Coleta['"]/s);
});

test('EXPO: posição inequivocamente exterior leva a Alerta EXPO / Faturar', () => {
  assert.match(reclassify, /isUFEx\(row\.ufDest\)\s*&&\s*isPosicaoExterior\(row\.posicao\)/s);
  assert.match(reclassify, /row\.bucket\s*=\s*['"]alertaExpo['"];\s*row\.status\s*=\s*['"]Faturar['"]/s);
});

test('IMPO especial: regra de aduana não é derrubada pela trava de origem', () => {
  assert.match(reclassify, /const impoComRegraAduana\s*=\s*isUFEx\(row\.ufRem\)\s*&&\s*\(hasPaga\(row\)\s*\|\|\s*!!checkpointRule\)/);
  assert.match(reclassify, /!impoComRegraAduana/);
});

test('IMPO: Ag. Nota, Aduana e saída para Faturar continuam representados', () => {
  assert.match(reclassify, /row\.bucket\s*=\s*['"]agNota['"];\s*row\.status\s*=\s*['"]AG Nota['"]/s);
  assert.match(reclassify, /row\.bucket\s*=\s*['"]aduana['"];\s*row\.status\s*=\s*['"]Aduana['"]/s);
  assert.match(reclassify, /row\.bucket\s*=\s*['"]alertaInt['"];\s*row\.status\s*=\s*['"]Faturar['"]/s);
});

test('Alerta Nacional: cliente configurado tem prioridade sobre origem', () => {
  assert.match(reclassify, /const clienteAlertaNacional\s*=\s*row\.alerta/);
  assert.match(reclassify, /!clienteAlertaNacional/);
  assert.match(reclassify, /if\(row\.alerta\s*&&\s*!isUFEx\(row\.ufRem\)\s*&&\s*!isUFEx\(row\.ufDest\)\)/);
});

test('Checkpoint: pendência permanece persistente após nova posição', () => {
  assert.match(monitor, /if\(atual\.pendenteCheckpoint\)/);
  assert.match(monitor, /pendenteCheckpoint:true/);
});

test('Checkpoint: status avançado não aparece como não confirmado', () => {
  assert.match(checkpointSuspeito, /\['AG Nota','Aduana','Faturar','Finalizado'\]\.includes\(row\.status\)/);
});
