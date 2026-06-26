
const SUPABASE_URL = 'https://amuhvmvgwigihgzougwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdWh2bXZnd2lnaWhnem91Z3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MTU3NTgsImV4cCI6MjA5MjM5MTc1OH0.TwNl4Lnilp3Yrl1gAV86BgapIGgXcnUC53E7jjv03FE';
const STORE = 'painel902_supabase_v22_meta';
const DB_NAME = 'painel902_supabase_v22_db';
const DB_STORE = 'appstate';
const LAST_UPDATE_KEY = STORE + '_last_update_at';

const state = {
  rows: [],
  finalizados: [],
  config: {
    aduanas: ['SAO BORJA','SANTO TOME','DIONISIO','BERNARDO','FOZ DO IGUACU','PUERTO IGUACU','CHUI','CHUY'],
    alerta: ['MARS','NISSIN','CAMPARI','COLGATE'],
    expo: [],
    paga: ['BENASSI'],
    fretes: [{pagador:'BENASSI', remetente:'SOCIEDAD EXPORTADORA VERFRUIT SPA', ufOrigem:'EX', ufDestino:'PR', frete:29000}],
    checkpoints: [{cliente:'MINERVA', cidade:'VARGINHA', ufOrigem:'EX', destinoBucket:'alertaInt'}]
  },
  supabase: null,
  remoteFinalizedIds: new Set(),
  lastUpdateAt: null
};

function norm(v){ return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim(); }
function dedupeList(arr){ const seen = new Set(); return (arr || []).map(v => String(v||'').trim()).filter(Boolean).filter(v => { const k = norm(v); if(seen.has(k)) return false; seen.add(k); return true; }); }
function dedupeFretes(arr){ const seen = new Set(); return (arr || []).filter(Boolean).filter(f => { const k = [norm(f.pagador), norm(f.remetente), norm(f.ufOrigem), norm(f.ufDestino), Number(f.frete||0)].join('|'); if(seen.has(k)) return false; seen.add(k); return true; }).map(f => ({pagador:f.pagador||'', remetente:f.remetente||'', ufOrigem:f.ufOrigem||'', ufDestino:f.ufDestino||'', frete:Number(f.frete||0)})); }
function dedupeCheckpoints(arr){ const seen = new Set(); return (arr || []).filter(Boolean).filter(c => { const k = [norm(c.cliente), norm(c.cidade), norm(c.ufOrigem || c.ufDestino || 'EX'), norm(c.destinoBucket || 'alertaInt')].join('|'); if(seen.has(k)) return false; seen.add(k); return true; }).map(c => ({cliente:c.cliente||'', cidade:c.cidade||'', ufOrigem:c.ufOrigem || c.ufDestino || 'EX', destinoBucket:c.destinoBucket || 'alertaInt'})); }
function money(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function formatDateTimeBR(iso){
  if(!iso) return 'Importe ou sincronize a base';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return 'Importe ou sincronize a base';
  return d.toLocaleString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  }).replace(',', ' •');
}
function formatAgoBR(iso){
  if(!iso) return 'Importe ou sincronize a base para registrar';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return 'Importe ou sincronize a base para registrar';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if(min < 1) return 'Atualizado agora';
  if(min < 60) return `Atualizado há ${min} min`;
  const h = Math.floor(min / 60);
  if(h < 24) return `Atualizado há ${h} h ${min % 60} min`;
  const dias = Math.floor(h / 24);
  return `Atualizado há ${dias} dia${dias > 1 ? 's' : ''}`;
}
function loadLastUpdate(){
  // fallback local: usado somente se a Supabase não retornar data
  try{ state.lastUpdateAt = localStorage.getItem(LAST_UPDATE_KEY) || null; }catch(e){ state.lastUpdateAt = state.lastUpdateAt || null; }
}

async function carregarUltimaAtualizacaoSupabase(){
  if(!state.supabase) return;
  try{
    const { data, error } = await state.supabase
      .from('configuracoes_902')
      .select('valor')
      .eq('chave','ultima_atualizacao')
      .maybeSingle();

    if(error){
      console.warn('Não foi possível carregar última atualização da Supabase:', error.message || error);
      return;
    }

    if(data?.valor){
      state.lastUpdateAt = data.valor;
      try{ localStorage.setItem(LAST_UPDATE_KEY, state.lastUpdateAt); }catch(e){}
      renderLastUpdate();
    }
  }catch(e){
    console.warn('Falha ao ler última atualização da Supabase:', e);
  }
}

async function salvarUltimaAtualizacaoSupabase(iso){
  if(!state.supabase) return false;
  try{
    const { error } = await state.supabase
      .from('configuracoes_902')
      .upsert({
        chave:'ultima_atualizacao',
        valor: iso,
        updated_at: new Date().toISOString()
      }, { onConflict:'chave' });

    if(error){
      console.warn('Não foi possível salvar última atualização na Supabase:', error.message || error);
      return false;
    }
    return true;
  }catch(e){
    console.warn('Falha ao salvar última atualização na Supabase:', e);
    return false;
  }
}

function getUpdateAgeMinutes(iso){
  if(!iso) return null;
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}
function renderLastUpdate(){
  const dateEl = document.getElementById('lastUpdateDate');
  const agoEl = document.getElementById('lastUpdateAgo');
  const dotEl = document.getElementById('lastUpdateDot');
  const boxEl = document.getElementById('lastUpdateBox');
  const fullDate = formatDateTimeBR(state.lastUpdateAt);
  const agoText = formatAgoBR(state.lastUpdateAt);
  if(dateEl) dateEl.textContent = fullDate;
  if(agoEl) agoEl.textContent = agoText;
  if(boxEl) boxEl.title = state.lastUpdateAt ? `Última atualização: ${fullDate}` : 'Última atualização ainda não registrada';
  if(dotEl){
    const min = getUpdateAgeMinutes(state.lastUpdateAt);
    dotEl.classList.remove('ok','warn','danger');
    if(min === null) return;
    if(min <= 15) dotEl.classList.add('ok');
    else if(min <= 60) dotEl.classList.add('warn');
    else dotEl.classList.add('danger');
  }
}
async function markLastUpdate(reason=''){
  // IMPORTANTE: esta função deve ser chamada somente na sincronização Supabase.
  // Abrir/carregar/importar o painel não altera a data de atualização.
  state.lastUpdateAt = new Date().toISOString();
  await salvarUltimaAtualizacaoSupabase(state.lastUpdateAt);
  try{ localStorage.setItem(LAST_UPDATE_KEY, state.lastUpdateAt); }catch(e){}
  renderLastUpdate();
}
setInterval(renderLastUpdate, 60000);

function uniqueRowsById(rows){
  const m = new Map();
  (rows || []).forEach(r => {
    if(r && r.id) m.set(r.id, r);
  });
  return [...m.values()];
}
function uniqueDbPayloadById(rows){
  const m = new Map();
  (rows || []).forEach(r => {
    if(r && r.id) m.set(r.id, r);
  });
  return [...m.values()];
}


function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function saveLocal(){
  try{
    localStorage.setItem(STORE, JSON.stringify({config:state.config}));
  }catch(e){}
  try{
    await idbSet('rows', state.rows);
    await idbSet('finalizados', state.finalizados);
  }catch(e){
    console.warn('Falha ao salvar no IndexedDB', e);
  }
}
let saveTimer = null;
function saveLocalDebounced(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveLocal(); }, 250);
}
async function loadLocal(){
  loadLastUpdate();
  try{
    const raw = JSON.parse(localStorage.getItem(STORE)||'null');
    if(raw && raw.config){
      state.config = {
        aduanas: raw.config.aduanas || state.config.aduanas,
        alerta: raw.config.alerta || state.config.alerta,
        expo: raw.config.expo || [],
        paga: raw.config.paga || state.config.paga,
        fretes: raw.config.fretes || state.config.fretes,
        checkpoints: (raw.config.checkpoints || [{cliente:'MINERVA', cidade:'VARGINHA', ufOrigem:'EX', destinoBucket:'alertaInt'}]).map(c => ({cliente:(c.cliente||''), cidade:(c.cidade||''), ufOrigem:(c.ufOrigem || c.ufDestino || 'EX'), destinoBucket:(c.destinoBucket || 'alertaInt')})),
        checkpoints: (raw.config.checkpoints || [{cliente:'MINERVA', cidade:'VARGINHA', ufOrigem:'EX', destinoBucket:'alertaInt'}]).map(c => ({cliente:(c.cliente||''), cidade:(c.cidade||''), ufOrigem:(c.ufOrigem || c.ufDestino || 'EX'), destinoBucket:(c.destinoBucket || 'alertaInt')}))
      };
    }
  }catch(e){}
  try{
    state.rows = await idbGet('rows') || [];
    state.finalizados = await idbGet('finalizados') || [];
  }catch(e){
    state.rows = [];
    state.finalizados = [];
  }
  if(!Array.isArray(state.config.aduanas)) state.config.aduanas = [];
  if(!Array.isArray(state.config.alerta)) state.config.alerta = [];
  if(!Array.isArray(state.config.expo)) state.config.expo = [];
  if(!Array.isArray(state.config.paga)) state.config.paga = [];
  if(!Array.isArray(state.config.fretes)) state.config.fretes = [];
  if(!Array.isArray(state.config.checkpoints)) state.config.checkpoints = [];
  state.config.aduanas = dedupeList(state.config.aduanas);
  state.config.alerta = dedupeList(state.config.alerta);
  state.config.expo = dedupeList(state.config.expo);
  state.config.paga = dedupeList(state.config.paga);
  state.config.fretes = dedupeFretes(state.config.fretes);
  state.config.checkpoints = dedupeCheckpoints(state.config.checkpoints);
  if(!Array.isArray(state.config.checkpoints)) state.config.checkpoints = [{cliente:'MINERVA', cidade:'VARGINHA', ufDestino:'EX', destinoBucket:'alertaInt'}];
  if(!Array.isArray(state.config.checkpoints)) state.config.checkpoints = [{cliente:'MINERVA', cidade:'VARGINHA', ufDestino:'EX', destinoBucket:'alertaExpo', obs:'regra inicial'}];
}
function setStatusText(msg){ supabaseStatus.textContent = msg; }
let busyOperation = '';
function setBusyOperation(label=''){
  busyOperation = label || '';
  const actionsEl = document.querySelector('.actions');
  if(actionsEl) actionsEl.classList.toggle('busy', !!busyOperation);
  const hint = document.getElementById('busyHint');
  if(hint) hint.textContent = busyOperation;
}
function guardBusy(actionName){
  if(busyOperation){
    alert(`Aguarde a operação atual terminar antes de ${actionName}.`);
    return true;
  }
  return false;
}

async function fetchAllRows(table, columns='*', orderColumn=null, ascending=true, pageSize=1000){
  if(!state.supabase) return [];
  let from = 0;
  let all = [];
  while(true){
    let query = state.supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if(orderColumn) query = query.order(orderColumn, { ascending });
    const { data, error } = await query;
    if(error) throw error;
    const batch = data || [];
    all = all.concat(batch);
    if(batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function initSupabase(){
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY){ setStatusText('Supabase: preencha URL e anon key no HTML'); return; }
  try{ state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); setStatusText('Supabase: configurada no HTML'); }catch(e){ setStatusText('Supabase: erro ao criar cliente'); }
}

let realtimeLoaded = false;
let realtimeTimer = null;
let realtimeChannels = [];

function scheduleRealtimeReload(){}

function setupRealtimeSubscriptions(){}

async function carregarHistoricoFinalizadosSupabase(){
  if(!state.supabase) return new Set();
  try{
    const rows = await fetchAllRows('painel_902_finalizados', 'id', 'id', true, 1000);
    state.remoteFinalizedIds = new Set((rows || []).map(x => x.id).filter(Boolean));
    return state.remoteFinalizedIds;
  }catch(e){
    console.warn('Falha ao carregar histórico de finalizados da Supabase', e);
    state.remoteFinalizedIds = state.remoteFinalizedIds || new Set();
    return state.remoteFinalizedIds;
  }
}

async function salvarNoHistoricoFinalizados(row){
  if(!state.supabase || !row?.id) return;
  const payload = {
    ...mapRowToDb({...row, status:'Finalizado'}),
    finalizado_em: row.finalizadoEm || new Date().toISOString()
  };
  const { error } = await state.supabase.from('painel_902_finalizados').upsert(payload, { onConflict:'id' });
  if(error) throw error;
  state.remoteFinalizedIds = state.remoteFinalizedIds || new Set();
  state.remoteFinalizedIds.add(row.id);
}

async function removerDoHistoricoFinalizados(id){
  if(!state.supabase || !id) return;
  const { error } = await state.supabase.from('painel_902_finalizados').delete().eq('id', id);
  if(error) throw error;
  if(state.remoteFinalizedIds) state.remoteFinalizedIds.delete(id);
}

function openTab(tab){
  document.querySelectorAll('.tab').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-'+tab).classList.remove('hidden');
  document.querySelectorAll('.navbtn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  const labels = {ativo:'Painel Ativo', agNota:'Ag nota', aduana:'Aduana', alertaNac:'Clientes alerta nacional', alertaInt:'Clientes alerta internacional impo', alertaExpo:'Clientes alerta internacional expo', finalizados:'Finalizados', config:'Configurações'};
  pageTitle.textContent = labels[tab];
  renderAll(true);
}
document.querySelectorAll('.navbtn').forEach(btn => btn.onclick = () => openTab(btn.dataset.tab));
document.querySelectorAll('.cardBtn').forEach(btn => btn.onclick = () => openTab(btn.dataset.open));
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.cardBtn');
  if(!btn) return;
  const tab = btn.dataset.open;
  if(tab) openTab(tab);
});

function isAduanaPosition(pos){

  const t = norm(pos);

  const emBrasil =
    t.includes('BRASIL');

  return state.config.aduanas.some(x => {

    const nome = norm(x);

    if(!nome) return false;

    const temCidade =
  t.includes(nome) ||
  nome.split(' ').some(p =>
    p.length > 4 &&
    t.includes(p)
  );

    const contextoAduana =
      t.includes('ADUANA') ||
      t.includes('ALFANDEGA') ||
      t.includes('FRONTEIRA');

    return (
      temCidade &&
      (
        contextoAduana ||
        !emBrasil
      )
    );

  });

}
function isInBrazil(pos){ return norm(pos).includes('BRASIL'); }
function ufPosicaoBrasil(pos){
  const t = norm(pos);
  if(!t.includes('BRASIL')) return '';
  const antesBrasil = t.split('BRASIL')[0];
  const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const encontrados = [];
  antesBrasil.replace(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/g, (m) => { encontrados.push(m); return m; });
  return encontrados.length ? encontrados[encontrados.length - 1] : '';
}
function temRegraPadrao(row, checkpointRule){
  return !!(hasPaga(row) || hasAlert(row) || hasExpo(row) || checkpointRule);
}
function isUFEx(v){ const t = norm(v); return t === 'EX' || t === 'UF EX' || t.endsWith(' EX') || t.startsWith('EX '); }
function startsWithCfg(value, cfgList){
  const v = norm(value);
  return cfgList.some(x => {
    const c = norm(x);
    return c && (v === c || v.startsWith(c + ' '));
  });
}
function hasAlert(row){ return startsWithCfg(row.pagador, state.config.alerta); }
function hasExpo(row){ return startsWithCfg(row.pagador, state.config.expo); }
function hasPaga(row){ return startsWithCfg(row.pagador, state.config.paga); }
function hasCheckpointRule(row){
  return (state.config.checkpoints || []).find(cp => {
    const clienteOk = norm(row.pagador).includes(norm(cp.cliente));
    const ufCfg = norm(cp.ufOrigem || 'EX');
    const ufOk = ufCfg === 'EX' ? isUFEx(row.ufRem) : norm(row.ufRem) === ufCfg;
    return clienteOk && ufOk;
  });
}
function rowInCheckpointCity(row, cp){
  return !!cp && norm(row.posicao).includes(norm(cp.cidade));
}

function fretePadrao(row){
  const p = norm(row.pagador), r = norm(row.remetente), o = norm(row.ufRem), d = norm(row.ufDest);
  const found = state.config.fretes.find(f => (!f.pagador || p.includes(norm(f.pagador))) && (!f.remetente || r.includes(norm(f.remetente))) && norm(f.ufOrigem) === o && norm(f.ufDestino) === d);
  return found ? Number(found.frete || 0) : 0;
}
function competenciaMes(dataPc){ const raw = String(dataPc || '').trim().split('/'); return raw.length === 3 ? `${raw[2]}-${raw[1]}` : ''; }
function reclassify(){
  state.rows.forEach(row => {

  if(!row) return;

    row.alerta = hasAlert(row);
    row.aduana =
  isAduanaPosition(row.posicao || '') &&
  hasPaga(row) &&
  isUFEx(row.ufRem || '');
    row.frete = fretePadrao(row);
    row.competencia = competenciaMes(row.dataPC);

    const checkpointRule = hasCheckpointRule(row);

    if(typeof row.passouCheckpoint !== 'boolean') row.passouCheckpoint = false;
    if(checkpointRule && rowInCheckpointCity(row, checkpointRule)) row.passouCheckpoint = true;
    if(row.aduana) row.foiAduana = true;

    if(row.status === 'Finalizado'){
      row.bucket = 'finalizados';
      return;
    }

    /* PRIORIDADE MÁXIMA: regra de aduana/checkpoint antes de qualquer alerta.
       Correção v5: clientes cadastrados em "Clientes com regra de aduana"
       que ainda estejam em cidade/posição de aduana devem permanecer na aba Aduana,
       mesmo que o status esteja como Faturar ou que a origem seja EX.
    */
    if(row.aduana){
      row.bucket = 'aduana';
      row.status = 'Aduana';
      return;
    }

    if(checkpointRule && rowInCheckpointCity(row, checkpointRule)){
      row.bucket = 'aduana';
      row.status = 'Aduana';
      row.passouCheckpoint = true;
      return;
    }

    if(row.status === 'Faturar'){

      if(
        !isUFEx(row.ufRem) &&
        isUFEx(row.ufDest)
      ){
        row.bucket = 'alertaExpo';
        return;
      }

      if(
        isUFEx(row.ufRem)
      ){
        row.bucket = 'alertaInt';
        return;
      }

      if(
        !isUFEx(row.ufRem) &&
        !isUFEx(row.ufDest)
      ){
        row.bucket = 'alertaNac';
        return;
      }

      if(checkpointRule){
        if(row.passouCheckpoint && !rowInCheckpointCity(row, checkpointRule)){
          row.bucket = checkpointRule.destinoBucket || 'alertaInt';
        }else{
          row.bucket = 'ativo';
        }
        return;
      }

      if(isUFEx(row.ufRem)){
        row.bucket = 'alertaInt';
        return;
      }

      row.bucket = 'alertaNac';
      return;
    }

    /* AUTOMÁTICO NORMAL */
    const elegivelAgNotaAduana = hasPaga(row) && isUFEx(row.ufRem);
    const elegivelAgNotaCheckpoint = !!checkpointRule && isUFEx(row.ufRem);

    if(row.aduana){
      row.bucket = 'aduana';
      row.status = 'Aduana';
      return;
    }

    if(checkpointRule){
      if(rowInCheckpointCity(row, checkpointRule)){
        row.bucket = 'aduana';
        row.status = 'Aduana';
        return;
      }

      if(row.passouCheckpoint && !rowInCheckpointCity(row, checkpointRule)){
        row.bucket = checkpointRule.destinoBucket || 'alertaInt';
        row.status = 'Faturar';
        return;
      }

      if(elegivelAgNotaCheckpoint && !row.passouCheckpoint){
        row.bucket = 'agNota';
        row.status = 'AG Nota';
        return;
      }
    }

    if(
      hasPaga(row) &&
      isUFEx(row.ufRem) &&
      !row.aduana &&
      !isInBrazil(row.posicao)
    ){
      row.bucket = 'agNota';
      row.status = 'AG Nota';
      return;
    }

    if(
      hasPaga(row) &&
      isUFEx(row.ufRem) &&
      !row.aduana &&
      isInBrazil(row.posicao) &&
      !isAduanaPosition(row.posicao)
    ){
      row.bucket = 'alertaInt';
      row.status = 'Faturar';
      return;
    }

    if(elegivelAgNotaAduana && !row.foiAduana){
      row.bucket = 'agNota';
      row.status = 'AG Nota';
      return;
    }

    if(hasExpo(row) && isUFEx(row.ufDest)){
      row.bucket = 'alertaExpo';
      return;
    }

    if(row.alerta && !isUFEx(row.ufRem) && !isUFEx(row.ufDest)){
      row.bucket = 'alertaNac';
      return;
    }

    /* REGRAS AUTOMATICAS PARA CASOS SEM REGRA PADRAO
       1) Origem EX sem regra: ao registrar BRASIL, sobe para alerta internacional impo.
       2) Exportação sem regra: se UF da posição divergir da UF do remetente, sobe para alerta expo.
       3) Nacional sem regra: se UF da posição divergir da UF do remetente, sobe para alerta nacional.
    */
    const semRegraPadrao = !temRegraPadrao(row, checkpointRule);

    if(semRegraPadrao && isUFEx(row.ufRem) && isInBrazil(row.posicao)){
      row.bucket = 'alertaInt';
      row.status = 'Faturar';
      return;
    }

    const ufPosicaoAtual = ufPosicaoBrasil(row.posicao);

    if(
      semRegraPadrao &&
      !isUFEx(row.ufRem) &&
      isUFEx(row.ufDest) &&
      ufPosicaoAtual &&
      norm(row.ufRem) &&
      ufPosicaoAtual !== norm(row.ufRem)
    ){
      row.bucket = 'alertaExpo';
      row.status = 'Faturar';
      return;
    }

    if(
      semRegraPadrao &&
      !isUFEx(row.ufRem) &&
      !isUFEx(row.ufDest) &&
      ufPosicaoAtual &&
      norm(row.ufRem) &&
      ufPosicaoAtual !== norm(row.ufRem)
    ){
      row.bucket = 'alertaNac';
      row.status = 'Faturar';
      return;
    }

    row.bucket = 'ativo';

    if(!['Coleta','AG Nota','Aduana','Faturar','Finalizado'].includes(row.status)){
      row.status = 'Coleta';
    }
  });
}
function currentSets(){ return { ativo: state.rows.filter(r => r.bucket === 'ativo'), agNota: state.rows.filter(r => r.bucket === 'agNota'), aduana: state.rows.filter(r => r.bucket === 'aduana'), alertaNac: state.rows.filter(r => r.bucket === 'alertaNac'), alertaInt: state.rows.filter(r => r.bucket === 'alertaInt'), alertaExpo: state.rows.filter(r => r.bucket === 'alertaExpo') }; }
function fillSelect(el, items, current=''){ const keep = current || el.value || ''; el.innerHTML = '<option value="">Todos</option>' + [...new Set(items.filter(Boolean))].sort().map(v => `<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join(''); if([...el.options].some(o => o.value === keep)) el.value = keep; }
function filterRows(rows, {q='', client='', status='', ufOrigem='', ufDestino=''}={}){ const text = norm(q); return rows.filter(r => { if(client && norm(r.pagador) !== norm(client)) return false; if(status && r.status !== status) return false; if(ufOrigem && norm(r.ufRem) !== norm(ufOrigem)) return false; if(ufDestino && norm(r.ufDest) !== norm(ufDestino)) return false; const hay = norm([r.cavalo,r.pagador,r.posicao,r.motorista,r.referencia,r.talhao,r.destinatario,r.remetente].join(' ')); return !text || hay.includes(text); }); }
function statusSelect(row, fromFinalizados=false){ const opts = ['Coleta','AG Nota','Aduana','Faturar','Finalizado']; return `<select onchange="alterarStatus('${encodeURIComponent(row.id)}', this.value, ${fromFinalizados ? 'true' : 'false'})">${opts.map(s => `<option value="${s}" ${row.status===s?'selected':''}>${s}</option>`).join('')}</select>`; }
function rowButtons(row, fromFinalizados=false){ if(fromFinalizados){ return `<div class="rowActions"><button class="mini btn-green" onclick="reabrirRegistro('${encodeURIComponent(row.id)}')">Reabrir</button></div>`; } return `<div class="rowActions"><button class="mini btn-fat" onclick="marcarFaturar('${encodeURIComponent(row.id)}')">Faturar</button><button class="mini btn-fin" onclick="marcarFinalizado('${encodeURIComponent(row.id)}')">Finalizado</button></div>`; }
function columns(includeFrete=false, fromFinalizados=false){
  const cols = [['Cavalo', r => r.cavalo || '-'], ['Data PC', r => `${r.dataPC || '-'}<div class="small">Filial ${r.filial || '-'} | PV ${r.pv || '-'}</div>`], ['Posição', r => r.posicao || '-'], ['Pagador', r => `${r.pagador || '-'}${r.alerta ? '<div class="clientTag">cliente alerta</div>' : ''}`], ['Remetente / UF', r => `${r.remetente || '-'}<div class="small">UF ${r.ufRem || '-'}</div>`], ['Destinatário / UF', r => `${r.destinatario || '-'}<div class="small">UF ${r.ufDest || '-'}</div>`], ['Motorista', r => r.motorista || '-'], ['Talhão', r => r.talhao || '-'], ['Referência', r => r.referencia || '-']];
  if(includeFrete) cols.push(['Frete', r => money(r.frete || 0)]);
  cols.push(['Status', r => statusSelect(r, fromFinalizados)]);
  cols.push(['Ações', r => rowButtons(r, fromFinalizados)]);
  return cols;
}
const PAGE_SIZE_902 = 50;
function renderTable(el, rows, includeFrete=false, fromFinalizados=false){
  const cols = columns(includeFrete, fromFinalizados);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE_902));
  let page = Number(el.dataset.page || 1);
  if(!Number.isFinite(page) || page < 1) page = 1;
  if(page > pages) page = pages;
  el.dataset.page = String(page);
  const start = (page - 1) * PAGE_SIZE_902;
  const shown = rows.slice(start, start + PAGE_SIZE_902);
  el.innerHTML = `<thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${shown.length ? shown.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="text-align:center;color:#9bb0df">Nenhum registro encontrado.</td></tr>`}</tbody>`;
  renderPager(el, total, page, pages);
}
function renderPager(el, total, page, pages){
  let pager = document.getElementById('pager-' + el.id);
  if(!pager){
    pager = document.createElement('div');
    pager.id = 'pager-' + el.id;
    pager.className = 'pager902';
    el.insertAdjacentElement('afterend', pager);
  }
  if(total <= PAGE_SIZE_902){ pager.innerHTML = `<span>${total} registro(s)</span>`; return; }
  pager.innerHTML = `
    <button class="mini" ${page<=1?'disabled':''} onclick="setTablePage902('${el.id}', ${page-1})">Anterior</button>
    <span>Página ${page} de ${pages} — ${total} registro(s)</span>
    <button class="mini" ${page>=pages?'disabled':''} onclick="setTablePage902('${el.id}', ${page+1})">Próxima</button>
  `;
}
function setTablePage902(tableId, page){
  const el = document.getElementById(tableId);
  if(el){ el.dataset.page = String(page); }
  renderAll(false);
}
function unique(rows, key){ return [...new Set(rows.map(r => r[key]).filter(Boolean))]; }

function parseDateBr(s){
  const p = String(s || '').trim().split('/');
  if(p.length !== 3) return '';
  return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
}
function sortStableRows(rows){
  return [...rows].sort((a,b) => {
    const da = parseDateBr(a.dataPC);
    const db = parseDateBr(b.dataPC);
    if(da !== db) return da.localeCompare(db);
    const fa = String(a.filial || '');
    const fb = String(b.filial || '');
    if(fa !== fb) return fa.localeCompare(fb, 'pt-BR', {numeric:true});
    const pa = String(a.pv || '');
    const pb = String(b.pv || '');
    if(pa !== pb) return pa.localeCompare(pb, 'pt-BR', {numeric:true});
    return String(a.cavalo || '').localeCompare(String(b.cavalo || ''), 'pt-BR', {numeric:true});
  });
}

function renderMonthsPanel(){
  const box = mesesBox;
  const compet = {};
  state.rows.forEach(r => { if(r.competencia){ compet[r.competencia] = (compet[r.competencia] || 0) + 1; } });
  state.finalizados.forEach(r => { if(r.competencia){ compet[r.competencia] = compet[r.competencia] || 0; } });
  const months = Object.keys(compet).sort();
  box.innerHTML = '';
  if(!months.length){ box.innerHTML = '<div class="small">Ainda não há competências carregadas.</div>'; return; }
  months.forEach(m => {
    const abertos = state.rows.filter(r => r.competencia === m).length;
    const finalizados = state.finalizados.filter(r => r.competencia === m).length;
    const pode = abertos === 0;
    const div = document.createElement('div');
    div.className = 'monthCard';
    div.innerHTML = `<div><div style="font-size:30px;font-weight:900;line-height:1">${m}</div><div class="small" style="margin-top:8px">Abertos: ${abertos} | Finalizados: ${finalizados}</div></div><div class="monthStatus ${pode ? 'ok' : 'warn'}">${pode ? 'Sem PV em aberto. Pode zerar.' : 'Ainda com PV em aberto'}</div><div class="monthActions"><button class="mini" onclick="exportarCompetencia('${m}')">Exportar</button><button class="mini btn-red" ${pode ? '' : 'disabled'} onclick="zerarCompetenciaSupabase('${m}')">Zerar Supabase</button></div>`;
    box.appendChild(div);
  });
}
window.exportarCompetencia = function(m){
  const payload = { competencia:m, ativos:state.rows.filter(r => r.competencia === m), finalizados:state.finalizados.filter(r => r.competencia === m) };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `competencia_${m}.json`; a.click(); URL.revokeObjectURL(a.href);
};
window.zerarCompetenciaSupabase = async function(m){
  if(!state.supabase){ alert('Preencha a conexão no HTML.'); return; }
  if(!confirm(`Zerar a competência ${m} na Supabase?`)) return;
  const [year, month] = m.split('-');
  const monthKey = `${year}-${month}-01`;
  const del1 = await state.supabase.from('painel_902').delete().eq('competencia_mes', monthKey);
  const error = del1.error;
  if(error){ alert('Erro ao zerar mês: ' + error.message); return; }
  await carregarDaSupabase();
  alert(`Competência ${m} zerada na Supabase.`);
};

function renderConfigEditors(){
  state.config.aduanas = dedupeList(state.config.aduanas);
  state.config.alerta = dedupeList(state.config.alerta);
  state.config.expo = dedupeList(state.config.expo);
  state.config.paga = dedupeList(state.config.paga);
  state.config.fretes = dedupeFretes(state.config.fretes);
  state.config.checkpoints = dedupeCheckpoints(state.config.checkpoints);
  if(!Array.isArray(state.config.aduanas)) state.config.aduanas = [];
  if(!Array.isArray(state.config.alerta)) state.config.alerta = [];
  if(!Array.isArray(state.config.expo)) state.config.expo = [];
  if(!Array.isArray(state.config.paga)) state.config.paga = [];
  if(!Array.isArray(state.config.fretes)) state.config.fretes = [];

  aduanasBox.innerHTML = state.config.aduanas.map((v,i) => `<div class="cfgItem"><div>${v}</div><button class="xbtn btn-red" onclick="removeSimpleCfg('aduanas', ${i})">x</button></div>`).join('') || '<div class="small">Nenhuma aduana cadastrada.</div>';
  alertasBox.innerHTML = state.config.alerta.map((v,i) => `<div class="cfgItem"><div>${v}</div><button class="xbtn btn-red" onclick="removeSimpleCfg('alerta', ${i})">x</button></div>`).join('') || '<div class="small">Nenhum cliente alerta cadastrado.</div>';
  expoBox.innerHTML = state.config.expo.map((v,i) => `<div class="cfgItem"><div>${v}</div><button class="xbtn btn-red" onclick="removeSimpleCfg('expo', ${i})">x</button></div>`).join('') || '<div class="small">Nenhum cliente exportação cadastrado.</div>';
  pagaBox.innerHTML = state.config.paga.map((v,i) => `<div class="cfgItem"><div>${v}</div><button class="xbtn btn-red" onclick="removeSimpleCfg('paga', ${i})">x</button></div>`).join('') || '<div class="small">Nenhum cliente com regra de aduana cadastrado.</div>';
  fretesBox.innerHTML = state.config.fretes.map((f,i) => `<div class="cfgItem5"><div>${f.pagador || '-'}</div><div>${f.remetente || '-'}</div><div>${f.ufOrigem || '-'}</div><div>${f.ufDestino || '-'}</div><div>${money(f.frete || 0)}</div><button class="xbtn btn-red" onclick="removeFrete(${i})">x</button></div>`).join('') || '<div class="small">Nenhuma regra de frete cadastrada.</div>';
  checkpointBox.innerHTML = (state.config.checkpoints || []).map((c,i) => `<div class="checkpointTag"><div>${c.cliente || '-'}</div><div>${c.cidade || '-'}</div><div>${c.ufOrigem || c.ufDestino || '-'}</div><button class="xbtn btn-red" onclick="removeCheckpoint(${i})">x</button></div>`).join('') || '<div class="small">Nenhum checkpoint cadastrado.</div>';
}
window.removeSimpleCfg = function(name, idx){ state.config[name].splice(idx,1); renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
window.removeFrete = function(idx){ state.config.fretes.splice(idx,1); renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
window.removeCheckpoint = function(idx){ state.config.checkpoints.splice(idx,1); renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };

addCheckpoint.onclick = () => {
  const cliente = cpCliente.value.trim();
  const cidade = cpCidade.value.trim();
  const ufOrigem = cpUfOrigem.value.trim() || 'EX';
  if(!cliente || !cidade) return;
  state.config.checkpoints.push({
    cliente,
    cidade,
    ufOrigem,
    destinoBucket:'alertaInt'
  });
  cpCliente.value = '';
  cpCidade.value = '';
  cpUfOrigem.value = 'EX';
  renderConfigEditors();
  saveLocalDebounced();
  reclassify();
  renderAll(true);
 
};

addAduana.onclick = () => { const v = novoAduana.value.trim(); if(!v) return; state.config.aduanas.push(v); novoAduana.value=''; renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
addAlerta.onclick = () => { const v = novoAlerta.value.trim(); if(!v) return; state.config.alerta.push(v); novoAlerta.value=''; renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
addExpo.onclick = () => { const v = novoExpo.value.trim(); if(!v) return; state.config.expo.push(v); novoExpo.value=''; renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
addPaga.onclick = () => { const v = novoPaga.value.trim(); if(!v) return; state.config.paga.push(v); novoPaga.value=''; renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true); };
addFrete.onclick = () => {
  const pagador = fPagador.value.trim(), remetente = fRemetente.value.trim(), ufOrigem = fUfOrigem.value.trim() || 'EX', ufDestino = fUfDestino.value.trim(), frete = Number(String(fFrete.value).replace(/\./g,'').replace(',','.')) || 0;
  if(!pagador && !remetente && !ufDestino && !frete) return;
  state.config.fretes.push({pagador, remetente, ufOrigem, ufDestino, frete});
  fPagador.value=''; fRemetente.value=''; fUfOrigem.value='EX'; fUfDestino.value=''; fFrete.value='';
  renderConfigEditors(); saveLocalDebounced(); reclassify(); renderAll(true);
};
btnSalvarCfg.onclick = () => {
  if(guardBusy('salvar as configurações')) return;
  state.config.aduanas = (state.config.aduanas || []).map(v => String(v).trim()).filter(Boolean);
  state.config.alerta = (state.config.alerta || []).map(v => String(v).trim()).filter(Boolean);
  state.config.expo = (state.config.expo || []).map(v => String(v).trim()).filter(Boolean);
  state.config.paga = (state.config.paga || []).map(v => String(v).trim()).filter(Boolean);
  state.config.checkpoints = (state.config.checkpoints || []).filter(c => c && c.cliente && c.cidade).map(c => ({cliente:String(c.cliente).trim(), cidade:String(c.cidade).trim(), ufOrigem:String(c.ufOrigem || 'EX').trim(), destinoBucket:String(c.destinoBucket || 'alertaInt').trim()}));
  saveLocalDebounced(); reclassify(); renderAll(true); alert('Configurações salvas.');
};

function renderAll(full=false){
  const rawSets = currentSets();
  const sets = {
    ativo: sortStableRows(rawSets.ativo),
    agNota: sortStableRows(rawSets.agNota),
    aduana: sortStableRows(rawSets.aduana),
    alertaNac: sortStableRows(rawSets.alertaNac),
    alertaInt: sortStableRows(rawSets.alertaInt),
    alertaExpo: sortStableRows(rawSets.alertaExpo)
  };

  cAtivas.textContent = sets.ativo.length;
  cAg.textContent = sets.agNota.length;
  cAgFrete.textContent = `${money(sets.agNota.reduce((a,b) => a + Number(b.frete||0), 0))} em fretes`;
  cAduana.textContent = sets.aduana.length;
  if(cAduanaFrete) cAduanaFrete.textContent = `${money(sets.aduana.reduce((a,b)=>a+Number(b.frete||0),0))} em fretes`;
  cNac.textContent = sets.alertaNac.length;
  cInt.textContent = sets.alertaInt.length;
  cExpo.textContent = sets.alertaExpo.length;
  renderLastUpdate();

  if(full){
    fillSelect(clienteAtivo, unique(sets.ativo, 'pagador'), clienteAtivo.value);
    fillSelect(ufOrigemAtivo, unique(sets.ativo, 'ufRem'), ufOrigemAtivo.value);
    fillSelect(ufDestinoAtivo, unique(sets.ativo, 'ufDest'), ufDestinoAtivo.value);

    fillSelect(clienteAg, unique(sets.agNota, 'pagador'), clienteAg.value);
    fillSelect(ufDestinoAg, unique(sets.agNota, 'ufDest'), ufDestinoAg.value);

    fillSelect(clienteAduana, unique(sets.aduana, 'pagador'), clienteAduana.value);
    fillSelect(ufDestinoAduana, unique(sets.aduana, 'ufDest'), ufDestinoAduana.value);

    fillSelect(clienteNac, unique(sets.alertaNac, 'pagador'), clienteNac.value);
    fillSelect(statusNac, unique(sets.alertaNac, 'status'), statusNac.value);
    fillSelect(ufDestinoNac, unique(sets.alertaNac, 'ufDest'), ufDestinoNac.value);

    fillSelect(clienteInt, unique(sets.alertaInt, 'pagador'), clienteInt.value);
    fillSelect(statusInt, unique(sets.alertaInt, 'status'), statusInt.value);
    fillSelect(ufDestinoInt, unique(sets.alertaInt, 'ufDest'), ufDestinoInt.value);

    fillSelect(clienteExpo, unique(sets.alertaExpo, 'pagador'), clienteExpo.value);
    fillSelect(statusExpo, unique(sets.alertaExpo, 'status'), statusExpo.value);
    fillSelect(ufDestinoExpo, unique(sets.alertaExpo, 'ufDest'), ufDestinoExpo.value);
  }

  renderTable(tbAtivo, filterRows(sets.ativo, {q: buscaAtivo.value, client: clienteAtivo.value, ufOrigem: ufOrigemAtivo.value, ufDestino: ufDestinoAtivo.value}));
  const agRows = filterRows(sets.agNota, {q: buscaAg.value, client: clienteAg.value, ufDestino: ufDestinoAg.value});
  renderTable(tbAg, agRows, true);
  const adRows = filterRows(sets.aduana, {q: buscaAduana.value, client: clienteAduana.value, ufDestino: ufDestinoAduana.value});
  renderTable(tbAduana, adRows, true);
  renderTable(tbNac, filterRows(sets.alertaNac, {q: buscaNac.value, client: clienteNac.value, status: statusNac.value, ufDestino: ufDestinoNac.value}));
  renderTable(tbInt, filterRows(sets.alertaInt, {q: buscaInt.value, client: clienteInt.value, status: statusInt.value, ufDestino: ufDestinoInt.value}));
  renderTable(tbExpo, filterRows(sets.alertaExpo, {q: buscaExpo.value, client: clienteExpo.value, status: statusExpo.value, ufDestino: ufDestinoExpo.value}));
  renderTable(tbFim, state.finalizados, false, true);

  sumAgQtd.textContent = agRows.length;
  sumAgFrete.textContent = money(agRows.reduce((a,b) => a + Number(b.frete||0), 0));
  sumAduanaQtd.textContent = adRows.length;
  sumAduanaFrete.textContent = money(adRows.reduce((a,b) => a + Number(b.frete||0), 0));
  renderMonthsPanel();
}
[buscaAtivo,clienteAtivo,ufOrigemAtivo,ufDestinoAtivo,buscaAg,clienteAg,ufDestinoAg,buscaAduana,clienteAduana,ufDestinoAduana,buscaNac,clienteNac,statusNac,ufDestinoNac,buscaInt,clienteInt,statusInt,ufDestinoInt,buscaExpo,clienteExpo,statusExpo,ufDestinoExpo].forEach(el => el.addEventListener('input', () => renderAll(false)));

function detectHeaderRow(rows){ for(let i=0;i<Math.min(rows.length,15);i++){ const t = (rows[i]||[]).map(x => norm(x)).join('|'); if(t.includes('REF') && t.includes('DATA PC') && t.includes('MOTORISTA')) return i; } return 0; }
async function parseExcelRows(matrix){
  const header = detectHeaderRow(matrix);
  const rows = matrix.slice(header + 1);

  await carregarHistoricoFinalizadosSupabase();
  const oldActiveMap = new Map(state.rows.map(r => [r.id, r]));
  const oldFinalMap = new Map(state.finalizados.map(r => [r.id, r]));
  const remoteFinalizedIds = state.remoteFinalizedIds || new Set();

  const importedActiveMap = new Map();
  const importedFinalMap = new Map(oldFinalMap);

  for(const r of rows){
    if(!r || r.length < 10) continue;

    const ref = String(r[0] || '').trim();
    const dataPC = String(r[1] || '').trim();
    const filial = String(r[2] || '').trim();
    const pv = String(r[3] || '').trim();
    if(!ref || !pv) continue;

    const id = [ref, filial, pv].join('|');
    const old = oldActiveMap.get(id) || oldFinalMap.get(id);

    const numeroDocumentoCol21 = String(r[20] ?? '').trim();
    const autoFinalizar = numeroDocumentoCol21 !== '';

    const baseRow = {
      id, ref, dataPC, filial, pv,
      cavalo: String(r[6] ?? r[5] ?? '').trim(),
      posicao: String(r[8] ?? '').trim(),
      motorista: String(r[9] ?? '').trim(),
      remetente: String(r[10] ?? '').trim(),
      ufRem: String(r[11] ?? '').trim(),
      destinatario: String(r[12] ?? '').trim(),
      ufDest: String(r[13] ?? '').trim(),
      pagador: String(r[14] ?? '').trim(),
      talhao: String(r[15] ?? '').trim(),
      referencia: String(r[16] ?? r[15] ?? '').trim(),
      foiAduana: old?.foiAduana || false,
      passouCheckpoint: old?.passouCheckpoint || false,
      finalizadoEm: old?.finalizadoEm || null
    };

    if(oldFinalMap.has(id) || remoteFinalizedIds.has(id) || old?.status === 'Finalizado'){
      importedFinalMap.set(id, {
        ...baseRow,
        status: 'Finalizado',
        finalizadoEm: oldFinalMap.get(id)?.finalizadoEm || old?.finalizadoEm || new Date().toISOString()
      });
      remoteFinalizedIds.add(id);
      continue;
    }

    if(autoFinalizar){
      importedFinalMap.set(id, {
        ...baseRow,
        status: 'Finalizado',
        finalizadoEm: old?.finalizadoEm || new Date().toISOString()
      });
      remoteFinalizedIds.add(id);
      continue;
    }

    importedActiveMap.set(id, {
  ...baseRow,
  status: old?.status || ''
});
  }

  state.rows = uniqueRowsById([...importedActiveMap.values()]);
  state.finalizados = uniqueRowsById([...importedFinalMap.values()]);
  reclassify();
  saveLocal();
    renderAll(true);
}

function getHeaderIndex624(headers){
  const normalized = headers.map(h => norm(h));
  let idx = normalized.findIndex(h => h === 'OBSERVACAO');
  if(idx >= 0) return idx;
  idx = normalized.findIndex(h => h.includes('OBSERVACAO') || h === 'OBS');
  return idx;
}

function referencia902Valida624(ref){
  const texto = String(ref || '').trim();
  return texto.length >= 5;
}

function extrairObservacoes624(ws){
  const matrix = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
  let headerRowIndex = -1;
  let obsIndex = -1;

  for(let i = 0; i < matrix.length; i++){
    const cols = matrix[i] || [];
    const found = getHeaderIndex624(cols);
    if(found >= 0){
      headerRowIndex = i;
      obsIndex = found;
      break;
    }
  }

  if(obsIndex < 0){
    const jsonRows = XLSX.utils.sheet_to_json(ws, {defval:''});
    return jsonRows.map(linha => String(
      linha.Observação ||
      linha.Observacao ||
      linha.OBSERVAÇÃO ||
      linha.OBSERVACAO ||
      linha.OBS ||
      linha.obs ||
      ''
    )).filter(Boolean);
  }

  return matrix
    .slice(headerRowIndex + 1)
    .map(row => String((row || [])[obsIndex] || ''))
    .filter(Boolean);
}

async function processarImportacao624(file){
  if(!file) return;
  if(guardBusy('importar o 624')) return;

  setBusyOperation('Lendo 624... aguarde');

  try{
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), {type:'array'});
    const observacoes = [];

    wb.SheetNames.forEach(name => {
      const ws = wb.Sheets[name];
      observacoes.push(...extrairObservacoes624(ws));
    });

    const obsNormalizadas = observacoes.map(obs => norm(obs)).filter(Boolean);

    if(!obsNormalizadas.length){
      alert('Nenhuma observação foi encontrada no 624.');
      return;
    }

    const ativos = uniqueRowsById(state.rows);
    const finalizadosAntes = new Set((state.finalizados || []).map(r => r.id));
    const novosFinalizados = [];
    const idsParaFinalizar = new Set();

    ativos.forEach(row => {
      const referenciaOriginal = String(row.referencia || '').trim();
      if(!referencia902Valida624(referenciaOriginal)) return;

      const referenciaNormalizada = norm(referenciaOriginal);
      if(!referenciaNormalizada || referenciaNormalizada.length < 5) return;

      const achouNo624 = obsNormalizadas.some(obs => obs.includes(referenciaNormalizada));
      if(achouNo624) idsParaFinalizar.add(row.id);
    });

    if(!idsParaFinalizar.size){
      alert('Importação 624 concluída. Nenhuma referência do 902 foi localizada nas observações do 624.');
      return;
    }

    const remainingRows = [];
    state.rows.forEach(row => {
      if(idsParaFinalizar.has(row.id)){
        row.status = 'Finalizado';
        row.finalizadoEm = row.finalizadoEm || new Date().toISOString();
        if(!finalizadosAntes.has(row.id)) novosFinalizados.push(row);
      }else{
        remainingRows.push(row);
      }
    });

    state.rows = uniqueRowsById(remainingRows);
    state.finalizados = uniqueRowsById([...novosFinalizados, ...(state.finalizados || [])]);

    reclassify();
    await saveLocal();
    renderAll(true);

    setStatusText(`624: ${idsParaFinalizar.size} programação(ões) finalizada(s)`);

    if(state.supabase){
      setBusyOperation('Salvando finalizações do 624 na Supabase... aguarde');
      await syncToSupabase(true);
    }

    alert(`${idsParaFinalizar.size} programação(ões) finalizada(s) pelo relatório 624.`);
  }catch(err){
    console.error(err);
    alert(err.message || 'Erro ao importar o 624.');
  }finally{
    setBusyOperation('');
  }
}


fileExcel.addEventListener('change', e => {
  if(guardBusy('importar o Excel')){ e.target.value=''; return; }
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const data = new Uint8Array(ev.target.result);
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
    parseExcelRows(matrix);
  };
  reader.readAsArrayBuffer(file); e.target.value = '';
});

if(typeof file624 !== 'undefined' && file624){
  file624.addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    await processarImportacao624(file);
  });
}

window.alterarStatus = async function(id, value, fromFinalizados=false){
  id = decodeURIComponent(id);

  try{
    if(fromFinalizados){
      const idx = state.finalizados.findIndex(x => x.id === id);
      if(idx < 0) return;
      const row = state.finalizados[idx];
      row.status = value;
reclassify();

      if(value !== 'Finalizado'){
        row.finalizadoEm = null;
        state.finalizados.splice(idx, 1);
        state.rows.unshift(row);
        reclassify();
      }

      renderAll(true);
      await autoSaveSingleRow(row, 'atualização de status');
      return;
    }

    const row = state.rows.find(x => x.id === id);
    if(!row) return;

    row.status = value;

    if(value === 'Finalizado'){
      const idx = state.rows.findIndex(x => x.id === id);
      row.finalizadoEm = new Date().toISOString();
      state.finalizados.unshift(row);
      state.rows.splice(idx, 1);
      renderAll(true);
      await autoSaveSingleRow(row, 'finalização da PC');
      return;
    }

    reclassify();
    renderAll(true);
    await autoSaveSingleRow(row, 'atualização de status');
  }catch(err){
    console.error(err);
    alert(err.message || 'Erro ao salvar alteração na Supabase.');
    await saveLocal();
    renderAll(true);
  }
};
window.marcarFaturar = id => alterarStatus(id, 'Faturar', false);
window.marcarFinalizado = id => alterarStatus(id, 'Finalizado', false);
window.reabrirRegistro = async function(id){
  id = decodeURIComponent(id);
  const idx = state.finalizados.findIndex(x => x.id === id);
  if(idx < 0) return;

  try{
    const row = state.finalizados[idx];
    row.status = 'Coleta';
    row.finalizadoEm = null;
    state.finalizados.splice(idx, 1);
    state.rows.unshift(row);
    reclassify();
    renderAll(true);
    await autoSaveSingleRow(row, 'reabertura da PC');
  }catch(err){
    console.error(err);
    alert(err.message || 'Erro ao reabrir PC na Supabase.');
    await saveLocal();
    renderAll(true);
  }
};
btnLimparFinalizados.onclick = () => { if(confirm('Excluir todos os finalizados locais?')){ state.finalizados = []; saveLocal(); renderAll(true); } };

btnExport.onclick = () => {
  const blob = new Blob([JSON.stringify({rows: state.rows, finalizados: state.finalizados, config: state.config}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'painel_902_base.json'; a.click(); URL.revokeObjectURL(a.href);
};
fileBase.addEventListener('change', e => {
  if(guardBusy('importar a base')){ e.target.value=''; return; }
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const data = JSON.parse(ev.target.result);
      state.rows = data.rows || [];
      state.finalizados = data.finalizados || [];
      if(data.config){
        state.config = {
          aduanas: data.config.aduanas || state.config.aduanas,
          alerta: data.config.alerta || state.config.alerta,
          expo: data.config.expo || [],
          paga: data.config.paga || state.config.paga,
          fretes: data.config.fretes || state.config.fretes,
          checkpoints: (data.config.checkpoints || state.config.checkpoints || [{cliente:'MINERVA', cidade:'VARGINHA', ufOrigem:'EX', destinoBucket:'alertaInt'}]).map(c => ({cliente:(c.cliente||''), cidade:(c.cidade||''), ufOrigem:(c.ufOrigem || c.ufDestino || 'EX'), destinoBucket:(c.destinoBucket || 'alertaInt')}))
        };
      }
      if(!Array.isArray(state.config.expo)) state.config.expo = [];
      reclassify(); renderConfigEditors(); saveLocalDebounced(); renderAll(true);
    }catch(err){ alert('JSON inválido.'); }
  };
  reader.readAsText(file); e.target.value = '';
});

function mapRowToDb(row){
  return {id: row.id, pv: row.pv, ref: row.ref, filial: row.filial, data_pc: row.dataPC || null, cavalo: row.cavalo || null, posicao_atual: row.posicao || null, motorista: row.motorista || null, pagador: row.pagador || null, remetente: row.remetente || null, uf_origem: row.ufRem || null, destinatario: row.destinatario || null, uf_destino: row.ufDest || null, talhao: row.talhao || null, referencia: row.referencia || null, status: row.status || 'Coleta', bucket_atual: row.bucket || 'ativo', foi_aduana: !!row.foiAduana, passou_checkpoint: !!row.passouCheckpoint, frete_padrao: Number(row.frete || 0), competencia_mes: row.competencia ? `${row.competencia}-01` : null};
}

async function autoSaveSingleRow(row, actionLabel='salvar a PC'){
  if(!state.supabase || !row?.id) return;
  if(busyOperation){
    throw new Error('Já existe uma operação em andamento.');
  }

  setBusyOperation('Salvando PC... aguarde');
  try{
    const payload = mapRowToDb(row);
    const { error } = await state.supabase.from('painel_902').upsert(payload, { onConflict: 'id' });
    if(error) throw error;
    if(row.status === 'Finalizado') await salvarNoHistoricoFinalizados(row);
    else await removerDoHistoricoFinalizados(row.id);
    await saveLocal();
    setStatusText(`Supabase: ${actionLabel} concluído`);
  } finally {
    setBusyOperation('');
  }
}
async function syncConfigsToSupabase(){
  state.config.aduanas = dedupeList(state.config.aduanas);
  state.config.alerta = dedupeList(state.config.alerta);
  state.config.expo = dedupeList(state.config.expo);
  state.config.paga = dedupeList(state.config.paga);
  state.config.fretes = dedupeFretes(state.config.fretes);
  state.config.checkpoints = dedupeCheckpoints(state.config.checkpoints);
  await state.supabase.from('config_aduanas').delete().neq('id',0);
  await state.supabase.from('config_clientes_alerta').delete().neq('id',0);
  await state.supabase.from('config_clientes_paga').delete().neq('id',0);
  await state.supabase.from('config_clientes_expo').delete().neq('id',0);
  await state.supabase.from('config_frete_padrao').delete().neq('id',0);
  await state.supabase.from('config_checkpoint').delete().neq('id',0);

  if(state.config.aduanas.length) await state.supabase.from('config_aduanas').insert(state.config.aduanas.map(v => ({descricao:v, ativo:true})));
  if(state.config.alerta.length) await state.supabase.from('config_clientes_alerta').insert(state.config.alerta.map(v => ({cliente:v, ativo:true})));
  if(state.config.paga.length) await state.supabase.from('config_clientes_paga').insert(state.config.paga.map(v => ({cliente:v, ativo:true})));
  if(state.config.expo.length) await state.supabase.from('config_clientes_expo').insert(state.config.expo.map(v => ({cliente:v, ativo:true})));
  if(state.config.fretes.length) await state.supabase.from('config_frete_padrao').insert(state.config.fretes.map(v => ({pagador:v.pagador || null, remetente:v.remetente || null, uf_origem:v.ufOrigem || null, uf_destino:v.ufDestino || null, frete:Number(v.frete || 0), ativo:true})));
  if((state.config.checkpoints || []).length) await state.supabase.from('config_checkpoint').insert((state.config.checkpoints || []).map(v => ({cliente:v.cliente || null, cidade:v.cidade || null, uf_origem:v.ufOrigem || 'EX', destino_bucket:v.destinoBucket || 'alertaInt'})));
}
async function syncToSupabase(silent=false){
  if(!state.supabase){
    if(!silent) alert('Preencha a conexão no HTML primeiro.');
    return;
  }
  if(busyOperation){
    if(!silent) alert('Já existe uma operação em andamento. Aguarde terminar.');
    return;
  }

  setBusyOperation('Sincronizando... aguarde');
  try{
    setStatusText('Supabase: sincronizando espelho bruto...');

  state.rows = uniqueRowsById(state.rows);
  state.finalizados = uniqueRowsById(state.finalizados);

  const mergedMap = new Map();
  state.rows.forEach(r => mergedMap.set(r.id, {...r, status: r.status || 'Coleta'}));
  state.finalizados.forEach(r => mergedMap.set(r.id, {...r, status: 'Finalizado', finalizadoEm: r.finalizadoEm || new Date().toISOString()}));

  const payload = uniqueDbPayloadById([...mergedMap.values()].map(mapRowToDb));

  let error = null;

  const dbRows = await fetchAllRows('painel_902', 'id', 'id', true, 1000);
  const dbIds = dbRows.map(x => x.id).filter(Boolean);

  if(dbIds.length){
    for(let i = 0; i < dbIds.length; i += 200){
      const chunk = dbIds.slice(i, i + 200);
      const delRes = await state.supabase.from('painel_902').delete().in('id', chunk);
      error = delRes.error || error;
      if(error) break;
    }
  }

  if(!error && payload.length){
    for(let i = 0; i < payload.length; i += 500){
      const chunk = payload.slice(i, i + 500);
      const insRes = await state.supabase.from('painel_902').upsert(chunk, { onConflict: 'id' });
      error = insRes.error || error;
      if(error) break;
    }
  }

  if(!error){
    const finalPayload = uniqueDbPayloadById(uniqueRowsById(state.finalizados).map(r => ({...mapRowToDb({...r, status:'Finalizado'}), finalizado_em: r.finalizadoEm || new Date().toISOString()})));
    if(finalPayload.length){
      for(let i = 0; i < finalPayload.length; i += 500){
        const chunk = finalPayload.slice(i, i + 500);
        const histRes = await state.supabase.from('painel_902_finalizados').upsert(chunk, { onConflict:'id' });
        error = histRes.error || error;
        if(error) break;
      }
    }
  }

  if(!error){
    await syncConfigsToSupabase();
  }

  if(error){
    setStatusText('Supabase: erro na sincronização');
    if(!silent) alert(error.message || 'Erro ao sincronizar.');
    throw error;
  }

  await saveLocal();
  await markLastUpdate('Sincronização Supabase');
  setStatusText(`Supabase: espelho bruto atualizado (${state.rows.length} ativos / ${state.finalizados.length} finalizados)`);
  if(!silent) alert('Sincronização concluída.');
  } finally {
    setBusyOperation('');
  }
}
async function carregarDaSupabase(silent=false){
  if(!state.supabase){
    if(!silent) alert('Preencha a conexão no HTML primeiro.');
    return;
  }
  if(busyOperation){
    if(!silent) alert('Já existe uma operação em andamento. Aguarde terminar.');
    return;
  }

  setBusyOperation('Carregando... aguarde');
  try{
    setStatusText('Supabase: carregando espelho...');

  let allRowsRaw = [];
  try{
    allRowsRaw = await fetchAllRows('painel_902', '*', 'data_pc', true, 1000);
  }catch(err){
    setStatusText('Supabase: erro ao carregar');
    if(!silent) alert(err.message || 'Erro ao carregar.');
    return;
  }

  const allRows = allRowsRaw.map(d => ({
    id: d.id,
    pv: d.pv || '',
    ref: d.ref || '',
    filial: d.filial || '',
    dataPC: d.data_pc || '',
    cavalo: d.cavalo || '',
    posicao: d.posicao_atual || '',
    motorista: d.motorista || '',
    pagador: d.pagador || '',
    remetente: d.remetente || '',
    ufRem: d.uf_origem || '',
    destinatario: d.destinatario || '',
    ufDest: d.uf_destino || '',
    talhao: d.talhao || '',
    referencia: d.referencia || '',
    status: d.status || 'Coleta',
    foiAduana: !!d.foi_aduana,
    passouCheckpoint: !!d.passou_checkpoint,
    finalizadoEm: d.finalizado_em || null
  }));

  state.finalizados = uniqueRowsById(allRows.filter(r => r.status === 'Finalizado'));
  state.rows = uniqueRowsById(allRows.filter(r => r.status !== 'Finalizado'));
  await carregarHistoricoFinalizadosSupabase();

  const cfgA = await state.supabase.from('config_aduanas').select('descricao').eq('ativo', true);
  const cfgB = await state.supabase.from('config_clientes_alerta').select('cliente').eq('ativo', true);
  const cfgC = await state.supabase.from('config_clientes_paga').select('cliente').eq('ativo', true);
  const cfgD = await state.supabase.from('config_frete_padrao').select('*').eq('ativo', true);
  const cfgE = await state.supabase.from('config_clientes_expo').select('cliente').eq('ativo', true);
  const cfgF = await state.supabase.from('config_checkpoint').select('*');

  if(!cfgA.error && cfgA.data) state.config.aduanas = cfgA.data.map(x => x.descricao);
  if(!cfgB.error && cfgB.data) state.config.alerta = cfgB.data.map(x => x.cliente);
  if(!cfgC.error && cfgC.data) state.config.paga = cfgC.data.map(x => x.cliente);
  if(!cfgD.error && cfgD.data) state.config.fretes = cfgD.data.map(x => ({
    pagador: x.pagador || '',
    remetente: x.remetente || '',
    ufOrigem: x.uf_origem || '',
    ufDestino: x.uf_destino || '',
    frete: x.frete || 0
  }));
  if(!cfgE.error && cfgE.data) state.config.expo = cfgE.data.map(x => x.cliente);
  if(!cfgF.error && cfgF.data) state.config.checkpoints = cfgF.data.map(x => ({
    cliente: x.cliente || '',
    cidade: x.cidade || '',
    ufOrigem: x.uf_origem || 'EX',
    destinoBucket: x.destino_bucket || 'alertaInt'
  }));
  state.config.aduanas = dedupeList(state.config.aduanas);
  state.config.alerta = dedupeList(state.config.alerta);
  state.config.expo = dedupeList(state.config.expo);
  state.config.paga = dedupeList(state.config.paga);
  state.config.fretes = dedupeFretes(state.config.fretes);
  state.config.checkpoints = dedupeCheckpoints(state.config.checkpoints);

  renderConfigEditors();
  reclassify();
  await saveLocal();
  renderAll(true);
  setStatusText(`Supabase: espelho carregado (${state.rows.length} ativos / ${state.finalizados.length} finalizados)`);
  } finally {
    setBusyOperation('');
  }
}
btnSyncSupabase.onclick = () => { if(guardBusy('sincronizar')) return; syncToSupabase(); };
btnCarregarSupabase.onclick = () => { if(guardBusy('carregar')) return; carregarDaSupabase(); };

async function initApp(){
  await loadLocal();
  initSupabase();
  renderLastUpdate();
  await carregarUltimaAtualizacaoSupabase();
  renderConfigEditors();
  reclassify();
  renderAll(true);

  if(state.supabase){
    await carregarDaSupabase(true);
    setStatusText('Supabase: carregado e auto save por PC ativo');
  } else {
    setStatusText('Supabase: modo local');
  }
}
initApp();
