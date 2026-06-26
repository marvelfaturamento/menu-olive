/*
  Refaturamento v14 - Base modular segura
  - Mantém toda a lógica validada em app.js.
  - Adiciona estrutura js/modules/ para separação progressiva.
  - Não altera os cálculos, Supabase ou fluxo operacional.
*/



/* ===== OTIMIZAÇÃO REFATURAMENTO V1 - PAGINAÇÃO E RENDER SOB DEMANDA ===== */
const __PAG_REF = { registros: 1, size: 50 };
function __getActiveViewId(){
  const active = document.querySelector('.view.active');
  return active ? active.id : 'dashboard';
}
function __ensurePager(containerId, total, page, size, onChange){
  let pager = document.getElementById(containerId + '_pager');
  const host = document.getElementById(containerId);
  if(!host || !host.parentElement) return;
  if(!pager){
    pager = document.createElement('div');
    pager.id = containerId + '_pager';
    pager.className = 'summaryLine';
    pager.style.marginTop = '10px';
    host.parentElement.appendChild(pager);
  }
  const pages = Math.max(1, Math.ceil(total / size));
  page = Math.min(Math.max(1, page), pages);
  pager.innerHTML = `
    <button class="btn small secondary" type="button" data-pg="prev">Anterior</button>
    <span class="muted">Página ${page} de ${pages} • ${total} registros</span>
    <button class="btn small secondary" type="button" data-pg="next">Próxima</button>
  `;
  pager.querySelector('[data-pg="prev"]').disabled = page <= 1;
  pager.querySelector('[data-pg="next"]').disabled = page >= pages;
  pager.querySelector('[data-pg="prev"]').onclick = () => onChange(page - 1);
  pager.querySelector('[data-pg="next"]').onclick = () => onChange(page + 1);
}
function renderCurrentView(){
  const view = __getActiveViewId();
  renderTopInfo?.();
  if(view === 'dashboard'){
    renderKPIs?.(); renderSummaryBoxes?.(); renderDashboardCharts?.();
  }else if(view === 'registros'){
    renderRecordsTable?.();
  }else if(view === 'conciliacao'){
    renderConciliationTables?.();
  }else if(view === 'motivos'){
    renderMotivosView?.();
  }else if(view === 'usuarios'){
    renderUsuariosView?.();
  }else if(view === 'performance'){
    renderPerformanceView?.();
  }else if(view === 'clientes'){
    renderClientesView?.();
  }else if(view === 'setores'){
    renderSetoresView?.();
  }else if(view === 'anual'){
    renderAnnualView?.();
  }else if(view === 'cadastro'){
    renderManualTable?.();
  }else if(view === 'config'){
    renderManualTable?.();
  }
}

const { createClient } = supabase;

 const params = new URLSearchParams(window.location.search);

const perfil = params.get("perfil") || "admin";
const usuario = params.get("usuario") || "Tiago";
const usuarioRef = params.get("usuarioRef") || "tiago.carniel";

const DEFAULT_REASONS = [
  'valor incorreto na tabela','valor incorreto','filial incorreta','CNPJ invertido','série incorreta','pagador incorreto',
  'observação incorreta','emissão indevida','imposto incorreto','remetente incorreto','destinatário incorreto',
  'nota fiscal indevida','nota fiscal de pallet','falta de nota fiscal','advalorem','pedágio incorreto','pis/cofins',
  'rateio incorreto','carga de rechaço','carga cancelada','tipo de cte incorreto'
];

const SUPABASE_URL = "https://bcchonskglushqbnwcni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjY2hvbnNrZ2x1c2hxYm53Y25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkxNDUsImV4cCI6MjA5MTMyNTE0NX0.M-yWHlHMFHLE9T5DlJ6nDzutYjRjavHEGvZCH9o2AXg";
const AUTO_SYNC_ON_SAVE = false;

state = {
  sheets: [],
  substitutos: [],
  refaturados: [],
  setores: [],
  prodRows: [],
  live: { sheets: [], substitutos: [], refaturados: [], setores: [], prodRows: [] },
  selectedMonthKey: '',
  charts: {},
  supabase: null,
  manual: readStorage('painel_ref_manual_v30', {}),
  reasons: readStorage('painel_ref_reasons_v30', DEFAULT_REASONS.slice()),
  annual: readStorage('painel_ref_annual_v32', {}),
  annualProd: readStorage('painel_ref_annual_prod_v36', {}),
  remoteMonths: []
};

function readStorage(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  }catch(err){ return fallback; }
}
function writeStorage(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function cloneMonthlySnapshot(){
  return JSON.parse(JSON.stringify({
    sheets: state.sheets,
    substitutos: state.substitutos,
    refaturados: state.refaturados,
    setores: state.setores,
    prodRows: state.prodRows
  }));
}

function snapshotFilteredByMonth(snapshot, key){
  if(!snapshot || !key || !/^\d{4}-\d{2}$/.test(key)) return snapshot;
  const cp = JSON.parse(JSON.stringify({
    sheets: snapshot.sheets || [],
    substitutos: snapshot.substitutos || [],
    refaturados: snapshot.refaturados || [],
    setores: snapshot.setores || [],
    prodRows: snapshot.prodRows || []
  }));

  const sameMonth = (v) => {
    const mk = monthKey(v);
    return mk === key;
  };

  cp.refaturados = (cp.refaturados || []).filter(r =>
    sameMonth(r.dataRefaturado || r.data_baixa || r.baixa || r.data || '')
  );

  cp.substitutos = (cp.substitutos || []).filter(r =>
    sameMonth(r.dataSubstituto || r.data_baixa || r.baixa || r.data || '')
  );

  cp.setores = (cp.setores || []).filter(r =>
    sameMonth(r.data || r.data_baixa || r.baixa || '')
  );

  return cp;
}
function snapshotHasMonthlyData(snapshot){
  return !!(
    snapshot &&
    (
      (snapshot.refaturados && snapshot.refaturados.length) ||
      (snapshot.substitutos && snapshot.substitutos.length) ||
      (snapshot.setores && snapshot.setores.length)
    )
  );
}
function applySnapshot(snapshot){
  if(!snapshot) return;
  state.sheets = JSON.parse(JSON.stringify(snapshot.sheets || []));
  state.substitutos = JSON.parse(JSON.stringify(snapshot.substitutos || []));
  state.refaturados = JSON.parse(JSON.stringify(snapshot.refaturados || []));
  state.setores = JSON.parse(JSON.stringify(snapshot.setores || []));
  state.prodRows = JSON.parse(JSON.stringify(snapshot.prodRows || []));
}
function refreshMonthViewSelect(){
  const select = document.getElementById('monthViewSelect');
  if(!select) return;
  const keys = Array.from(new Set([...(Object.keys(state.annual || {})), ...((state.remoteMonths || []))])).sort();
  let html = '<option value="">Último importado</option>';
  html += keys.map(k => `<option value="${esc(k)}">${monthLabel(k)}</option>`).join('');
  select.innerHTML = html;
  select.value = state.selectedMonthKey || '';
}
async function applyMonthViewSelection(){
  const select = document.getElementById('monthViewSelect');
  if(!select) return;
  const key = select.value || '';

  if(!key){
    state.selectedMonthKey = '';
    applySnapshot(state.live);
    renderAll();
    return;
  }

  // Prioridade 1: usar o snapshot local salvo do mês.
  // Antes, se o mês existisse na Supabase, o painel carregava a base remota primeiro.
  // Quando a Supabase tinha linhas acumuladas/antigas gravadas no mês, os KPIs de Jan/2026
  // apareciam com o total geral. Agora filtramos sempre pela data real da baixa.
  const entry = state.annual[key];
  if(entry && entry.snapshot){
    const filtered = snapshotFilteredByMonth(entry.snapshot, key);
    state.selectedMonthKey = key;
    applySnapshot(snapshotHasMonthlyData(filtered) ? filtered : entry.snapshot);
    renderAll();
    return;
  }

  const loaded = await loadMonthFromSupabase(key);
  if(!loaded){
    alert('Esse mês não está salvo localmente e não foi possível carregar da Supabase.');
  }
}

const TRACKED_USERS = [
  'ademir.fernandes','angelita.santos','carolina.pasquali','elisangela.vieira','geovana.silva','jhonatan.ghizzi','jonathan.balestrin','josete.gabriel','karllin','karoline.romanini','multisoft.service','tiago.carniel','matheus.devise','adenilson.filho','angelica.lucca','leia.mattos'
];
const DOC_TYPES = ['ctrc','manifesto','nf.fat','ost'];
function prodNorm(v){
  return normalizeText(v)
    .replace(/\s+/g,' ')
    .replace(/nf\.?\s*fat/g,'nf.fat')
    .replace(/nf fat/g,'nf.fat')
    .replace(/ordem de servico/g,'ost')
    .replace(/ordem de serviço/g,'ost')
    .trim();
}
function normalizeDocType(v){
  const s = prodNorm(v);
  if(!s) return '';
  if(s.includes('manifest')) return 'manifesto';
  if(s.includes('nf')) return 'nf.fat';
  if(s == 'ost' || s.includes('ordem de servico') || s.includes('ordem de serviço')) return 'ost';
  if(s.includes('ctrc')) return 'ctrc';
  return '';
}
function parseProdWorkbook(workbook){
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });
  const out = [];

  const headerRowIndex = rows.findIndex(r => {
    const row = Array.isArray(r) ? r : [];
    const normalized = row.map(prodNorm);
    const hasUserCol = normalized.some(v => v === 'usuario' || v === 'operador');
    const hasCtrc = normalized.includes('ctrc');
    return hasUserCol && hasCtrc;
  });
  if(headerRowIndex < 0) return out;

  const rawHeader = rows[headerRowIndex] || [];
  const normalizedHeader = rawHeader.map(prodNorm);
  const userCol = normalizedHeader.findIndex(v => v === 'usuario' || v === 'operador');
  const docCols = [];
  for(let c = 0; c < rawHeader.length; c++){
    const tipo = normalizeDocType(rawHeader[c]);
    if(DOC_TYPES.includes(tipo)) docCols.push({ c, tipo });
  }
  if(userCol < 0 || !docCols.length) return out;

  for(let i = headerRowIndex + 1; i < rows.length; i++){
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const usuario = prodNorm(row[userCol]);
    if(!usuario) continue;
    if(usuario.includes('total setor')) continue;

    let rowHasAny = false;
    for(const {c, tipo} of docCols){
      const quantidade = parseNumber(row[c]);
      if(!Number.isFinite(quantidade) || quantidade <= 0) continue;
      rowHasAny = true;
      out.push({ usuario, tipo, quantidade });
    }

    if(!rowHasAny) continue;
  }

  return out.filter(r => TRACKED_USERS.includes(r.usuario));
}

function impactoTotal(v){
  return (
    Number(v.debit || 0) +
    Number(v.freteSubstituto || 0)
  );
}

function aggregateProd(){
  const map = new Map();
  TRACKED_USERS.forEach(u => map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, performance:null, totalDocs:0 }));
  (state.prodRows || []).forEach(r => {
    const u = prodNorm(r.usuario); const t = normalizeDocType(r.tipo);
    if(!u || !DOC_TYPES.includes(t)) return;
    if(!map.has(u)) map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, performance:null, totalDocs:0 });
    map.get(u)[t] = (map.get(u)[t] || 0) + Number(r.quantidade || 0);
  });
  (state.setores || []).filter(s => s.setor === 'FATURAMENTO').forEach(s => {
    const u = prodNorm(s.usuario || '');
    if(!u) return;
    if(!map.has(u)) map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, performance:null, totalDocs:0 });
    map.get(u).erros += 1;
  });
  return Array.from(map.values()).map(x => {
    x.totalDocs = Number(x['ctrc']||0) + Number(x['manifesto']||0) + Number(x['nf.fat']||0) + Number(x['ost']||0);
    const base = Number(x['ctrc']||0) + Number(x['ost']||0);
    const perf = base ? (100 - ((Number(x.erros||0) * 100) / base)) : null;
    x.performance = perf === null ? null : Math.max(0, Math.min(100, perf));
    return x;
  });
}
function ensureSupabaseConnected(){
  if(state.supabase) return true;
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}
function supabaseSetupMessage(){
  return 'Crie as tabelas no Supabase em SQL Editor usando a estrutura já existente do seu projeto e depois atualize a página.';
}
function showSupabaseSetupNeeded(detail=''){
  const base = supabaseSetupMessage();
  document.getElementById('syncStatus').textContent = detail ? `${base} Detalhe: ${detail}` : base;
}

async function __insertChunks(table, rows, chunkSize=200){
  for(let i=0; i<rows.length; i+=chunkSize){
    const chunk = rows.slice(i, i + chunkSize);
    if(!chunk.length) continue;
    const res = await state.supabase.from(table).insert(chunk);
    if(res.error) return res.error;
  }
  return null;
}

async function __deleteRefDocs(rows){
  const docs = [...new Set((rows || []).map(r => String(r.documento || '').trim()).filter(Boolean))];
  for(let i=0; i<docs.length; i+=200){
    const chunk = docs.slice(i, i + 200);
    if(!chunk.length) continue;
    const res = await state.supabase.from('refaturamento_importado').delete().in('documento', chunk);
    if(res.error) return res.error;
  }
  return null;
}

async function __deleteProdOperators(rows){
  const opsByMonth = new Map();
  (rows || []).forEach(r => {
    const key = `${r.mes}|${r.ano}`;
    if(!opsByMonth.has(key)) opsByMonth.set(key, { mes:r.mes, ano:r.ano, ops:new Set() });
    if(r.operador) opsByMonth.get(key).ops.add(String(r.operador));
  });
  for(const group of opsByMonth.values()){
    const ops = [...group.ops];
    for(let i=0; i<ops.length; i+=200){
      const chunk = ops.slice(i, i + 200);
      if(!chunk.length) continue;
      const res = await state.supabase
        .from('produtividade_usuarios')
        .delete()
        .eq('mes', group.mes)
        .eq('ano', group.ano)
        .in('operador', chunk);
      if(res.error) return res.error;
    }
  }
  return null;
}

async function __replaceMesImportado(row){
  const del = await state.supabase.from('meses_importados').delete().eq('mes', row.mes).eq('ano', row.ano);
  if(del.error) return del.error;
  const ins = await state.supabase.from('meses_importados').insert([row]);
  return ins.error || null;
}

function isMissingTableError(error){
  const msg = String(error?.message || error || '');
  return msg.includes('Could not find the table') || msg.includes('404');
}
function connectSupabase(){
  if(!ensureSupabaseConnected()){
    document.getElementById('syncStatus').textContent = 'Preencha SUPABASE_URL e SUPABASE_ANON_KEY dentro do HTML.';
    return;
  }
  document.getElementById('syncStatus').textContent = 'Supabase pronta para sincronizar.';
}
function normalizeRowValue(v){
  if(v == null) return '';
  if(typeof v === 'number') return String(Number(v.toFixed(6)));
  return String(v).trim();
}
function buildSetorDocumentoKey(s){
  return [
    'SETOR',
    s.data || '',
    s.docto || '',
    clientGroup(s.cliente || ''),
    sectorNormalize(s.setor || ''),
    prodNorm(s.usuario || ''),
    normalizeRowValue(parseNumber(s.debit || 0))
  ].join('|');
}
function buildRefRowsForSync(mes, ano){
  const rows = [];
  (state.refaturados || []).forEach(r => {
    const documento = String(r.refaturado || '').trim();
    if(!documento) return;
    rows.push({
      mes, ano, tipo: 'refaturado',
      documento,
      documento_original: String(r.original || '').trim(),
      cte: documento,
      setor: String(r.setorLancamento || r.reduzido || '').trim(),
      cliente: String(r.tomadorRefaturado || '').trim(),
      operador: String(r.userSetor || r.operadorOriginal || '').trim().toUpperCase(),
      debito: parseNumber(r.debit || 0),
      frete_original: parseNumber(r.freteOriginal || 0),
      frete_refaturado: parseNumber(r.freteRefaturado || 0),
      frete_substituto: 0,
      reduzido: String(r.reduzido || '').trim(),
      motivo_baixa: String(r.motivoBaixa || '').trim(),
      data_baixa: toInputDate(r.dataRefaturado) || null
    });
  });
  (state.substitutos || []).forEach(r => {
    const documento = String(r.substituto || '').trim();
    if(!documento) return;
    rows.push({
      mes, ano, tipo: 'substituto',
      documento,
      documento_original: String(r.original || '').trim(),
      cte: documento,
      setor: String(r.reduzido || '').trim(),
      cliente: String(r.tomadorSubstituto || '').trim(),
      operador: String(r.operadorOriginal || '').trim().toUpperCase(),
      debito: 0,
      frete_original: parseNumber(r.freteOriginal || 0),
      frete_refaturado: 0,
      frete_substituto: parseNumber(r.freteSubstituto || 0),
      reduzido: String(r.reduzido || '').trim(),
      motivo_baixa: String(r.motivoBaixa || '').trim(),
      data_baixa: toInputDate(r.dataSubstituto) || null
    });
  });
  (state.setores || []).forEach(s => {
    rows.push({
      mes, ano, tipo: 'setor',
      documento: buildSetorDocumentoKey(s),
      documento_original: String((s.documentos || []).join(',') || '').trim(),
      cte: '',
      setor: String(s.setor || '').trim(),
      cliente: String(s.cliente || '').trim(),
      operador: String(s.usuario || '').trim().toUpperCase(),
      debito: parseNumber(s.debit || 0),
      frete_original: 0,
      frete_refaturado: 0,
      frete_substituto: 0,
      reduzido: '',
      motivo_baixa: '',
      data_baixa: null
    });
  });
  return rows;
}
function buildProdRowsForSync(mes, ano){
  const prodMap = new Map();
  (state.prodRows || []).forEach(r => {
    const operador = String(r.usuario || r.operador || '').trim().toUpperCase();
    const tipo = normalizeDocType(r.tipo || r.tipo_doc || '');
    const qtd = parseNumber(r.quantidade || 0);
    if(!operador || !tipo || qtd <= 0) return;
    const key = `${mes}|${ano}|${operador}`;
    if(!prodMap.has(key)){
      prodMap.set(key, { mes, ano, operador, ctrc:0, manifesto:0, ost:0, nf_fat:0, total_docs:0, docs_performance:0 });
    }
    const row = prodMap.get(key);
    if(tipo === 'ctrc') row.ctrc += qtd;
    else if(tipo === 'manifesto') row.manifesto += qtd;
    else if(tipo === 'ost') row.ost += qtd;
    else if(tipo === 'nf.fat') row.nf_fat += qtd;
    row.total_docs = row.ctrc + row.manifesto + row.ost + row.nf_fat;
    row.docs_performance = row.ctrc + row.ost;
  });
  return Array.from(prodMap.values());
}
function mapByKey(rows, keyFn){
  const map = new Map();
  rows.forEach(row => map.set(keyFn(row), row));
  return map;
}
function sameRefRow(a, b){
  return normalizeRowValue(a.documento_original) === normalizeRowValue(b.documento_original)
    && normalizeRowValue(a.cte) === normalizeRowValue(b.cte)
    && normalizeRowValue(a.cliente) === normalizeRowValue(b.cliente)
    && normalizeRowValue(a.operador) === normalizeRowValue(b.operador)
    && normalizeRowValue(a.setor) === normalizeRowValue(b.setor)
    && normalizeRowValue(a.reduzido) === normalizeRowValue(b.reduzido)
    && normalizeRowValue(a.motivo_baixa) === normalizeRowValue(b.motivo_baixa)
    && normalizeRowValue(a.data_baixa) === normalizeRowValue(b.data_baixa)
    && normalizeRowValue(parseNumber(a.debito || 0)) === normalizeRowValue(parseNumber(b.debito || 0))
    && normalizeRowValue(parseNumber(a.frete_refaturado || 0)) === normalizeRowValue(parseNumber(b.frete_refaturado || 0))
    && normalizeRowValue(parseNumber(a.frete_substituto || 0)) === normalizeRowValue(parseNumber(b.frete_substituto || 0))
    && normalizeRowValue(parseNumber(a.frete_original || 0)) === normalizeRowValue(parseNumber(b.frete_original || 0));
}
function sameProdRow(a, b){
  return normalizeRowValue(a.operador) === normalizeRowValue(b.operador)
    && normalizeRowValue(parseNumber(a.ctrc || 0)) === normalizeRowValue(parseNumber(b.ctrc || 0))
    && normalizeRowValue(parseNumber(a.manifesto || 0)) === normalizeRowValue(parseNumber(b.manifesto || 0))
    && normalizeRowValue(parseNumber(a.ost || 0)) === normalizeRowValue(parseNumber(b.ost || 0))
    && normalizeRowValue(parseNumber(a.nf_fat || 0)) === normalizeRowValue(parseNumber(b.nf_fat || 0))
    && normalizeRowValue(parseNumber(a.total_docs || 0)) === normalizeRowValue(parseNumber(b.total_docs || 0))
    && normalizeRowValue(parseNumber(a.docs_performance || 0)) === normalizeRowValue(parseNumber(b.docs_performance || 0));
}
async function fetchRemoteMonthKeys(){
  if(!ensureSupabaseConnected()) return [];
  const { data, error } = await state.supabase
    .from('meses_importados')
    .select('mes,ano')
    .order('ano', { ascending: true })
    .order('mes', { ascending: true });
  if(error){
    console.error('Erro buscando meses importados:', error);
    if(isMissingTableError(error)) showSupabaseSetupNeeded(error.message);
    return [];
  }
  const keys = Array.from(new Set((data || []).map(r => `${r.ano}-${String(r.mes).padStart(2,'0')}`))).sort();
  state.remoteMonths = keys;
  refreshMonthViewSelect();
  return keys;
}
async function loadMonthFromSupabase(monthKey){
  if(!ensureSupabaseConnected()) return false;
  if(!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return false;
  const [ano, mes] = monthKey.split('-');
  const [{ data: refData, error: refError }, { data: prodData, error: prodError }] = await Promise.all([
    state.supabase.from('refaturamento_importado').select('*').eq('ano', ano).eq('mes', mes),
    state.supabase.from('produtividade_usuarios').select('*').eq('ano', ano).eq('mes', mes)
  ]);
  if(refError){
    console.error(refError);
    if(isMissingTableError(refError)) showSupabaseSetupNeeded(refError.message);
    else document.getElementById('syncStatus').textContent = 'Erro ao carregar refaturamento: ' + refError.message;
    return false;
  }
  if(prodError){
    console.error(prodError);
    if(isMissingTableError(prodError)) showSupabaseSetupNeeded(prodError.message);
    else document.getElementById('syncStatus').textContent = 'Erro ao carregar produtividade: ' + prodError.message;
    return false;
  }

  const allRef = (refData || []).slice().sort((a,b) => String(a.documento || '').localeCompare(String(b.documento || '')));
  const allProd = (prodData || []).slice().sort((a,b) => String(a.operador || '').localeCompare(String(b.operador || '')));
  const refRows = allRef.filter(r => r.tipo === 'refaturado');
  const subRows = allRef.filter(r => r.tipo === 'substituto');
  const setorRows = allRef.filter(r => r.tipo === 'setor');

  state.sheets = ['supabase'];
  state.refaturados = refRows.map(r => ({
    dataRefaturado: r.data_baixa || '',
    tomadorRefaturado: r.cliente || '',
    refaturado: r.documento || '',
    freteRefaturado: parseNumber(r.frete_refaturado || 0),
    dataOriginal: '',
    operadorOriginal: r.operador || '',
    tomadorOriginal: r.cliente || '',
    original: r.documento_original || '',
    freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0,
    reduzido: r.reduzido || '',
    motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''),
    originalTail: (tailDigits(r.documento_original || '') || '').replace(/^0+/,'') || '0',
    debit: parseNumber(r.debito || 0),
    userSetor: r.operador || '',
    setorLancamento: r.setor || ''
  }));
  state.substitutos = subRows.map(r => ({
    dataSubstituto: r.data_baixa || '',
    tomadorSubstituto: r.cliente || '',
    substituto: r.documento || '',
    freteSubstituto: parseNumber(r.frete_substituto || 0),
    dataOriginal: '',
    operadorOriginal: r.operador || '',
    tomadorOriginal: r.cliente || '',
    original: r.documento_original || '',
    freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0,
    reduzido: r.reduzido || '',
    motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''),
    originalTail: (tailDigits(r.documento_original || '') || '').replace(/^0+/,'') || '0',
    debit: 0
  }));
  state.setores = setorRows.map(r => ({
    data: (String(r.documento || '').split('|')[1] || ''),
    docto: (String(r.documento || '').split('|')[2] || ''),
    cliente: r.cliente || '',
    debit: parseNumber(r.debito || 0),
    documentos: docTokens(r.documento_original || ''),
    usuario: r.operador || '',
    setor: r.setor || 'NÃO IDENTIFICADO',
    clientGroup: clientGroup(r.cliente || '')
  }));
  state.prodRows = [];
  allProd.forEach(r => {
    const usuario = prodNorm(r.operador || '');
    const pushRow = (tipo, quantidade) => {
      const q = parseNumber(quantidade || 0);
      if(q > 0) state.prodRows.push({ usuario, tipo, quantidade: q });
    };
    pushRow('ctrc', r.ctrc);
    pushRow('manifesto', r.manifesto);
    pushRow('ost', r.ost);
    pushRow('nf.fat', r.nf_fat);
  });

  let snapshot = cloneMonthlySnapshot();
  const filteredSnapshot = snapshotFilteredByMonth(snapshot, monthKey);
  if(snapshotHasMonthlyData(filteredSnapshot)){
    snapshot = filteredSnapshot;
    applySnapshot(snapshot);
  }
  state.annual[monthKey] = { ...currentAnnualSummary(), snapshot };
  writeStorage('painel_ref_annual_v32', state.annual);
  state.annualProd[monthKey] = {
    documentos: (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0),
    rows: JSON.parse(JSON.stringify(state.prodRows || []))
  };
  writeStorage('painel_ref_annual_prod_v36', state.annualProd);

  state.selectedMonthKey = monthKey;
  applySnapshot(snapshot);
  await fetchRemoteMonthKeys();
  refreshMonthViewSelect();
  const monthSel = document.getElementById('monthViewSelect');
  if(monthSel) monthSel.value = monthKey;
  document.getElementById('syncStatus').textContent = `Mês ${mes}/${ano} carregado da Supabase.`;
  renderAll();
  return true;
}
async function loadLatestMonthFromSupabase(){
  const keys = await fetchRemoteMonthKeys();
  if(!keys.length) return false;
  const targetKey = state.selectedMonthKey && keys.includes(state.selectedMonthKey)
    ? state.selectedMonthKey
    : keys[keys.length - 1];
  return loadMonthFromSupabase(targetKey);
}
async function syncSupabase(){
  if(!ensureSupabaseConnected()){ alert('Configure a Supabase no HTML primeiro.'); return; }

  const refAno = String(document.getElementById('annualYear')?.value || '').trim();
  const refMes = String(document.getElementById('annualMonth')?.value || '').padStart(2,'0');
  const prodAno = String(document.getElementById('prodYear')?.value || '').trim();
  const prodMes = String(document.getElementById('prodMonth')?.value || '').padStart(2,'0');

  const refKey = /^\d{4}-\d{2}$/.test(`${refAno}-${refMes}`) ? `${refAno}-${refMes}` : '';
  const prodKey = /^\d{4}-\d{2}$/.test(`${prodAno}-${prodMes}`) ? `${prodAno}-${prodMes}` : '';

  const refRows = refKey ? buildRefRowsForSync(refMes, refAno) : [];
  const prodRows = prodKey ? buildProdRowsForSync(prodMes, prodAno) : [];

  if(!refRows.length && !prodRows.length){
    alert('Importe o Excel do mês e/ou o Excel de produtividade antes de sincronizar.');
    return;
  }

  document.getElementById('syncStatus').textContent = 'Comparando Excel com Supabase...';

  let remoteRef = [];
  let remoteProd = [];
  let remoteRefError = null;
  let remoteProdError = null;

  if(refRows.length){
    const res = await state.supabase.from('refaturamento_importado').select('*').eq('ano', refAno).eq('mes', refMes);
    remoteRef = res.data || [];
    remoteRefError = res.error || null;
  }
  if(prodRows.length){
    const res = await state.supabase.from('produtividade_usuarios').select('*').eq('ano', prodAno).eq('mes', prodMes);
    remoteProd = res.data || [];
    remoteProdError = res.error || null;
  }

  if(remoteRefError || remoteProdError){
    const err = remoteRefError || remoteProdError;
    const msg = err?.message || 'Erro ao consultar a Supabase.';
    if(isMissingTableError(err)) showSupabaseSetupNeeded(msg);
    else document.getElementById('syncStatus').textContent = 'Erro: ' + msg;
    return;
  }

  const refKeyFn = row => `${row.tipo}|${row.documento}`;
  const prodKeyFn = row => `${row.operador}`;
  const remoteRefMap = mapByKey(remoteRef || [], refKeyFn);
  const remoteProdMap = mapByKey(remoteProd || [], prodKeyFn);

  const refToUpsert = refRows.filter(row => {
    const prev = remoteRefMap.get(refKeyFn(row));
    return !prev || !sameRefRow(row, prev);
  });
  const prodToUpsert = prodRows.filter(row => {
    const prev = remoteProdMap.get(prodKeyFn(row));
    return !prev || !sameProdRow(row, prev);
  });

  const refUniqueMap = new Map();
  refToUpsert.forEach(row => {
    const keyUnique = `${row.tipo}|${row.documento}|${row.mes}|${row.ano}`;
    if(!refUniqueMap.has(keyUnique)) refUniqueMap.set(keyUnique, row);
  });
  const refFinal = Array.from(refUniqueMap.values());

  const prodUniqueMap = new Map();
  prodToUpsert.forEach(row => {
    const keyUnique = `${row.operador}|${row.mes}|${row.ano}`;
    if(!prodUniqueMap.has(keyUnique)) prodUniqueMap.set(keyUnique, row);
  });
  const prodFinal = Array.from(prodUniqueMap.values());

  let refError = null;
  let prodError = null;

  if(refFinal.length){
    refError = await __deleteRefDocs(refFinal) || await __insertChunks('refaturamento_importado', refFinal);
  }
  if(prodFinal.length){
    prodError = await __deleteProdOperators(prodFinal) || await __insertChunks('produtividade_usuarios', prodFinal);
  }

  if(refError || prodError){
    const err = refError || prodError;
    const msg = err?.message || 'Erro na gravação da Supabase.';
    if(isMissingTableError(err)) showSupabaseSetupNeeded(msg);
    else document.getElementById('syncStatus').textContent = `Erro: ${msg}`;
    return;
  }

  const monthMap = new Map();
  if(refKey){
    monthMap.set(refKey, { mes: refMes, ano: refAno, tem_refaturamento: refRows.length > 0, tem_produtividade: false });
  }
  if(prodKey){
    const prevMonth = monthMap.get(prodKey) || { mes: prodMes, ano: prodAno, tem_refaturamento: false, tem_produtividade: false };
    prevMonth.tem_produtividade = prodRows.length > 0 || prevMonth.tem_produtividade;
    monthMap.set(prodKey, prevMonth);
  }

  for(const row of monthMap.values()){
    const prev = await state.supabase
      .from('meses_importados')
      .select('tem_refaturamento,tem_produtividade')
      .eq('mes', row.mes)
      .eq('ano', row.ano)
      .maybeSingle();

    const merged = {
      mes: row.mes,
      ano: row.ano,
      tem_refaturamento: !!row.tem_refaturamento || !!prev.data?.tem_refaturamento,
      tem_produtividade: !!row.tem_produtividade || !!prev.data?.tem_produtividade
    };

    const monthError = await __replaceMesImportado(merged);
    if(monthError){
      document.getElementById('syncStatus').textContent = `Erro: ${monthError.message}`;
      return;
    }
  }

  if(refKey && refRows.length){
    state.annual[refKey] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
    writeStorage('painel_ref_annual_v32', state.annual);
  }
  if(prodKey && prodRows.length){
    state.annualProd[prodKey] = {
      documentos: (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0),
      rows: JSON.parse(JSON.stringify(state.prodRows || []))
    };
    writeStorage('painel_ref_annual_prod_v36', state.annualProd);
  }

  await fetchRemoteMonthKeys();

  const refsMsg = refKey ? `Ref ${refFinal.length} (${monthLabel(refKey)})` : 'Ref 0';
  const prodMsg = prodKey ? `Prod ${prodFinal.length} (${monthLabel(prodKey)})` : 'Prod 0';
  document.getElementById('syncStatus').textContent = `Sincronização concluída. Novos/alterados: ${refsMsg} | ${prodMsg}`;
}

async function replaceSelectedMonthInSupabase(){
  if(!ensureSupabaseConnected()){
    alert('Configure a Supabase primeiro.');
    return;
  }

  const ano = String(document.getElementById('annualYear')?.value || '').trim();
  const mes = String(document.getElementById('annualMonth')?.value || '').padStart(2,'0');
  const key = /^\d{4}-\d{2}$/.test(`${ano}-${mes}`) ? `${ano}-${mes}` : '';

  if(!key){
    alert('Informe mês e ano válidos antes de substituir a Supabase.');
    return;
  }

  const refRows = buildRefRowsForSync(mes, ano);
  if(!refRows.length){
    alert('Importe o Excel correto deste mês antes de substituir a Supabase.');
    return;
  }

  const msg = `ATENÇÃO:\n\nIsso vai apagar somente o mês ${mes}/${ano} da tabela refaturamento_importado na Supabase e gravar novamente com base no Excel carregado agora.\n\nNão apaga outros meses.\n\nDeseja continuar?`;
  if(!confirm(msg)) return;

  const statusEl = document.getElementById('syncStatus');
  if(statusEl) statusEl.textContent = `Substituindo ${mes}/${ano} na Supabase...`;

  try{
    const del = await state.supabase
      .from('refaturamento_importado')
      .delete()
      .eq('ano', ano)
      .eq('mes', mes);

    if(del.error){
      const err = del.error;
      if(isMissingTableError(err)) showSupabaseSetupNeeded(err.message);
      else if(statusEl) statusEl.textContent = 'Erro ao apagar mês: ' + err.message;
      alert('Erro ao apagar o mês na Supabase: ' + err.message);
      return;
    }

    const uniqueMap = new Map();
    refRows.forEach(row => {
      row.data_baixa = toInputDate(row.data_baixa || '') || null;
      row.ano = ano;
      row.mes = mes;
      row.tipo = String(row.tipo || '').trim();
      row.documento = String(row.documento || '').trim();
      const k = `${row.ano}|${row.mes}|${row.tipo}|${row.documento}`;
      // A regra única correta na Supabase é (ano, mes, tipo, documento).
      // Portanto, removemos duplicados internos do Excel pela mesma chave.
      if(row.tipo && row.documento && !uniqueMap.has(k)) uniqueMap.set(k, row);
    });
    const finalRows = Array.from(uniqueMap.values());

    const chunkSize = 400;

    for(let i=0; i<finalRows.length; i+=chunkSize){
      const chunk = finalRows.slice(i, i + chunkSize);

      // Depois que o índice antigo refaturamento_importado_uk foi removido,
      // a constraint correta refaturamento_importado_unique aceita este upsert.
      // Isso protege contra registros do mesmo mês que não tenham sido apagados por RLS/cache
      // e contra reprocessamento do mesmo arquivo.
      const ins = await state.supabase
        .from('refaturamento_importado')
        .upsert(chunk, { onConflict:'ano,mes,tipo,documento' });

      if(ins.error){
        if(statusEl) statusEl.textContent = 'Erro ao gravar mês: ' + ins.error.message;
        alert('Erro ao gravar o mês na Supabase: ' + ins.error.message);
        return;
      }
    }

    const prev = await state.supabase
      .from('meses_importados')
      .select('tem_refaturamento,tem_produtividade')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    await __replaceMesImportado({
      mes,
      ano,
      tem_refaturamento: true,
      tem_produtividade: !!prev.data?.tem_produtividade
    });

    state.annual[key] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
    writeStorage('painel_ref_annual_v32', state.annual);
    state.selectedMonthKey = key;
    const sel = document.getElementById('monthViewSelect');
    if(sel) sel.value = key;
    await fetchRemoteMonthKeys();
    refreshMonthViewSelect();
    renderAll();

    if(statusEl) statusEl.textContent = `Mês ${mes}/${ano} substituído na Supabase com ${finalRows.length} registro(s).`;
    alert(`Mês ${mes}/${ano} substituído na Supabase com sucesso.\nRegistros gravados: ${finalRows.length}`);
  }catch(err){
    console.error(err);
    if(statusEl) statusEl.textContent = 'Erro ao substituir mês: ' + (err.message || err);
    alert('Erro ao substituir mês na Supabase. Veja o console.');
  }
}

function esc(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtMoney(v){ return Number(v || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function parseDateCell(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if(!m) return '';
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${m[2]}-${m[1]}`;
}
function displayDate(v){ if(!v) return '-'; const p = String(v).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v; }
function parseNumber(v){
  if(v == null || v === '') return 0;
  if(typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s/g,'');
  if(s.includes('.') && s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')) s = s.replace(',','.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function toInputDate(v){
  const s = String(v || '').trim();
  if(!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}
function monthKey(v){
  const iso = toInputDate(v);
  return iso ? iso.slice(0,7) : '';
}
function classifyStatus(reqDate, baixaDate){
  const req = toInputDate(reqDate);
  const baixa = toInputDate(baixaDate);

  // Sem data de solicitação = continua sendo "sem solicitação".
  if(!req) return 'empty';

  // Se a baixa ainda não veio do Excel/Supabase, NÃO marcar como mês diferente.
  // Antes isso virava falso positivo, porque comparava solicitação preenchida com baixa vazia.
  if(!baixa) return 'ok';

  return req.slice(0,7) === baixa.slice(0,7) ? 'ok' : 'bad';
}
function statusTag(status){
  if(status === 'ok') return '<span class="tag ok">Mês correto</span>';
  if(status === 'bad') return '<span class="tag bad">Mês diferente</span>';
  return '<span class="tag neutral">Sem solicitação</span>';
}
function normalizeText(v){ return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function upper(v){ return normalizeText(v).toUpperCase(); }
function isSerie80(cte){ const t = String(cte || '').replace(/\s/g,''); return t.includes('-80-') || t.includes('-81-'); }
function tailDigits(v){ const m = String(v || '').match(/(\d+)$/); return m ? m[1] : ''; }
function docTokens(v){
  return (String(v || '').match(/\d+/g) || [])
    .map(x => String(x).trim())
    .filter(Boolean)
    .map(x => x.replace(/^0+/,'') || '0');
}
function sectorNormalize(v){
  const parts = parseReducedSectors(v);
  return parts.length ? parts.join('/') : 'NÃO IDENTIFICADO';
}
function parseReducedSectors(v){
  const s = upper(v).replace(/%/g,' ').replace(/E/g,'/').replace(/,/g,'/');
  const chunks = s.split('/').map(x => x.trim()).filter(Boolean);
  const sectors = [];
  for(let part of chunks){
    part = part.replace(/\d+/g,' ').replace(/\s+/g,' ').trim();
    if(!part) continue;
    if(part.includes('CLIENTES')) part = part.replace('CLIENTES','CLIENTE');
    if(part.includes('FATURAMENTO')) sectors.push('FATURAMENTO');
    else if(part.includes('COMERCIAL')) sectors.push('COMERCIAL');
    else if(part.includes('FINANCEIRO')) sectors.push('FINANCEIRO');
    else if(part.includes('CLIENTE')) sectors.push('CLIENTE');
    else if(part.includes('PCO')) sectors.push('PCO');
    else if(part.includes('RODOPAR')) sectors.push('RODOPAR');
  }
  return [...new Set(sectors)];
}
function sectorFromTitle(text){
  const u = upper(text);
  const idx = u.indexOf('FRETES REFATURADOS');
  if(idx < 0) return '';
  let name = u.slice(idx + 'FRETES REFATURADOS'.length).trim();
  name = name.replace(/^[\-:\.\s]+/, '').trim();
  if(name.startsWith('CLIENTES')) name = 'CLIENTE';
  if(name.startsWith('CLIENTE')) name = 'CLIENTE';
  return name || '';
}
function allSectorNames(){
  const set = new Set();
  state.setores.forEach(s => s.setor && set.add(s.setor));
  state.refaturados.forEach(r => parseReducedSectors(r.reduzido).forEach(x => set.add(x)));
  state.substitutos.forEach(r => parseReducedSectors(r.reduzido).forEach(x => set.add(x)));
  return Array.from(set).filter(Boolean).sort();
}
function clientGroup(name){
  let s = upper(name || '');
  if(!s) return 'SEM CLIENTE';
  s = s.replace(/\bLTDA\b/g,'').replace(/\bS\/A\b/g,'').replace(/\bSA\b/g,'').replace(/\bEIRELI\b/g,'').replace(/\bINDUSTRIA\b/g,'').replace(/\bCOMERCIO\b/g,'').replace(/\bALIMENTOS\b/g,'').replace(/\bDO BRASIL\b/g,' BRASIL ').replace(/\d+/g,'').replace(/\s+/g,' ').trim();
  if(s.includes('NESTLE')) return 'NESTLE';
  if(s.includes('GAROTO')) return 'GAROTO';
  if(s.includes('MARS')) return 'MARS';
  if(s.includes('SEARA')) return 'SEARA';
  if(s.includes('STELLA D ORO')) return 'STELLA D ORO';
  if(s.includes('MCCAIN')) return 'MCCAIN';
  if(s.includes('NEUGEBAUER')) return 'NEUGEBAUER';
  if(s.includes('COLGATE')) return 'COLGATE';
  if(s.includes('NISSIN')) return 'NISSIN';
  if(s.includes('JBS')) return 'JBS';
  if(s.includes('AURORA')) return 'AURORA';
  if(s.includes('MINERVA')) return 'MINERVA';
  if(s.includes('FRIMESA')) return 'FRIMESA';
  return s || 'SEM CLIENTE';
}
function inferReasonFromText(text){
  const t = normalizeText(text);
  for(const item of state.reasons) if(t.includes(normalizeText(item))) return item;
  if(t.includes('pallet')) return 'nota fiscal de pallet';
  if(t.includes('pagador incorreto')) return 'pagador incorreto';
  if(t.includes('valor incorreto')) return 'valor incorreto';
  if(t.includes('pis/cofins') || t.includes('pis cofins')) return 'pis/cofins';
  if(t.includes('advalorem')) return 'advalorem';
  if(t.includes('pedagio')) return 'pedágio incorreto';
  if(t.includes('filial')) return 'filial incorreta';
  if(t.includes('tomador')) return 'pagador incorreto';
  if(t.includes('nf') || t.includes('nota')) return 'nota fiscal indevida';
  return '';
}
function getManual(cte){ return state.manual[cte] || {}; }
function saveManual(cte, payload){
  state.manual[cte] = { ...(state.manual[cte] || {}), ...(payload || {}) };
  writeStorage('painel_ref_manual_v30', state.manual);
}

function toSqlDate(brDate){
  const v = String(brDate || '').trim();
  if(!v) return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function mapManualRowFromSupabase(row){
  if(!row) return null;
  const cte = String(row.documento || row.cte || '').trim();
  if(!cte) return null;

  return {
    cte,
    payload: {
      requestDate: toInputDate(row.solicitacao || ''),
      reason: row.motivo || '',
      detail: row.detalhamento || '',
      audit: String(row.auditoria || 'nao').toLowerCase() === 'sim' ? 'sim' : 'nao'
    }
  };
}

async function loadManualFromSupabase(){
  if(!ensureSupabaseConnected()) return false;
  const { data, error } = await state.supabase
    .from('refaturamento_manual')
    .select('*');

  if(error){
    console.error('Erro carregando refaturamento_manual:', error);
    return false;
  }

  (data || []).forEach(row => {
    const mapped = mapManualRowFromSupabase(row);
    if(mapped) saveManual(mapped.cte, mapped.payload);
  });

  return true;
}

async function saveManualToSupabase(cte, payload){
  if(!ensureSupabaseConnected()){
    return { ok:false, message:'Supabase não configurada.' };
  }

  const solicitacaoSql = toInputDate(payload.requestDate) || null;

  const row = {
    documento: String(cte || '').trim(),
    solicitacao: solicitacaoSql,
    motivo: String(payload.reason || '').trim(),
    detalhamento: String(payload.detail || '').trim(),
    auditoria: String(payload.audit || 'nao').toLowerCase() === 'sim' ? 'sim' : 'nao'
  };

  const res = await state.supabase
    .from('refaturamento_manual')
    .delete()
    .eq('documento', row.documento);

  if(res.error){
    console.error('Erro apagando refaturamento_manual:', res.error);
    return { ok:false, message: res.error?.message || 'Erro ao salvar na Supabase.' };
  }

  const resInsert = await state.supabase
    .from('refaturamento_manual')
    .insert([row]);

  if(resInsert.error){
    console.error('Erro salvando refaturamento_manual:', resInsert.error);
    return { ok:false, message: resInsert.error?.message || 'Erro ao salvar na Supabase.' };
  }

  return { ok:true };
}
function destroyChart(name){ if(state.charts[name]) state.charts[name].destroy(); }
function makeBarChart(id, labels, data, horizontal=false, label='Valor'){
  destroyChart(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  const safeLabels = labels.map(l => {
    const s = String(l);
    return horizontal && s.length > 18 ? s.slice(0,18) + '…' : s;
  });
  state.charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels:safeLabels, datasets:[{ label, data }] },
    options:{
      indexAxis: horizontal ? 'y' : 'x',
      responsive:true, maintainAspectRatio:false,
      layout:{ padding: horizontal ? { right: 70 } : { top: 10 } },
      plugins:{
        legend:{ labels:{ color:'#fff' } },
        tooltip:{
          callbacks:{
            title:(items)=>{
              if(!items.length) return '';
              return String(labels[items[0].dataIndex] ?? '');
            },
            label:(ctx)=> `${label}: ${label === 'Quantidade' ? ctx.raw : fmtMoney(ctx.raw)}`
          }
        },
        datalabels:{
          color:'#ffffff',
          backgroundColor: horizontal ? 'rgba(8,16,29,.88)' : 'transparent',
          borderRadius: horizontal ? 4 : 0,
          padding: horizontal ? {top:2,right:4,bottom:2,left:4} : 0,
          clamp:false,
          clip:false,
          anchor: horizontal ? 'end' : 'center',
          align: horizontal ? 'right' : 'center',
          offset: horizontal ? 8 : 0,
          textAlign: horizontal ? 'left' : 'center',
          formatter:v => label === 'Quantidade' ? v : fmtMoney(v),
          display: horizontal ? true : (labels.length <= 6 && labels.every(l => String(l).length <= 16))
        }
      },
      scales:{
        x:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } },
        y:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } }
      }
    }
  });
}

function makePieChart(id, labels, data, label='Quantidade'){
  destroyChart(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  const values = (data || []).map(v => Number(v || 0));
  const total = values.reduce((a,b)=>a+b,0);
  state.charts[id] = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:(labels || []).map(x => String(x)),
      datasets:[{ label, data:values }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#fff' }, position:'bottom' },
        tooltip:{
          callbacks:{
            label:(ctx)=> {
              const val = Number(ctx.raw || 0);
              const pct = total ? ((val * 100) / total).toFixed(1).replace('.', ',') : '0,0';
              return `${ctx.label}: ${label === 'Valor' ? fmtMoney(val) : val} (${pct}%)`;
            }
          }
        },
        datalabels:{
          color:'#fff',
          formatter:(v)=> total ? `${((Number(v||0)*100)/total).toFixed(0)}%` : '',
          display:(ctx)=> total && Number(ctx.dataset.data[ctx.dataIndex] || 0) > 0
        }
      }
    }
  });
}

function normalizeHeader(value){
  return upper(value)
    .replace(/\s+/g,' ')
    .replace(/[_\-]/g,' ')
    .trim();
}
function rowHasText(row, txt){
  return row.some(v => normalizeHeader(v).includes(txt));
}
function findHeaderMap(row){
  const map = {};
  row.forEach((cell, idx) => {
    const h = normalizeHeader(cell);
    if(!h) return;
    map[h] = idx;
  });
  return map;
}
function getByMap(row, map, candidates){
  for(const c of candidates){
    for(const key of Object.keys(map)){
      if(key === c || key.includes(c)){
        return row[map[key]];
      }
    }
  }
  return '';
}


function parseWorkbook(workbook){
  state.sheets = workbook.sheetNames ? workbook.sheetNames : workbook.SheetNames;
  state.substitutos = [];
  state.refaturados = [];
  state.setores = [];

  const sheetName = state.sheets[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });

  let mode = '';
  let currentSector = '';
  
  for(let i=0; i<rows.length; i++){
    const row = rows[i] || [];
    const rowText = row.map(v => String(v ?? '')).join(' ');
    const rowUp = upper(rowText);
    const first = normalizeHeader(row[0]);

    if(first === 'DOCUMENTOS SUBSTITUTOS'){ mode = 'SUBSTITUTOS'; currentSector=''; continue; }
    if(first === 'DOCUMENTOS REFATURADOS'){ mode = 'REFATURADOS'; currentSector=''; continue; }
    if(rowUp.includes('DESCONTOS EM FATURAS')){ mode = 'SETORES'; currentSector=''; continue; }
    if(rowUp.includes('FRETES REFATURADOS')){ mode = 'SETORES'; currentSector = sectorFromTitle(rowText); continue; }

    if(mode === 'SUBSTITUTOS'){
      if(rowUp.includes('DATA_SUBST') || rowUp.includes('DATA SUBST') || rowUp.includes('DATA_SUBSTITUTO')) continue;
      const substituto = String(row[2] || '').trim();
      if(!/^\d+-\d+-\d+$/.test(substituto)) continue;

      const tomSub = String(row[1] || '').trim();
      const original = String(row[7] || '').trim();
      const tomOrig = String(row[6] || '').trim();

      state.substitutos.push({
        dataSubstituto: parseDateCell(row[0]),
        tomadorSubstituto: tomSub,
        substituto,
        freteSubstituto: parseNumber(row[3]),
        dataOriginal: parseDateCell(row[4]),
        operadorOriginal: String(row[5] || '').trim(),
        tomadorOriginal: tomOrig,
        original,
        freteOriginal: parseNumber(row[8]),
        diferenca: parseNumber(row[9]),
        reduzido: sectorNormalize(row[10]),
        motivoBaixa: String(row[11] || '').trim(),
        clientGroup: clientGroup(tomSub || tomOrig),
        originalTail: (tailDigits(original) || '').replace(/^0+/,'') || '0',
        debit: 0
      });
      continue;
    }

    if(mode === 'REFATURADOS'){
      if(rowUp.includes('DATA_REFAT') || rowUp.includes('DATA REFAT') || rowUp.includes('DATA_REFATURADO')) continue;
      const refaturado = String(row[2] || '').trim();
      if(!/^\d+-\d+-\d+$/.test(refaturado)) continue;

      const tomRef = String(row[1] || '').trim();
      const original = String(row[7] || '').trim();
      const tomOrig = String(row[6] || '').trim();

      state.refaturados.push({
        dataRefaturado: parseDateCell(row[0]),
        tomadorRefaturado: tomRef,
        refaturado,
        freteRefaturado: parseNumber(row[3]),
        dataOriginal: parseDateCell(row[4]),
        operadorOriginal: String(row[5] || '').trim(),
        tomadorOriginal: tomOrig,
        original,
        freteOriginal: parseNumber(row[8]),
        diferenca: parseNumber(row[9]),
        reduzido: sectorNormalize(row[10]),
        motivoBaixa: String(row[11] || '').trim(),
        clientGroup: clientGroup(tomRef || tomOrig),
        originalTail: (tailDigits(original) || '').replace(/^0+/,'') || '0',
        debit: 0,
        userSetor: '',
        setorLancamento: ''
      });
      continue;
    }

    if(mode === 'SETORES'){
      if(rowUp.includes('FRETES REFATURADOS')){
        currentSector = sectorFromTitle(rowText);
        continue;
      }

      if(!currentSector) continue;
      if(rowUp.includes('DATA DOCTO CLIENTE DEBITO')) continue;

      const date = parseDateCell(row[0]);
      const docto = String(row[1] || '').trim();
      const cliente = String(row[2] || '').replace(/\s*-\s*AVISO:.*/i,'').replace(/\s+CONF\..*/i,'').trim();
      const debit = parseNumber(row[3]);
      // Nos blocos válidos (a 2ª ocorrência), o layout é:
      // Data | Docto | Cliente | Débito | Crédito | Documento | Usuário
      const documentoRaw = row[5];
      const documentos = docTokens(documentoRaw);
      const usuario = String(row[6] || '').trim();

      if(!date || !docto || !cliente) continue;
      if(!documentos || !documentos.length) continue;
      if(debit === 0) continue;

      state.setores.push({
        data: date,
        docto,
        cliente,
        debit,
        documentos,
        usuario,
        setor: currentSector,
        clientGroup: clientGroup(cliente)
      });
    }
  }

  const setorIndex = new Map();
  for(const s of state.setores){
    for(const d of s.documentos){
      const key = (String(d).replace(/^0+/,'') || '0');
      if(!setorIndex.has(key)) setorIndex.set(key, []);
      setorIndex.get(key).push(s);
    }
  }

  for(const r of state.refaturados){
    const key = (r.originalTail || '').replace(/^0+/,'') || '0';
    let hits = setorIndex.get(key) || [];
    if(!hits.length){
      hits = [];
      for(const [doc, rows] of setorIndex.entries()){
        if(String(doc).endsWith(key) || key.endsWith(String(doc))){
          hits.push(...rows);
        }
      }
    }
    if(hits.length){
      const hit = hits[0];
      r.debit = hit.debit;
      r.userSetor = hit.usuario;
      r.setorLancamento = hit.setor;
      if(r.reduzido === 'NÃO IDENTIFICADO') r.reduzido = hit.setor;
    }
  }
}

function setorDebitoRows(){
  const m = new Map();
  for(const s of state.setores) m.set(s.setor, (m.get(s.setor) || 0) + Number(s.debit || 0));
  return Array.from(m.entries()).map(([setor, valor])=>({setor, valor})).sort((a,b)=>b.valor-a.valor);
}


function renderTopInfo(){
  const totalDebito = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  document.getElementById('chipSheets').textContent = `${state.sheets.length} abas`;
  document.getElementById('chipRef').textContent = `${state.refaturados.length} refaturados`;
  document.getElementById('chipSub').textContent = `${state.substitutos.length} substitutos`;
  const firstSector = allSectorNames()[0] || 'setor';
  document.getElementById('chipFat').textContent = `${state.setores.filter(s => s.setor === firstSector).length} ${firstSector.toLowerCase()}`;
  document.getElementById('chipTotal').textContent = fmtMoney(totalDebito);
  document.getElementById('subtitle').textContent = state.sheets.length
    ? `Excel carregado com ${state.sheets.length} aba(s). Refaturados: ${state.refaturados.length}. Substitutos: ${state.substitutos.length}.`
    : 'Importe o Excel para iniciar a leitura.';
}

function renderKPIs(){
  const totalRefaturado = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const totalSub = state.substitutos.reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
  const totalGeral = totalRefaturado + totalSub;
  const noReq = state.refaturados.filter(r => !getManual(r.refaturado).requestDate).length;
  const badMonth = state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Refaturado total</div><div class="value">${fmtMoney(totalRefaturado)}</div><div class="hint">Soma do campo Débito dos blocos FRETES REFATURADOS</div></div>
    <div class="kpi"><div class="label">Valor total</div><div class="value">${fmtMoney(totalGeral)}</div><div class="hint">Refaturado + substituto</div></div>
    <div class="kpi"><div class="label">Frete substituto total</div><div class="value">${fmtMoney(totalSub)}</div><div class="hint">Soma do campo FRETE_SUBSTITUTO</div></div>
    <div class="kpi"><div class="label">Mês diferente</div><div class="value">${badMonth}</div><div class="hint">Solicitação x baixa</div></div>
  `;
}

function renderSummaryBoxes(){
  if(!state.sheets.length){
    document.getElementById('resumoBox').textContent = 'Nenhum arquivo importado ainda.';
    document.getElementById('alertasBox').textContent = 'Sem análise enquanto nenhum arquivo foi importado.';
    document.getElementById('tbodyDashSetor').innerHTML = `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
    return;
  }

  const totalRef = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const totalSub = state.substitutos.reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
  const totalGeral = totalRef + totalSub;

  document.getElementById('resumoBox').innerHTML = `
    Refaturado total: <strong>${fmtMoney(totalRef)}</strong><br>
    Valor total: <strong>${fmtMoney(totalGeral)}</strong><br>
    Frete substituto total: <strong>${fmtMoney(totalSub)}</strong><br>
    Fórmula: <strong>refaturado + substituto</strong>
  `;

  document.getElementById('alertasBox').innerHTML = `
    Série 80/81 sem solicitação: <strong>${state.refaturados.filter(r => !getManual(r.refaturado).requestDate).length}</strong><br>
    Baixas em mês diferente: <strong>${state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length}</strong><br>
    Faturamento: <strong>${state.setores.filter(s => s.setor === 'FATURAMENTO').length}</strong> linhas<br>
    Demais setores: <strong>${state.setores.filter(s => s.setor !== 'FATURAMENTO').length}</strong> linhas
  `;

  const setores = setorDebitoRows();
  document.getElementById('tbodyDashSetor').innerHTML = setores.length
    ? setores.map(x => `<tr><td>${esc(x.setor)}</td><td>${fmtMoney(x.valor)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
}

function currentRowsFiltered(){
  const search = normalizeText(document.getElementById('filterSearch').value || '');
  const type = document.getElementById('filterTipo').value;
  const status = document.getElementById('filterStatus').value;
  const only80 = document.getElementById('filterSerie80').value === 'sim';

  let rows = [];
  if(type === 'substituto') rows = state.substitutos.map(r => ({...r, kind:'substituto', cte:r.substituto, date:r.dataSubstituto, client:r.tomadorSubstituto}));
  else if(type === 'refaturado') rows = state.refaturados.map(r => ({...r, kind:'refaturado', cte:r.refaturado, date:r.dataRefaturado, client:r.tomadorRefaturado}));
  else rows = [
    ...state.refaturados.map(r => ({...r, kind:'refaturado', cte:r.refaturado, date:r.dataRefaturado, client:r.tomadorRefaturado})),
    ...state.substitutos.map(r => ({...r, kind:'substituto', cte:r.substituto, date:r.dataSubstituto, client:r.tomadorSubstituto}))
  ];

  return rows.filter(r => {
    const req = getManual(r.cte).requestDate || '';
    const st = classifyStatus(req, r.date);
    const mSearch = !search || normalizeText(r.cte).includes(search) || normalizeText(r.client).includes(search) || normalizeText(r.operadorOriginal || r.userSetor).includes(search) || normalizeText(r.motivoBaixa).includes(search);
    const mStatus = status === 'todos' || st === status;
    const m80 = !only80 || isSerie80(r.cte);
    return mSearch && mStatus && m80;
  });
}

function renderRecordsTable(){
  const rows = currentRowsFiltered();
  const size = __PAG_REF.size;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  __PAG_REF.registros = Math.min(Math.max(1, __PAG_REF.registros || 1), pages);
  const start = (__PAG_REF.registros - 1) * size;
  const pageRows = rows.slice(start, start + size);
  document.getElementById('tbodyRegistros').innerHTML = pageRows.length ? pageRows.map(r => {
    const req = getManual(r.cte).requestDate || '';
    const st = classifyStatus(req, r.date);
    return `
      <tr>
        <td>${esc(r.kind)}</td>
        <td><strong>${esc(r.cte)}</strong></td>
        <td>${esc(r.original || '-')}</td>
        <td>${esc(r.client || '-')}</td>
        <td>${esc(r.userSetor || r.operadorOriginal || '-')}</td>
        <td>${esc(r.setorLancamento || r.reduzido || '-')}</td>
        <td>${displayDate(r.date)}</td>
        <td>${fmtMoney(r.debit || 0)}</td>
        <td>${fmtMoney(r.freteOriginal || 0)}</td>
        <td>${fmtMoney(r.freteRefaturado || 0)}</td>
        <td>${fmtMoney(r.freteSubstituto || 0)}</td>
        <td>${esc(r.motivoBaixa || '-')}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="12" class="center muted">Sem registros</td></tr>`;
  __ensurePager('tbodyRegistros', rows.length, __PAG_REF.registros, size, (p)=>{ __PAG_REF.registros = p; renderRecordsTable(); });
}

function renderConciliationTables(){
  const withoutReq = state.refaturados.filter(r => !getManual(r.refaturado).requestDate);
  const badMonth = state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad');

  document.getElementById('tbodySemSolicitacao').innerHTML = withoutReq.length
    ? withoutReq.map(r => `<tr><td>${esc(r.refaturado)}</td><td>${esc(r.tomadorRefaturado || '-')}</td><td>${displayDate(r.dataRefaturado)}</td><td>${fmtMoney(r.debit || 0)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="center muted">Nenhum registro</td></tr>`;

  document.getElementById('tbodyMesDiferente').innerHTML = badMonth.length
    ? badMonth.map(r => `<tr><td>${esc(r.refaturado)}</td><td>${esc(r.tomadorRefaturado || '-')}</td><td>${displayDate(getManual(r.refaturado).requestDate || '')}</td><td>${displayDate(r.dataRefaturado)}</td><td>${statusTag('bad')}</td></tr>`).join('')
    : `<tr><td colspan="5" class="center muted">Nenhum registro</td></tr>`;
}

function motivoFinal(rec){
  const manual = getManual(rec.refaturado || rec.substituto);
  return manual.reason || inferReasonFromText(rec.motivoBaixa) || 'Sem preenchimento';
}

function motivosAggregate(){
  const map = new Map();
  for(const r of state.refaturados){
    const motivo = motivoFinal(r);
    if(!map.has(motivo)) map.set(motivo, { motivo, qtd:0, original:0, ref:0, sub:0, debito:0 });
    const item = map.get(motivo);
    item.qtd += 1;
    item.original += Number(r.freteOriginal || 0);
    item.ref += Number(r.freteRefaturado || 0);
    item.debito += Number(r.debit || r.freteRefaturado || 0);
  }
  for(const s of state.substitutos){
    const motivo = inferReasonFromText(s.motivoBaixa) || 'Sem preenchimento';
    if(!map.has(motivo)) map.set(motivo, { motivo, qtd:0, original:0, ref:0, sub:0, debito:0 });
    map.get(motivo).sub += Number(s.freteSubstituto || 0);
  }
  return Array.from(map.values()).sort((a,b)=>b.debito-a.debito);
}

function renderMotivosView(){
  const motivos = motivosAggregate();
  const totalRefaturado = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const totalSubstituto = motivos.reduce((s,x)=>s+x.sub,0);
  makeBarChart('chartOriginalRefSubs',
    ['Total','Refaturado','Substituto'],
    [totalRefaturado + totalSubstituto, totalRefaturado, totalSubstituto]
  );
  makeBarChart('chartMotivosQtd', motivos.slice(0,10).map(x=>x.motivo), motivos.slice(0,10).map(x=>x.qtd), true, 'Quantidade');
  makeBarChart('chartMotivosValor', motivos.slice(0,10).map(x=>x.motivo), motivos.slice(0,10).map(x=>x.debito), true, 'Valor');

  document.getElementById('tbodyMotivos').innerHTML = motivos.length
    ? motivos.map(x => `<tr><td>${esc(x.motivo)}</td><td>${x.qtd}</td><td>${fmtMoney(x.original)}</td><td>${fmtMoney(x.ref)}</td><td>${fmtMoney(x.sub)}</td><td>${fmtMoney(x.debito)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados</td></tr>`;
}


function usuariosErroAggregate(){

  const map = new Map();
  const usados = new Set();

  const rows = getUsuariosReasonDetailRows('TODOS') || [];

  rows.forEach(r => {

    const user = prodNorm(r.usuario || '');
    if(!user) return;

    const tipo = String(r.tipo || '').toLowerCase().includes('sub')
      ? 'sub'
      : 'ref';

    const cte = String(r.cte || '').trim();

    const key = `${user}|${tipo}|${cte}`;
    if(usados.has(key)) return;
    usados.add(key);

    if(!map.has(user)){
      map.set(user,{
        user,
        qtdRef:0,
        qtdSub:0,
        qty:0,
        refaturado:0,
        substituto:0,
        total:0
      });
    }

    const item = map.get(user);
    const valor = Number(r.valor || 0);

    if(tipo === 'sub'){
      item.qtdSub += 1;
      item.substituto += valor;
    }else{
      item.qtdRef += 1;
      item.refaturado += valor;
    }

    item.qty = item.qtdRef + item.qtdSub;
    item.total = item.refaturado + item.substituto;

  });

  return Array.from(map.values())
    .sort((a,b)=> b.total - a.total);
}function reduzidoDemaisSetoresAggregate(){
  const setores = allSectorNames().filter(s => s !== 'FATURAMENTO');
  return setores.map(setor => {
    const rows = state.setores.filter(s => s.setor === setor);
    return { setor, qty: rows.length, value: rows.reduce((s,r)=>s+Number(r.debit || 0),0) };
  });
}

function renderUsuariosView(){

  const users = usuariosErroAggregate().slice(0,10);

  makeBarChart(
    'chartUsuariosErroQtd',
    users.map(x=>x.user),
    users.map(x=>x.qty),
    true,
    'Quantidade'
  );

  makeBarChart(
    'chartUsuariosErroValor',
    users.map(x=>x.user),
    users.map(x=>x.total),
    true,
    'Valor'
  );

  document.getElementById('tbodyUsuarios').innerHTML = users.length
  ? users.map(x => `
<tr>
<td>${esc(x.user)}</td>
<td>${x.qtdRef || 0}</td>
<td>${x.qtdSub || 0}</td>
<td>${x.qty || 0}</td>
<td>${fmtMoney(x.refaturado || 0)}</td>
<td>${fmtMoney(x.substituto || 0)}</td>
<td>${fmtMoney(x.total || 0)}</td>
</tr>
`).join('')
  : `<tr><td colspan="7" class="center muted">Sem dados</td></tr>`;
}

function clientesAggregate(){
  const map = new Map();
  for(const r of state.refaturados){
    const key = r.clientGroup || 'SEM CLIENTE';
    if(!map.has(key)) map.set(key, { client:key, qty:0, value:0, reasons:{} });
    const item = map.get(key);
    item.qty += 1;
    item.value += Number(r.freteRefaturado || r.debit || 0);
    const motivo = motivoFinal(r);
    item.reasons[motivo] = (item.reasons[motivo] || 0) + Number(r.debit || 0);
  }
  return Array.from(map.values()).map(item => {
    const principal = Object.entries(item.reasons).sort((a,b)=>b[1]-a[1])[0];
    return { client:item.client, qty:item.qty, value:item.value, topReason:principal ? principal[0] : 'Sem preenchimento' };
  }).sort((a,b)=>b.value-a.value);
}

function renderClientesView(){
  const clients = clientesAggregate();
  const top10 = clients.slice(0,10);
  makeBarChart('chartClienteQtd', top10.map(x=>x.client), top10.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartClienteValor', top10.map(x=>x.client), top10.map(x=>x.value), true, 'Valor');

  destroyChart('chartClienteMotivo');
  state.charts.chartClienteMotivo = new Chart(document.getElementById('chartClienteMotivo'), {
    type:'bar',
    data:{ labels: top10.map(x=>x.client), datasets:[{ label:'Quantidade', data: top10.map(x=>x.qty) }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#fff' } },
        tooltip:{ callbacks:{ afterLabel: ctx => 'Principal motivo: ' + (top10[ctx.dataIndex].topReason || 'Sem preenchimento') } },
        datalabels:{ display:false }
      },
      scales:{
        x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} },
        y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }
      }
    }
  });

  document.getElementById('tbodyClientes').innerHTML = clients.length
    ? clients.map(x => `<tr><td>${esc(x.client)}</td><td>${x.qty}</td><td>${fmtMoney(x.total)}</td><td>${esc(x.topReason)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="center muted">Sem dados</td></tr>`;
}

function renderDashboardCharts(){
  const mapRef = new Map();
  for(const r of state.refaturados) mapRef.set(r.clientGroup, (mapRef.get(r.clientGroup) || 0) + Number(r.freteRefaturado || 0));
  const topRef = Array.from(mapRef.entries()).map(([client, value])=>({client, value})).sort((a,b)=>b.value-a.value).slice(0,10);
  makeBarChart('chartTopClienteRef', topRef.map(x=>x.client), topRef.map(x=>x.value), true, 'Valor');

  const mapSub = new Map();
  for(const s of state.substitutos) mapSub.set(s.clientGroup, (mapSub.get(s.clientGroup) || 0) + Number(s.freteSubstituto || 0));
  const topSub = Array.from(mapSub.entries()).map(([client, value])=>({client, value})).sort((a,b)=>b.value-a.value).slice(0,10);
  makeBarChart('chartTopClienteSub', topSub.map(x=>x.client), topSub.map(x=>x.value), true, 'Valor');

  const setoresDeb = setorDebitoRows();
  makeBarChart('chartSetoresDebito', setoresDeb.map(x=>x.setor), setoresDeb.map(x=>x.valor), false, 'Valor');
}

function aggregateReducedQuantities(){
  const sectors = allSectorNames();
  const counts = Object.fromEntries(sectors.map(s => [s, 0]));
  for(const r of [...state.refaturados, ...state.substitutos]){
    const parts = parseReducedSectors(r.reduzido);
    for(const p of parts){
      if(p in counts) counts[p] += 1;
    }
  }
  return sectors.map(setor => ({ setor, qty: counts[setor] || 0 }));
}

function setoresAggregate(){
  const sectors = allSectorNames();
  return sectors.map(setor => {
    const refRows = state.setores.filter(s => s.setor === setor);
    const subRows = state.substitutos.filter(r => parseReducedSectors(r.reduzido).includes(setor));
    const refValue = refRows.reduce((s,r)=>s+Number(r.debit || 0),0);
    const subValue = subRows.reduce((s,r)=>{
      const parts = parseReducedSectors(r.reduzido);
      const divisor = parts.length || 1;
      return s + Number(r.freteSubstituto || 0) / divisor;
    },0);
    const totalValue = refValue + subValue;
    return { setor, refQty: refRows.length, refValue, subQty: subRows.length, subValue, totalValue };
  });
}

function renderSetoresView(){
  const setores = setoresAggregate();
  makeBarChart('chartSetorRef', setores.map(x=>x.setor), setores.map(x=>x.refValue), false, 'Valor');
  makeBarChart('chartSetorSub', setores.map(x=>x.setor), setores.map(x=>x.subValue), false, 'Valor');
  makeBarChart('chartSetorTotal', setores.map(x=>x.setor), setores.map(x=>x.totalValue), false, 'Valor');

  const reduzidos = aggregateReducedQuantities();
  makeBarChart('chartReduzidoQtdSetor', reduzidos.map(x=>x.setor), reduzidos.map(x=>x.qty), false, 'Quantidade');
  makeBarChart('chartRefQtySetor', setores.map(x=>x.setor), setores.map(x=>x.refQty), false, 'Quantidade');
  makeBarChart('chartSubQtySetor', setores.map(x=>x.setor), setores.map(x=>x.subQty), false, 'Quantidade');

  document.getElementById('tbodySetores').innerHTML = setores.length
    ? setores.map(x => `<tr><td>${esc(x.setor)}</td><td>${x.refQty}</td><td>${fmtMoney(x.refValue)}</td><td>${x.subQty}</td><td>${fmtMoney(x.subValue)}</td><td>${fmtMoney(x.totalValue)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados</td></tr>`;
}

function renderManualTable(){
  const rows = state.refaturados;
  const options = ['<option value="">Selecione</option>'].concat(state.reasons.map(item => `<option value="${esc(item)}">${esc(item)}</option>`)).join('');
  document.getElementById('tbodyCadastro').innerHTML = rows.length ? rows.map(r => {
    const manual = getManual(r.refaturado);
    const motivo = manual.reason || inferReasonFromText(r.motivoBaixa);
    return `
      <tr>
        <td><strong>${esc(r.refaturado)}</strong></td>
        <td>${esc(r.tomadorRefaturado || '-')}</td>
        <td>${displayDate(r.dataRefaturado)}</td>
        <td><input type="date" class="manual-input" data-cte="${esc(r.refaturado)}" data-field="requestDate" value="${esc(toInputDate(manual.requestDate || ''))}"></td>
        <td><select class="manual-input" data-cte="${esc(r.refaturado)}" data-field="reason">${options.replace(`value="${esc(motivo)}"`,`value="${esc(motivo)}" selected`)}</select></td>
        <td><input class="manual-input" data-cte="${esc(r.refaturado)}" data-field="detail" value="${esc(manual.detail || '')}" placeholder="Detalhar"></td>
        <td><select class="manual-input" data-cte="${esc(r.refaturado)}" data-field="audit"><option value="nao" ${manual.audit === 'nao' || !manual.audit ? 'selected' : ''}>Não</option><option value="sim" ${manual.audit === 'sim' ? 'selected' : ''}>Sim</option></select></td>
        <td><button class="btn small btn-save-manual" data-cte="${esc(r.refaturado)}">Salvar</button></td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8" class="center muted">Nenhum refaturado identificado</td></tr>`;
}


function renderTopInfo(){
  const totalDebito = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  document.getElementById('chipSheets').textContent = `${state.sheets.length} abas`;
  document.getElementById('chipRef').textContent = `${state.refaturados.length} refaturados`;
  document.getElementById('chipSub').textContent = `${state.substitutos.length} substitutos`;
  const firstSector = allSectorNames()[0] || 'setor';
  document.getElementById('chipFat').textContent = `${state.setores.filter(s => s.setor === firstSector).length} ${firstSector.toLowerCase()}`;
  document.getElementById('chipTotal').textContent = fmtMoney(totalDebito);

  document.getElementById('subtitle').textContent = state.sheets.length
    ? `Excel carregado com ${state.sheets.length} aba(s). Refaturados: ${state.refaturados.length}. Substitutos: ${state.substitutos.length}.`
    : 'Importe o Excel para iniciar a leitura.';
}


function currentAnnualSummary(){
  const setores = setoresAggregate();
  const refaturado = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const substituto = state.substitutos.reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
  const total = refaturado + substituto;
  const sectors = {};
  setores.forEach(s => { sectors[s.setor] = { refaturado:s.refValue, substituto:s.subValue, total:s.totalValue }; });
  const produtividade = (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0);
  return { refaturado, substituto, total, produtividade, sectors };
}
function monthLabel(key){ const [y,m]=key.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${names[Number(m)-1]||m}/${y}`; }
function saveCurrentMonthToAnnual(){
  if(!state.sheets.length){ alert('Importe um Excel antes.'); return; }
  const month = document.getElementById('annualMonth').value;
  const year = document.getElementById('annualYear').value || new Date().getFullYear();
  const key = `${year}-${month}`;
  state.annual[key] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
  writeStorage('painel_ref_annual_v32', state.annual);
  refreshMonthViewSelect();
  renderAnnualView();
  if(AUTO_SYNC_ON_SAVE) syncSupabase().catch(console.error);
  alert('Mês salvo na base anual.');
}
function saveCurrentProdMonth(){
  if(!(state.prodRows || []).length){ alert('Importe um Excel de produtividade antes.'); return; }
  const month = document.getElementById('prodMonth').value;
  const year = document.getElementById('prodYear').value || new Date().getFullYear();
  const key = `${year}-${month}`;
  const docs = (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0);
  state.annualProd[key] = { documentos: docs, rows: JSON.parse(JSON.stringify(state.prodRows || [])) };
  writeStorage('painel_ref_annual_prod_v36', state.annualProd);
  renderAnnualView();
  alert('Documentos do mês salvos na base anual.');
}
function renderAnnualView(){
  const keys = Object.keys(state.annual).sort();
  const labels = keys.map(monthLabel);
  const ref = keys.map(k => Number(state.annual[k].refaturado||0));
  const sub = keys.map(k => Number(state.annual[k].substituto||0));
  const tot = keys.map(k => Number(state.annual[k].total||0));
  const lineOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{ labels:{ color:'#fff' } },
      datalabels:{ color:'#fff', align:'top', anchor:'end', offset:4, formatter:v => fmtMoney(v), display:true, backgroundColor:'rgba(8,16,29,.88)', borderRadius:4, padding:3 }
    },
    scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } }
  };
  destroyChart('chartAnnualTotals');
  const ctx1 = document.getElementById('chartAnnualTotals');
  if(ctx1){
    state.charts.chartAnnualTotals = new Chart(ctx1,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:ref},{label:'Substituto', data:sub},{label:'Total', data:tot}] }, options:lineOpts });
  }
  const select = document.getElementById('annualSectorSelect');
  if(select){
    const sectorNames = Array.from(new Set(keys.flatMap(k => Object.keys(state.annual[k].sectors || {})))).sort();
    const cur = select.value;
    select.innerHTML = sectorNames.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(sectorNames.includes(cur)) select.value = cur;
    const sector = select.value || sectorNames[0] || '';
    const sref = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).refaturado||0));
    const ssub = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).substituto||0));
    const stot = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).total||0));
    destroyChart('chartAnnualSector');
    const ctx2 = document.getElementById('chartAnnualSector');
    if(ctx2){
      state.charts.chartAnnualSector = new Chart(ctx2,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:sref},{label:'Substituto', data:ssub},{label:'Total', data:stot}] }, options:lineOpts });
    }
  }
  const prod = keys.map(k => Number((state.annualProd[k]||{}).documentos||0));
  destroyChart('chartAnnualProd');
  const ctx3 = document.getElementById('chartAnnualProd');
  if(ctx3){
    state.charts.chartAnnualProd = new Chart(ctx3,{ type:'bar', data:{ labels, datasets:[{label:'Documentos', data:prod}] }, options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ color:'#fff', align:'top', anchor:'end', offset:4, formatter:v => v, display:true, backgroundColor:'rgba(8,16,29,.88)', borderRadius:4, padding:3 } },
      scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } }
    } });
  }

  document.getElementById('tbodyAnnualMonths').innerHTML = keys.length
    ? keys.map(k => `<tr><td>${esc(monthLabel(k))}</td><td>${fmtMoney(state.annual[k].refaturado||0)}</td><td>${fmtMoney(state.annual[k].substituto||0)}</td><td>${fmtMoney(state.annual[k].total||0)}</td><td>${Number((state.annualProd[k]||{}).documentos||0)}</td><td style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn small btn-load-annual" data-key="${esc(k)}">Consultar</button><button class="btn small btn-remove-annual" data-key="${esc(k)}">Remover</button></td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Nenhum mês salvo</td></tr>`;
}function renderSummaryBoxes(){
  if(!state.sheets.length){
    document.getElementById('resumoBox').textContent = 'Nenhum arquivo importado ainda.';
    document.getElementById('alertasBox').textContent = 'Sem análise enquanto nenhum arquivo foi importado.';
    document.getElementById('tbodyDashSetor').innerHTML = `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
    return;
  }

  const totalRef = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const totalSub = state.substitutos.reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
  const totalGeral = totalRef + totalSub;

  document.getElementById('resumoBox').innerHTML = `
    Refaturado total: <strong>${fmtMoney(totalRef)}</strong><br>
    Valor total: <strong>${fmtMoney(totalGeral)}</strong><br>
    Frete substituto total: <strong>${fmtMoney(totalSub)}</strong><br>
    Fórmula: <strong>refaturado + substituto</strong>
  `;

  document.getElementById('alertasBox').innerHTML = `
    Série 80/81 sem solicitação: <strong>${state.refaturados.filter(r => !getManual(r.refaturado).requestDate).length}</strong><br>
    Baixas em mês diferente: <strong>${state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length}</strong><br>
    Faturamento: <strong>${state.setores.filter(s => s.setor === 'FATURAMENTO').length}</strong> linhas<br>
    Demais setores: <strong>${state.setores.filter(s => s.setor !== 'FATURAMENTO').length}</strong> linhas
  `;

  const setores = setorDebitoRows();
  document.getElementById('tbodyDashSetor').innerHTML = setores.length
    ? setores.map(x => `<tr><td>${esc(x.setor)}</td><td>${fmtMoney(x.valor)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
}

function currentRowsFiltered(){
  const search = normalizeText(document.getElementById('filterSearch').value || '');
  const type = document.getElementById('filterTipo').value;
  const status = document.getElementById('filterStatus').value;
  const only80 = document.getElementById('filterSerie80').value === 'sim';

  let rows = [];
  if(type === 'substituto') rows = state.substitutos.map(r => ({...r, kind:'substituto', cte:r.substituto, date:r.dataSubstituto, client:r.tomadorSubstituto}));
  else if(type === 'refaturado') rows = state.refaturados.map(r => ({...r, kind:'refaturado', cte:r.refaturado, date:r.dataRefaturado, client:r.tomadorRefaturado}));
  else rows = [
    ...state.refaturados.map(r => ({...r, kind:'refaturado', cte:r.refaturado, date:r.dataRefaturado, client:r.tomadorRefaturado})),
    ...state.substitutos.map(r => ({...r, kind:'substituto', cte:r.substituto, date:r.dataSubstituto, client:r.tomadorSubstituto}))
  ];

  return rows.filter(r => {
    const req = getManual(r.cte).requestDate || '';
    const st = classifyStatus(req, r.date);
    const mSearch = !search || normalizeText(r.cte).includes(search) || normalizeText(r.client).includes(search) || normalizeText(r.operadorOriginal || r.userSetor).includes(search) || normalizeText(r.motivoBaixa).includes(search);
    const mStatus = status === 'todos' || st === status;
    const m80 = !only80 || isSerie80(r.cte);
    return mSearch && mStatus && m80;
  });
}

function renderRecordsTable(){
  const rows = currentRowsFiltered();
  document.getElementById('tbodyRegistros').innerHTML = rows.length ? rows.map(r => {
    const req = getManual(r.cte).requestDate || '';
    const st = classifyStatus(req, r.date);
    return `
      <tr>
        <td>${esc(r.kind)}</td>
        <td><strong>${esc(r.cte)}</strong></td>
        <td>${esc(r.original || '-')}</td>
        <td>${esc(r.client || '-')}</td>
        <td>${esc(r.userSetor || r.operadorOriginal || '-')}</td>
        <td>${esc(r.setorLancamento || r.reduzido || '-')}</td>
        <td>${displayDate(r.date)}</td>
        <td>${fmtMoney(r.debit || 0)}</td>
        <td>${fmtMoney(r.freteOriginal || 0)}</td>
        <td>${fmtMoney(r.freteRefaturado || 0)}</td>
        <td>${fmtMoney(r.freteSubstituto || 0)}</td>
        <td>${esc(r.motivoBaixa || '-')}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="12" class="center muted">Sem registros</td></tr>`;
}

function renderConciliationTables(){
  const withoutReq = state.refaturados.filter(r => !getManual(r.refaturado).requestDate);
  const badMonth = state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad');

  document.getElementById('tbodySemSolicitacao').innerHTML = withoutReq.length
    ? withoutReq.map(r => `<tr><td>${esc(r.refaturado)}</td><td>${esc(r.tomadorRefaturado || '-')}</td><td>${displayDate(r.dataRefaturado)}</td><td>${fmtMoney(r.debit || 0)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="center muted">Nenhum registro</td></tr>`;

  document.getElementById('tbodyMesDiferente').innerHTML = badMonth.length
    ? badMonth.map(r => `<tr><td>${esc(r.refaturado)}</td><td>${esc(r.tomadorRefaturado || '-')}</td><td>${displayDate(getManual(r.refaturado).requestDate || '')}</td><td>${displayDate(r.dataRefaturado)}</td><td>${statusTag('bad')}</td></tr>`).join('')
    : `<tr><td colspan="5" class="center muted">Nenhum registro</td></tr>`;
}

function motivoFinal(rec){
  const manual = getManual(rec.refaturado || rec.substituto);
  return manual.reason || inferReasonFromText(rec.motivoBaixa) || 'Sem preenchimento';
}

function motivosAggregate(){
  const map = new Map();
  for(const r of state.refaturados){
    const motivo = motivoFinal(r);
    if(!map.has(motivo)) map.set(motivo, { motivo, qtd:0, original:0, ref:0, sub:0, debito:0 });
    const item = map.get(motivo);
    item.qtd += 1;
    item.original += Number(r.freteOriginal || 0);
    item.ref += Number(r.freteRefaturado || 0);
    item.debito += Number(r.debit || r.freteRefaturado || 0);
  }
  for(const s of state.substitutos){
    const motivo = inferReasonFromText(s.motivoBaixa) || 'Sem preenchimento';
    if(!map.has(motivo)) map.set(motivo, { motivo, qtd:0, original:0, ref:0, sub:0, debito:0 });
    map.get(motivo).sub += Number(s.freteSubstituto || 0);
  }
  return Array.from(map.values()).sort((a,b)=>b.debito-a.debito);
}

function renderMotivosView(){
  const motivos = motivosAggregate();
  const totalRefaturado = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const totalSubstituto = motivos.reduce((s,x)=>s+x.sub,0);
  makeBarChart('chartOriginalRefSubs',
    ['Total','Refaturado','Substituto'],
    [totalRefaturado + totalSubstituto, totalRefaturado, totalSubstituto]
  );
  makeBarChart('chartMotivosQtd', motivos.slice(0,10).map(x=>x.motivo), motivos.slice(0,10).map(x=>x.qtd), true, 'Quantidade');
  makeBarChart('chartMotivosValor', motivos.slice(0,10).map(x=>x.motivo), motivos.slice(0,10).map(x=>x.debito), true, 'Valor');

  document.getElementById('tbodyMotivos').innerHTML = motivos.length
    ? motivos.map(x => `<tr><td>${esc(x.motivo)}</td><td>${x.qtd}</td><td>${fmtMoney(x.original)}</td><td>${fmtMoney(x.ref)}</td><td>${fmtMoney(x.sub)}</td><td>${fmtMoney(x.debito)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados</td></tr>`;
}


function usuariosErroAggregate(){

  const map = new Map();

  (state.setores || []).forEach(s => {

    const setor = upper(s.setor || '');

    if(setor !== 'FATURAMENTO') return;

    const user = prodNorm(
      s.usuario || s.userSetor || ''
    );

    if(!user) return;

    if(!map.has(user)){

      map.set(user, {
  user,
  qtdRef:0,
  qtdSub:0,
  qty:0,
  refaturado:0,
  substituto:0,
  total:0
});

    }

    const item = map.get(user);

    const ref = Number(s.debit || 0);

    item.qty += 1;

item.refaturado += ref;

(state.substitutos || []).forEach(subRow => {

  const subUser = prodNorm(
    subRow.userSetor ||
    subRow.operadorOriginal ||
    ''
  );

  if(subUser !== user) return;

  const subValor = Number(
    subRow.freteSubstituto || 0
  );

  if(subValor > 0){

    item.qtdSub += 1;
    item.substituto += subValor;

  }

});

item.total =
  item.refaturado +
  item.substituto;

  });

  return Array
    .from(map.values())
    .sort((a,b)=> b.total - a.total);

}


function reduzidoDemaisSetoresAggregate(){
  const setores = allSectorNames().filter(s => s !== 'FATURAMENTO');
  return setores.map(setor => {
    const rows = state.setores.filter(s => s.setor === setor);
    return { setor, qty: rows.length, value: rows.reduce((s,r)=>s+Number(r.debit || 0),0) };
  });
}

function renderUsuariosView(){
  const users = usuariosErroAggregate().slice(0,10);
  makeBarChart('chartUsuariosErroQtd', users.map(x=>x.user), users.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuariosErroValor', users.map(x=>x.user), users.map(x=>x.total), true, 'Valor');

document.getElementById('tbodyUsuarios').innerHTML = users.length
  ? users.map(x => `
<tr>
<td>${esc(x.user)}</td>
<td>${x.qtdRef || 0}</td>
<td>${x.qtdSub || 0}</td>
<td>${x.qty || 0}</td>
<td>${fmtMoney(x.refaturado || 0)}</td>
<td>${fmtMoney(x.substituto || 0)}</td>
<td>${fmtMoney(x.total || 0)}</td>
</tr>
`).join('')
  : `<tr><td colspan="7" class="center muted">Sem dados</td></tr>`;
}

function clientesAggregate(){
  const map = new Map();
  for(const r of state.refaturados){
    const key = r.clientGroup || 'SEM CLIENTE';
    if(!map.has(key)) map.set(key, { client:key, qty:0, value:0, reasons:{} });
    const item = map.get(key);
    item.qty += 1;
    item.value += Number(r.freteRefaturado || r.debit || 0);
    const motivo = motivoFinal(r);
    item.reasons[motivo] = (item.reasons[motivo] || 0) + Number(r.debit || 0);
  }
  return Array.from(map.values()).map(item => {
    const principal = Object.entries(item.reasons).sort((a,b)=>b[1]-a[1])[0];
    return { client:item.client, qty:item.qty, value:item.value, topReason:principal ? principal[0] : 'Sem preenchimento' };
  }).sort((a,b)=>b.value-a.value);
}

function renderClientesView(){
  const clients = clientesAggregate();
  const top10 = clients.slice(0,10);
  makeBarChart('chartClienteQtd', top10.map(x=>x.client), top10.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartClienteValor', top10.map(x=>x.client), top10.map(x=>x.value), true, 'Valor');

  destroyChart('chartClienteMotivo');
  state.charts.chartClienteMotivo = new Chart(document.getElementById('chartClienteMotivo'), {
    type:'bar',
    data:{ labels: top10.map(x=>x.client), datasets:[{ label:'Quantidade', data: top10.map(x=>x.qty) }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#fff' } },
        tooltip:{ callbacks:{ afterLabel: ctx => 'Principal motivo: ' + (top10[ctx.dataIndex].topReason || 'Sem preenchimento') } },
        datalabels:{ display:false }
      },
      scales:{
        x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} },
        y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }
      }
    }
  });

  document.getElementById('tbodyClientes').innerHTML = clients.length
    ? clients.map(x => `<tr><td>${esc(x.client)}</td><td>${x.qty}</td><td>${fmtMoney(x.total)}</td><td>${esc(x.topReason)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="center muted">Sem dados</td></tr>`;
}

function renderDashboardCharts(){
  const mapRef = new Map();
  for(const r of state.refaturados) mapRef.set(r.clientGroup, (mapRef.get(r.clientGroup) || 0) + Number(r.freteRefaturado || 0));
  const topRef = Array.from(mapRef.entries()).map(([client, value])=>({client, value})).sort((a,b)=>b.value-a.value).slice(0,10);
  makeBarChart('chartTopClienteRef', topRef.map(x=>x.client), topRef.map(x=>x.value), true, 'Valor');

  const mapSub = new Map();
  for(const s of state.substitutos) mapSub.set(s.clientGroup, (mapSub.get(s.clientGroup) || 0) + Number(s.freteSubstituto || 0));
  const topSub = Array.from(mapSub.entries()).map(([client, value])=>({client, value})).sort((a,b)=>b.value-a.value).slice(0,10);
  makeBarChart('chartTopClienteSub', topSub.map(x=>x.client), topSub.map(x=>x.value), true, 'Valor');

  const setoresDeb = setorDebitoRows();
  makeBarChart('chartSetoresDebito', setoresDeb.map(x=>x.setor), setoresDeb.map(x=>x.valor), false, 'Valor');
}

function aggregateReducedQuantities(){
  const sectors = allSectorNames();
  const counts = Object.fromEntries(sectors.map(s => [s, 0]));
  for(const r of [...state.refaturados, ...state.substitutos]){
    const parts = parseReducedSectors(r.reduzido);
    for(const p of parts){
      if(p in counts) counts[p] += 1;
    }
  }
  return sectors.map(setor => ({ setor, qty: counts[setor] || 0 }));
}

function setoresAggregate(){
  const sectors = allSectorNames();
  return sectors.map(setor => {
    const refRows = state.setores.filter(s => s.setor === setor);
    const subRows = state.substitutos.filter(r => parseReducedSectors(r.reduzido).includes(setor));
    const refValue = refRows.reduce((s,r)=>s+Number(r.debit || 0),0);
    const subValue = subRows.reduce((s,r)=>{
      const parts = parseReducedSectors(r.reduzido);
      const divisor = parts.length || 1;
      return s + Number(r.freteSubstituto || 0) / divisor;
    },0);
    const totalValue = refValue + subValue;
    return { setor, refQty: refRows.length, refValue, subQty: subRows.length, subValue, totalValue };
  });
}

function renderSetoresView(){
  const setores = setoresAggregate();
  makeBarChart('chartSetorRef', setores.map(x=>x.setor), setores.map(x=>x.refValue), false, 'Valor');
  makeBarChart('chartSetorSub', setores.map(x=>x.setor), setores.map(x=>x.subValue), false, 'Valor');
  makeBarChart('chartSetorTotal', setores.map(x=>x.setor), setores.map(x=>x.totalValue), false, 'Valor');

  const reduzidos = aggregateReducedQuantities();
  makeBarChart('chartReduzidoQtdSetor', reduzidos.map(x=>x.setor), reduzidos.map(x=>x.qty), false, 'Quantidade');
  makeBarChart('chartRefQtySetor', setores.map(x=>x.setor), setores.map(x=>x.refQty), false, 'Quantidade');
  makeBarChart('chartSubQtySetor', setores.map(x=>x.setor), setores.map(x=>x.subQty), false, 'Quantidade');

  document.getElementById('tbodySetores').innerHTML = setores.length
    ? setores.map(x => `<tr><td>${esc(x.setor)}</td><td>${x.refQty}</td><td>${fmtMoney(x.refValue)}</td><td>${x.subQty}</td><td>${fmtMoney(x.subValue)}</td><td>${fmtMoney(x.totalValue)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados</td></tr>`;
}

function renderManualTable(){
  const rows = state.refaturados;
  const options = ['<option value="">Selecione</option>'].concat(state.reasons.map(item => `<option value="${esc(item)}">${esc(item)}</option>`)).join('');
  document.getElementById('tbodyCadastro').innerHTML = rows.length ? rows.map(r => {
    const manual = getManual(r.refaturado);
    const motivo = manual.reason || inferReasonFromText(r.motivoBaixa);
    return `
      <tr>
        <td><strong>${esc(r.refaturado)}</strong></td>
        <td>${esc(r.tomadorRefaturado || '-')}</td>
        <td>${displayDate(r.dataRefaturado)}</td>
        <td><input type="date" class="manual-input" data-cte="${esc(r.refaturado)}" data-field="requestDate" value="${esc(toInputDate(manual.requestDate || ''))}"></td>
        <td><select class="manual-input" data-cte="${esc(r.refaturado)}" data-field="reason">${options.replace(`value="${esc(motivo)}"`,`value="${esc(motivo)}" selected`)}</select></td>
        <td><input class="manual-input" data-cte="${esc(r.refaturado)}" data-field="detail" value="${esc(manual.detail || '')}" placeholder="Detalhar"></td>
        <td><select class="manual-input" data-cte="${esc(r.refaturado)}" data-field="audit"><option value="nao" ${manual.audit === 'nao' || !manual.audit ? 'selected' : ''}>Não</option><option value="sim" ${manual.audit === 'sim' ? 'selected' : ''}>Sim</option></select></td>
        <td><button class="btn small btn-save-manual" data-cte="${esc(r.refaturado)}">Salvar</button></td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8" class="center muted">Nenhum refaturado identificado</td></tr>`;
}


function renderTopInfo(){
  const totalDebito = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  document.getElementById('chipSheets').textContent = `${state.sheets.length} abas`;
  document.getElementById('chipRef').textContent = `${state.refaturados.length} refaturados`;
  document.getElementById('chipSub').textContent = `${state.substitutos.length} substitutos`;
  const firstSector = allSectorNames()[0] || 'setor';
  document.getElementById('chipFat').textContent = `${state.setores.filter(s => s.setor === firstSector).length} ${firstSector.toLowerCase()}`;
  document.getElementById('chipTotal').textContent = fmtMoney(totalDebito);

  document.getElementById('subtitle').textContent = state.sheets.length
    ? `Excel carregado com ${state.sheets.length} aba(s). Refaturados: ${state.refaturados.length}. Substitutos: ${state.substitutos.length}.`
    : 'Importe o Excel para iniciar a leitura.';
}


function currentAnnualSummary(){
  const setores = setoresAggregate();
  const refaturado = state.setores.reduce((s,x)=>s+Number(x.debit||0),0);
  const substituto = state.substitutos.reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
  const total = refaturado + substituto;
  const sectors = {};
  setores.forEach(s => { sectors[s.setor] = { refaturado:s.refValue, substituto:s.subValue, total:s.totalValue }; });
  const produtividade = (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0);
  return { refaturado, substituto, total, produtividade, sectors };
}
function monthLabel(key){ const [y,m]=key.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${names[Number(m)-1]||m}/${y}`; }
function saveCurrentMonthToAnnual(){
  if(!state.sheets.length){ alert('Importe um Excel antes.'); return; }
  const month = document.getElementById('annualMonth').value;
  const year = document.getElementById('annualYear').value || new Date().getFullYear();
  const key = `${year}-${month}`;
  state.annual[key] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
  writeStorage('painel_ref_annual_v32', state.annual);
  refreshMonthViewSelect();
  renderAnnualView();
  if(AUTO_SYNC_ON_SAVE) syncSupabase().catch(console.error);
  alert('Mês salvo na base anual.');
}
function saveCurrentProdMonth(){
  if(!(state.prodRows || []).length){ alert('Importe um Excel de produtividade antes.'); return; }
  const month = document.getElementById('prodMonth').value;
  const year = document.getElementById('prodYear').value || new Date().getFullYear();
  const key = `${year}-${month}`;
  const docs = (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0);
  state.annualProd[key] = { documentos: docs, rows: JSON.parse(JSON.stringify(state.prodRows || [])) };
  writeStorage('painel_ref_annual_prod_v36', state.annualProd);
  renderAnnualView();
  alert('Documentos do mês salvos na base anual.');
}
function renderAnnualView(){
  const keys = Object.keys(state.annual).sort();
  const labels = keys.map(monthLabel);
  const ref = keys.map(k => Number(state.annual[k].refaturado||0));
  const sub = keys.map(k => Number(state.annual[k].substituto||0));
  const tot = keys.map(k => Number(state.annual[k].total||0));
  destroyChart('chartAnnualTotals');
  const ctx1 = document.getElementById('chartAnnualTotals');
  if(ctx1){
    state.charts.chartAnnualTotals = new Chart(ctx1,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:ref},{label:'Substituto', data:sub},{label:'Total', data:tot}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
  }
  const select = document.getElementById('annualSectorSelect');
  if(select){
    const sectorNames = Array.from(new Set(keys.flatMap(k => Object.keys(state.annual[k].sectors || {})))).sort();
    const cur = select.value;
    select.innerHTML = sectorNames.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(sectorNames.includes(cur)) select.value = cur;
    const sector = select.value || sectorNames[0] || '';
    const sref = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).refaturado||0));
    const ssub = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).substituto||0));
    const stot = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).total||0));
    destroyChart('chartAnnualSector');
    const ctx2 = document.getElementById('chartAnnualSector');
    if(ctx2){
      state.charts.chartAnnualSector = new Chart(ctx2,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:sref},{label:'Substituto', data:ssub},{label:'Total', data:stot}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
    }
  }
  const prod = keys.map(k => Number((state.annualProd[k]||{}).documentos||0));
  destroyChart('chartAnnualProd');
  const ctx3 = document.getElementById('chartAnnualProd');
  if(ctx3){
    state.charts.chartAnnualProd = new Chart(ctx3,{ type:'bar', data:{ labels, datasets:[{label:'Documentos', data:prod}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
  }
  const tbody = document.getElementById('tbodyAnnualMonths');
  if(tbody){
    tbody.innerHTML = keys.length ? keys.map(k => `<tr><td>${monthLabel(k)}</td><td>${fmtMoney(state.annual[k].refaturado)}</td><td>${fmtMoney(state.annual[k].substituto)}</td><td>${fmtMoney(state.annual[k].total)}</td><td>${Number((state.annualProd[k]||{}).documentos||0)}</td><td style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn small btn-load-annual" data-key="${esc(k)}">Consultar</button><button class="btn small btn-remove-annual" data-key="${esc(k)}">Remover</button></td></tr>`).join('') : `<tr><td colspan="6" class="center muted">Nenhum mês salvo</td></tr>`;
  }
}


function renderPerformanceView(){
  const rows = aggregateProd().filter(x => x.totalDocs > 0 || x.erros > 0);
  const select = document.getElementById('performanceUserSelect');
  if(select){
    const cur = select.value || 'TODOS';
    select.innerHTML = '<option value="TODOS">Todos</option>' + rows.map(x => `<option value="${esc(x.usuario)}">${esc(x.usuario)}</option>`).join('');
    select.value = rows.some(x => x.usuario === cur) || cur === 'TODOS' ? cur : 'TODOS';
  }
  const selectedUser = select?.value || 'TODOS';
  const selected = selectedUser === 'TODOS' ? null : (rows.find(x => x.usuario === selectedUser) || null);
  const sourceRows = selected ? [selected] : rows;

  makeBarChart('chartProdUsuarioMes', sourceRows.map(x => x.usuario), sourceRows.map(x => x.totalDocs), true, 'Quantidade');
  const docs = ['ctrc','manifesto','nf.fat','ost'];
  if(selected){
    makeBarChart('chartProdTiposMes', docs.map(d => d.toUpperCase()), docs.map(d => Number(selected[d]||0)), false, 'Quantidade');
  } else {
    const sums = Object.fromEntries(docs.map(d => [d,0]));
    rows.forEach(r => docs.forEach(d => sums[d] += Number(r[d]||0)));
    makeBarChart('chartProdTiposMes', docs.map(d => d.toUpperCase()), docs.map(d => sums[d]), false, 'Quantidade');
  }

  destroyChart('chartPerformance');
  const ctx = document.getElementById('chartPerformance');
  if(ctx){
    state.charts.chartPerformance = new Chart(ctx, {
      type:'bar',
      data:{
        labels: sourceRows.map(x => x.usuario),
        datasets:[{
          label:'Performance',
          data: sourceRows.map(x => Number(x.performance || 0)),
          backgroundColor: sourceRows.map(x => {
            const p = Number(x.performance || 0);
            if(p >= 99.51) return '#12c97a';
            if(p >= 97) return '#f4c20d';
            return '#ef4444';
          })
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        layout:{ padding:{ right: 90 } },
        plugins:{
          legend:{ labels:{ color:'#fff' } },
          tooltip:{ callbacks:{ label:(ctx)=> `Performance: ${Number(ctx.raw).toFixed(2)}%` } },
          datalabels:{
            color:'#ffffff', backgroundColor:'rgba(8,16,29,.88)', borderRadius:4,
            padding:{top:2,right:4,bottom:2,left:4}, anchor:'end', align:'right', offset:8,
            clamp:false, clip:false, formatter:v => `${Number(v).toFixed(2)}%`, display:true
          }
        },
        scales:{
          x:{ min:90, max:100, ticks:{ color:'#cfe0ff', callback:(v)=> `${v}%` }, grid:{ color:'rgba(255,255,255,.05)' } },
          y:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } }
        }
      }
    });
  }

  const counts = { otimo:0, regular:0, ruim:0 };
  sourceRows.forEach(x => {
    const p = Number(x.performance || 0);
    if(p >= 99.51) counts.otimo += 1;
    else if(p >= 97) counts.regular += 1;
    else counts.ruim += 1;
  });
  destroyChart('chartPerformancePie');
  const ctx2 = document.getElementById('chartPerformancePie');
  if(ctx2){
    state.charts.chartPerformancePie = new Chart(ctx2, {
      type:'doughnut',
      data:{
        labels:['ÓTIMO 99,51 – 100','REGULAR 97 – 99,50','RUIM 90 – 96,9'],
        datasets:[{ data:[counts.otimo, counts.regular, counts.ruim], backgroundColor:['#12c97a','#f4c20d','#ef4444'] }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ color:'#fff', formatter:v => v || '', display:true } }
      }
    });
  }
}function renderAnnualView(){
  const keys = Object.keys(state.annual).sort();
  const labels = keys.map(monthLabel);
  const ref = keys.map(k => Number(state.annual[k].refaturado||0));
  const sub = keys.map(k => Number(state.annual[k].substituto||0));
  const tot = keys.map(k => Number(state.annual[k].total||0));
  destroyChart('chartAnnualTotals');
  const ctx1 = document.getElementById('chartAnnualTotals');
  if(ctx1){
    state.charts.chartAnnualTotals = new Chart(ctx1,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:ref},{label:'Substituto', data:sub},{label:'Total', data:tot}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
  }
  const select = document.getElementById('annualSectorSelect');
  if(select){
    const sectorNames = Array.from(new Set(keys.flatMap(k => Object.keys(state.annual[k].sectors || {})))).sort();
    const cur = select.value;
    select.innerHTML = sectorNames.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(sectorNames.includes(cur)) select.value = cur;
    const sector = select.value || sectorNames[0] || '';
    const sref = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).refaturado||0));
    const ssub = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).substituto||0));
    const stot = keys.map(k => Number(((state.annual[k].sectors||{})[sector]||{}).total||0));
    destroyChart('chartAnnualSector');
    const ctx2 = document.getElementById('chartAnnualSector');
    if(ctx2){
      state.charts.chartAnnualSector = new Chart(ctx2,{ type:'bar', data:{ labels, datasets:[{label:'Refaturado', data:sref},{label:'Substituto', data:ssub},{label:'Total', data:stot}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
    }
  }
  const prod = keys.map(k => Number((state.annualProd[k]||{}).documentos||0));
  destroyChart('chartAnnualProd');
  const ctx3 = document.getElementById('chartAnnualProd');
  if(ctx3){
    state.charts.chartAnnualProd = new Chart(ctx3,{ type:'bar', data:{ labels, datasets:[{label:'Documentos', data:prod}] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ display:false } }, scales:{ x:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'#cfe0ff'}, grid:{color:'rgba(255,255,255,.05)'} } } } });
  }
  const tbody = document.getElementById('tbodyAnnualMonths');
  if(tbody){
    tbody.innerHTML = keys.length ? keys.map(k => `<tr><td>${monthLabel(k)}</td><td>${fmtMoney(state.annual[k].refaturado)}</td><td>${fmtMoney(state.annual[k].substituto)}</td><td>${fmtMoney(state.annual[k].total)}</td><td>${Number((state.annualProd[k]||{}).documentos||0)}</td><td style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn small btn-load-annual" data-key="${esc(k)}">Consultar</button><button class="btn small btn-remove-annual" data-key="${esc(k)}">Remover</button></td></tr>`).join('') : `<tr><td colspan="6" class="center muted">Nenhum mês salvo</td></tr>`;
  }
}


function renderPerformanceView(){
  const rows = aggregateProd();
  const select = document.getElementById('performanceUserSelect');
  if(select){
    const cur = select.value;
    select.innerHTML = rows.filter(x => x.totalDocs > 0 || x.erros > 0).map(x => `<option value="${esc(x.usuario)}">${esc(x.usuario)}</option>`).join('');
    if(rows.some(x => x.usuario === cur)) select.value = cur;
  }
  const selectedUser = select?.value || (rows.find(x => x.totalDocs > 0 || x.erros > 0)?.usuario || rows[0]?.usuario || '');
  const selected = rows.find(x => x.usuario === selectedUser) || null;

  makeBarChart('chartProdUsuarioMes', selected ? [selected.usuario] : ['Sem dados'], [selected ? selected.totalDocs : 0], true, 'Quantidade');
  const docs = ['ctrc','manifesto','nf.fat','ost'];
  makeBarChart('chartProdTiposMes', docs.map(x => x.toUpperCase()), selected ? docs.map(t => Number(selected[t]||0)) : [0,0,0,0], false, 'Quantidade');

  const perfRows = rows.filter(x => x.performance !== null && x.totalDocs > 0).sort((a,b) => b.performance - a.performance);
  destroyChart('chartPerformance');
  const ctxPerf = document.getElementById('chartPerformance');
  if(ctxPerf){
    state.charts.chartPerformance = new Chart(ctxPerf, {
      type:'bar',
      data:{
        labels: perfRows.map(x => x.usuario),
        datasets:[{
          label:'Performance',
          data: perfRows.map(x => x.performance),
          backgroundColor: perfRows.map(x => x.performance >= 99 ? 'rgba(34,197,94,0.85)' : (x.performance >= 98 ? 'rgba(245,158,11,0.85)' : 'rgba(239,68,68,0.85)')),
          borderWidth:1
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ left:6, right:60 } },
        plugins:{
          legend:{ labels:{ color:'#fff' } },
          tooltip:{ callbacks:{ label: ctx => `${Number(ctx.raw).toFixed(2)}%` } },
          datalabels:{ color:'#fff', anchor:'end', align:'right', clamp:false, clip:false, offset:8, formatter:v => `${Number(v).toFixed(2)}%`, backgroundColor:'rgba(8,16,29,0.78)', borderRadius:4, padding:{left:6,right:6,top:2,bottom:2} }
        },
        scales:{
          x:{ ticks:{ color:'#cfe0ff', callback:v => `${v}%` }, grid:{ color:'rgba(255,255,255,.05)' } },
          y:{ ticks:{ color:'#cfe0ff', callback:(v,idx) => { const label = perfRows[idx]?.usuario || ''; return label.length > 18 ? label.slice(0,18)+'…' : label; } }, grid:{ color:'rgba(255,255,255,.05)' } }
        }
      }
    });
  }

  destroyChart('chartPerformancePie');
  const ctxPie = document.getElementById('chartPerformancePie');
  if(ctxPie){
    const otimo = perfRows.filter(x => x.performance >= 99).length;
    const regular = perfRows.filter(x => x.performance >= 98 && x.performance < 99).length;
    const baixo = perfRows.filter(x => x.performance < 98).length;
    state.charts.chartPerformancePie = new Chart(ctxPie, {
      type:'pie',
      data:{ labels:['Ótimo','Regular','Baixo'], datasets:[{ data:[otimo, regular, baixo], backgroundColor:['rgba(34,197,94,0.85)','rgba(245,158,11,0.85)','rgba(239,68,68,0.85)'] }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ color:'#fff', formatter:v => v || '' } } }
    });
  }
}

function renderAll(){
  renderCurrentView();
}

function bindMenu(){
  document.querySelectorAll('.menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.view);
      if(target) target.classList.add('active');
      renderCurrentView();
    });
  });
}
function bindFilters(){
  ['filterSearch','filterTipo','filterStatus','filterSerie80'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderRecordsTable);
    el.addEventListener('change', renderRecordsTable);
  });
}
function bindManualSave(){
  document.addEventListener('click', async function(e){
    const btn = e.target.closest('.btn-save-manual');
    if(!btn) return;
    const cte = btn.getAttribute('data-cte');
    const fields = Array.from(document.querySelectorAll(`.manual-input[data-cte="${cte}"]`));
    const payload = {};
    fields.forEach(field => { payload[field.getAttribute('data-field')] = field.value; });

    saveManual(cte, payload);
    const result = await saveManualToSupabase(cte, payload);
    renderAll();

    if(result.ok){
      alert('Cadastro salvo com sucesso.');
    }else{
      alert('Salvou localmente, mas não conseguiu salvar na Supabase: ' + result.message);
    }
  });
}

async function clearAnnualMonthEverywhere(key){
  if(!key || !/^\d{4}-\d{2}$/.test(key)) return false;

  const [ano, mes] = key.split('-');
  const monthSelect = document.getElementById('monthViewSelect');
  const isCurrentView = state.selectedMonthKey === key || (monthSelect && monthSelect.value === key);

  // 1) Remove do armazenamento local anual.
  delete state.annual[key];
  delete state.annualProd[key];
  writeStorage('painel_ref_annual_v32', state.annual);
  writeStorage('painel_ref_annual_prod_v36', state.annualProd);

  // 2) Remove da Supabase também; caso contrário o mês volta após F5/consulta.
  if(ensureSupabaseConnected()){
    const refDel = await state.supabase
      .from('refaturamento_importado')
      .delete()
      .eq('ano', ano)
      .eq('mes', mes);

    if(refDel.error){
      console.error(refDel.error);
      alert('Erro ao apagar refaturamento na Supabase: ' + refDel.error.message);
      return false;
    }

    const prodDel = await state.supabase
      .from('produtividade_usuarios')
      .delete()
      .eq('ano', ano)
      .eq('mes', mes);

    if(prodDel.error){
      console.error(prodDel.error);
      alert('Erro ao apagar produtividade na Supabase: ' + prodDel.error.message);
      return false;
    }

    const mesDel = await state.supabase
      .from('meses_importados')
      .delete()
      .eq('ano', ano)
      .eq('mes', mes);

    if(mesDel.error){
      console.error(mesDel.error);
      alert('Erro ao apagar mês importado na Supabase: ' + mesDel.error.message);
      return false;
    }
  }

  // 3) Se o mês removido estiver carregado na tela, limpa a visão atual.
  if(isCurrentView){
    state.selectedMonthKey = '';
    state.sheets = [];
    state.refaturados = [];
    state.substitutos = [];
    state.setores = [];
    state.prodRows = [];
    state.live = { sheets: [], substitutos: [], refaturados: [], setores: [], prodRows: [] };
    if(monthSelect) monthSelect.value = '';
  }

  state.remoteMonths = (state.remoteMonths || []).filter(k => k !== key);
  refreshMonthViewSelect();
  renderAll();
  await fetchRemoteMonthKeys();
  refreshMonthViewSelect();
  renderAll();
  return true;
}

function bindConfigActions(){
  document.getElementById('btnExportJson').addEventListener('click', function(){
    const blob = new Blob([JSON.stringify(state.manual, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cadastro_manual_baixas.json'; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnClearManual').addEventListener('click', function(){
    if(!confirm('Limpar todo o cadastro manual?')) return;
    state.manual = {};
    writeStorage('painel_ref_manual_v30', state.manual);
    renderAll();
  });

  document.getElementById('btnSaveReasons').addEventListener('click', function(){
    const rows = document.getElementById('reasonBox').value.split('\n').map(s=>s.trim()).filter(Boolean);
    state.reasons = rows.length ? rows : DEFAULT_REASONS.slice();
    writeStorage('painel_ref_reasons_v30', state.reasons);
    renderAll();
  });

  document.getElementById('btnResetReasons').addEventListener('click', function(){
    state.reasons = DEFAULT_REASONS.slice();
    writeStorage('painel_ref_reasons_v30', state.reasons);
    document.getElementById('reasonBox').value = state.reasons.join('\n');
    renderAll();
  });
  document.getElementById('btnSaveCurrentMonth')?.addEventListener('click', saveCurrentMonthToAnnual);
  document.getElementById('btnSaveProdMonth')?.addEventListener('click', saveCurrentProdMonth);
  document.getElementById('btnClearAnnual')?.addEventListener('click', async function(){
    const month = String(document.getElementById('annualMonth')?.value || '').padStart(2,'0');
    const year = String(document.getElementById('annualYear')?.value || '').trim();
    const key = /^\d{4}$/.test(year) && /^\d{2}$/.test(month) ? `${year}-${month}` : '';

    if(!key){
      alert('Selecione um mês e ano válidos para limpar.');
      return;
    }

    if(!confirm(`Limpar somente ${monthLabel(key)} da base anual?`)) return;

    const ok = await clearAnnualMonthEverywhere(key);
    if(ok){
      alert(`${monthLabel(key)} removido da base anual.`);
    }
  });
  document.getElementById('annualSectorSelect')?.addEventListener('change', renderAnnualView);
  document.getElementById('btnApplyMonthView')?.addEventListener('click', applyMonthViewSelection);
  document.getElementById('monthViewSelect')?.addEventListener('change', applyMonthViewSelection);
  document.getElementById('performanceUserSelect')?.addEventListener('change', renderPerformanceView);
  document.getElementById('btnSyncSupabase')?.addEventListener('click', syncSupabase);
  document.getElementById('btnReplaceMonthSupabase')?.addEventListener('click', replaceSelectedMonthInSupabase);
  document.addEventListener('click', function(e){
    const loadBtn = e.target.closest('.btn-load-annual');
    if(loadBtn){
      const select = document.getElementById('monthViewSelect');
      if(select){ select.value = loadBtn.dataset.key; }
      applyMonthViewSelection();
      return;
    }
    const btn = e.target.closest('[data-remove-key], .btn-remove-annual');
    if(!btn) return;

    const key = btn.getAttribute('data-remove-key') || btn.dataset.key;
    if(!key) return;

    if(!confirm(`Remover ${monthLabel(key)} da base anual?`)) return;
    clearAnnualMonthEverywhere(key);
  });
}
function logBox(text){ document.getElementById('logBox').value = text; }
function bindExcelImport(){
  document.getElementById('excelUpload').addEventListener('change', function(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      try{
        const workbook = XLSX.read(evt.target.result, { type:'binary', cellDates:true });
        parseWorkbook(workbook);
        state.live = cloneMonthlySnapshot();
        state.__ultimoExcelRefaturamento = cloneMonthlySnapshot();
        state.__ultimoExcelRefaturamentoEm = new Date().toISOString();
        document.getElementById('importMsg').innerHTML = `
          Excel importado com sucesso.<br>
          Abas encontradas: <strong>${state.sheets.length}</strong><br>
          Refaturados: <strong>${state.refaturados.length}</strong><br>
          Substitutos: <strong>${state.substitutos.length}</strong><br>
          Linhas de setor: <strong>${state.setores.length}</strong>
        `;
        logBox(
          'Abas encontradas:\n- ' + state.sheets.join('\n- ') +
          '\n\nRefaturados: ' + state.refaturados.length +
          '\nSubstitutos: ' + state.substitutos.length +
          '\nLinhas de setor: ' + state.setores.length
        );
        renderAll();
      }catch(err){
        console.error(err);
        document.getElementById('importMsg').textContent = 'Erro ao importar o Excel.';
        logBox('Erro ao importar: ' + err.message);
        alert('Erro ao importar o Excel. Veja o console.');
      }
    };
    reader.readAsBinaryString(file);
  });
}

function bindProdExcelImport(){
  document.getElementById('prodExcelUpload')?.addEventListener('change', function(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      try{
        const workbook = XLSX.read(evt.target.result, { type:'binary', cellDates:true });
        state.prodRows = parseProdWorkbook(workbook);
        state.live.prodRows = JSON.parse(JSON.stringify(state.prodRows));
        state.__ultimoExcelProdutividade = JSON.parse(JSON.stringify(state.prodRows || []));
        state.__ultimoExcelProdutividadeEm = new Date().toISOString();
        document.getElementById('prodImportMsg').textContent = `Excel de produtividade carregado. Registros: ${state.prodRows.length}`;
        renderAll();
      }catch(err){
        console.error(err);
        document.getElementById('prodImportMsg').textContent = 'Erro ao importar o Excel de produtividade.';
      }
    };
    reader.readAsBinaryString(file);
  });
}

async function bootstrap(){
  document.getElementById('reasonBox').value = state.reasons.join('\n');
  connectSupabase();
  await loadManualFromSupabase();
  renderAll();
  await fetchRemoteMonthKeys();
}
window.addEventListener('DOMContentLoaded', function(){
  bindMenu();
  bindFilters();
  bindManualSave();
  bindConfigActions();
  bindExcelImport();
  bindProdExcelImport();
  const permissoesRefaturamento = {
  admin: [
    "dashboard",
    "registros",
    "conciliacao",
    "motivos",
    "usuarios",
    "clientes",
    "setores",
    "performance",
    "anual",
    "cadastro",
    "config"
  ],
  operacional: [
    "dashboard",
    "registros",
    "conciliacao",
    "motivos",
    "usuarios",
    "clientes",
    "setores",
    "performance",
    "anual",
    "cadastro",
    "config"
  ],
  consulta: [
    "dashboard",
    "registros",
    "conciliacao",
    "motivos",
    "usuarios",
    "clientes",
    "setores",
    "performance",
    "anual"
  ]
};

const liberadas = permissoesRefaturamento[perfil] || [];

document.querySelectorAll("[data-view]").forEach(btn => {
  const view = btn.getAttribute("data-view");
  if (!liberadas.includes(view)) {
    btn.style.display = "none";
  }
});

const viewAtiva = document.querySelector(".view.active");
if (viewAtiva && !liberadas.includes(viewAtiva.id)) {
  const primeiraPermitida = liberadas[0];
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll("[data-view]").forEach(b => b.classList.remove("active"));

  const viewEl = document.getElementById(primeiraPermitida || "dashboard");
  const btnEl = document.querySelector(`[data-view="${primeiraPermitida || "dashboard"}"]`);

  if (viewEl) viewEl.classList.add("active");
  if (btnEl) btnEl.classList.add("active");
}
  bootstrap();
});



// --- v39 overrides ---
function getErroPorOperadorMap(){
  const map = new Map();
  (state.setores || []).forEach(s => {
    const setor = upper(s.setor || '');
    if(!setor.includes('FATURAMENTO')) return;
    const u = prodNorm(s.usuario || '');
    if(!u) return;
    const prev = map.get(u) || {
  qtdRef:0,
  qtdSub:0,
  qtdTotal:0,
  valorRef:0,
  valorSub:0,
  impacto:0
};

const valorRef = Number(s.debit || 0);
const valorSub = Number(s.freteSubstituto || 0);

if(valorRef > 0){
  prev.qtdRef++;
}

if(valorSub > 0){
  prev.qtdSub++;
}

prev.qtdTotal++;

prev.valorRef += valorRef;
prev.valorSub += valorSub;
prev.impacto += valorRef + valorSub;
    prev.qty += 1;
    prev.value += Number(s.debit || 0);
    map.set(u, prev);
  });
  (state.substitutos || []).forEach(s => {
    const sectors = parseReducedSectors(s.reduzido || '');
    if(!sectors.includes('FATURAMENTO')) return;
    const u = prodNorm(s.operadorOriginal || s.usuario || '');
    if(!u) return;
    const prev = map.get(u) || { qty:0, value:0 };
    map.set(u, prev);
  });
  return map;
}


function usuariosErroAggregate(){

  const map = new Map();
  const usados = new Set();

  (getUsuariosReasonDetailRows('TODOS') || []).forEach(r => {

    const user = prodNorm(r.usuario || '');
    if(!user) return;

    const tipo = String(r.tipo || '').toLowerCase().includes('sub')
      ? 'sub'
      : 'ref';

    const cte = String(r.cte || '').trim();
    const key = `${user}|${tipo}|${cte}`;

    if(usados.has(key)) return;
    usados.add(key);

    if(!map.has(user)){
      map.set(user,{
        user,
        qtdRef:0,
        qtdSub:0,
        qty:0,
        refaturado:0,
        substituto:0,
        total:0
      });
    }

    const item = map.get(user);
    const valor = Number(r.valor || 0);

    if(tipo === 'sub'){
      item.qtdSub += 1;
      item.substituto += valor;
    }else{
      item.qtdRef += 1;
      item.refaturado += valor;
    }

    item.qty = item.qtdRef + item.qtdSub;
    item.total = item.refaturado + item.substituto;

  });

  return Array.from(map.values()).sort((a,b)=>b.total-a.total);
}

function impactoTotal(v){
  return (
    Number(v.debit || 0) +
    Number(v.freteSubstituto || 0)
  );
}

function aggregateProd(){
  const map = new Map();
  TRACKED_USERS.forEach(u => map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, erroValor:0, performance:null, totalDocs:0 }));
  (state.prodRows || []).forEach(r => {
    const u = prodNorm(r.usuario); const t = normalizeDocType(r.tipo);
    if(!u || !DOC_TYPES.includes(t)) return;
    if(!map.has(u)) map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, erroValor:0, performance:null, totalDocs:0 });
    map.get(u)[t] = (map.get(u)[t] || 0) + Number(r.quantidade || 0);
  });
  const errMap = getErroPorOperadorMap();
  errMap.forEach((obj,u)=>{
    if(!map.has(u)) map.set(u, { usuario:u, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, erroValor:0, performance:null, totalDocs:0 });
    map.get(u).erros = Number(obj.qty||0);
    map.get(u).erroValor = Number(obj.value||0);
  });
  return Array.from(map.values()).map(x => {
    x.totalDocs = Number(x['ctrc']||0) + Number(x['manifesto']||0) + Number(x['nf.fat']||0) + Number(x['ost']||0);
    const base = Number(x['ctrc']||0) + Number(x['ost']||0);
    const perf = base ? (100 - ((Number(x.erros||0) * 100) / base)) : null;
    x.performance = perf === null ? null : Math.max(0, Math.min(100, perf));
    return x;
  });
}

function renderUsuariosView(){
  const users = usuariosErroAggregate().slice(0,10);
  makeBarChart('chartUsuariosErroQtd', users.map(x=>x.user), users.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuariosErroValor', users.map(x=>x.user), users.map(x=>x.total), true, 'Valor');
  document.getElementById('tbodyUsuarios').innerHTML = users.length
    ? users.map(x => `
<tr>
<td>${esc(x.user)}</td>
<td>${x.qtdRef || 0}</td>
<td>${x.qtdSub || 0}</td>
<td>${x.qty}</td>
<td>${fmtMoney(x.refaturado)}</td>
<td>${fmtMoney(x.substituto)}</td>
<td>${fmtMoney(x.total)}</td>
</tr>
`).join('')
    : `<tr><td colspan="7" class="center muted">Sem dados</td></tr>`;
}

function renderPerformanceView(){
  const rows = aggregateProd().filter(x => x.totalDocs > 0 || x.erros > 0);
  const select = document.getElementById('performanceUserSelect');
  let selectedUser = 'TODOS';
  if(select){
    const cur = select.value || 'TODOS';
    select.innerHTML = '<option value="TODOS">Todos</option>' + rows.map(x => `<option value="${esc(x.usuario)}">${esc(x.usuario)}</option>`).join('');
    if(cur !== 'TODOS' && rows.some(x => x.usuario === cur)) select.value = cur;
    else select.value = 'TODOS';
    selectedUser = select.value;
  }

  const sourceRows = selectedUser === 'TODOS'
    ? rows
    : rows.filter(x => x.usuario === selectedUser);

  makeBarChart('chartProdUsuarioMes', sourceRows.map(x => x.usuario), sourceRows.map(x => x.totalDocs), true, 'Quantidade');

  const docs = ['ctrc','manifesto','nf.fat','ost'];
  if(sourceRows.length === 1){
    const selected = sourceRows[0];
    makeBarChart('chartProdTiposMes', docs.map(d => d.toUpperCase()), docs.map(d => Number(selected[d]||0)), false, 'Quantidade');
  } else {
    const sums = Object.fromEntries(docs.map(d => [d,0]));
    sourceRows.forEach(r => docs.forEach(d => sums[d] += Number(r[d]||0)));
    makeBarChart('chartProdTiposMes', docs.map(d => d.toUpperCase()), docs.map(d => sums[d]), false, 'Quantidade');
  }

  const perfRows = sourceRows.filter(x => x.performance !== null && (x.totalDocs > 0 || x.erros > 0)).sort((a,b) => b.performance - a.performance);
  destroyChart('chartPerformance');
  const ctxPerf = document.getElementById('chartPerformance');
  if(ctxPerf){
    state.charts.chartPerformance = new Chart(ctxPerf, {
      type:'bar',
      data:{
        labels: perfRows.map(x => x.usuario),
        datasets:[{
          label:'Performance',
          data: perfRows.map(x => x.performance),
          backgroundColor: perfRows.map(x => x.performance >= 99.51 ? '#12c97a' : (x.performance >= 97 ? '#f4c20d' : '#ef4444')),
          borderWidth:1
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ left:6, right:60 } },
        plugins:{
          legend:{ labels:{ color:'#fff' } },
          tooltip:{ callbacks:{ label: ctx => `${Number(ctx.raw).toFixed(2)}%` } },
          datalabels:{ color:'#fff', anchor:'end', align:'right', clamp:false, clip:false, offset:8, formatter:v => `${Number(v).toFixed(2)}%`, backgroundColor:'rgba(8,16,29,0.78)', borderRadius:4, padding:{left:6,right:6,top:2,bottom:2} }
        },
        scales:{
          x:{ min:90, max:100, ticks:{ color:'#cfe0ff', callback:v => `${v}%` }, grid:{ color:'rgba(255,255,255,.05)' } },
          y:{ ticks:{ color:'#cfe0ff', callback:(v,idx) => { const label = perfRows[idx]?.usuario || ''; return label.length > 18 ? label.slice(0,18)+'…' : label; } }, grid:{ color:'rgba(255,255,255,.05)' } }
        }
      }
    });
  }

  destroyChart('chartPerformancePie');
  const ctxPie = document.getElementById('chartPerformancePie');
  if(ctxPie){
    let data, labels;
    if(perfRows.length === 1){
      const p = perfRows[0].performance;
      labels = ['ÓTIMO 99,51 – 100','REGULAR 97 – 99,50','RUIM 90 – 96,9'];
      data = [p >= 99.51 ? 1 : 0, p >= 97 && p < 99.51 ? 1 : 0, p < 97 ? 1 : 0];
    } else {
      const otimo = perfRows.filter(x => x.performance >= 99.51).length;
      const regular = perfRows.filter(x => x.performance >= 97 && x.performance < 99.51).length;
      const ruim = perfRows.filter(x => x.performance < 97).length;
      labels = ['ÓTIMO 99,51 – 100','REGULAR 97 – 99,50','RUIM 90 – 96,9'];
      data = [otimo, regular, ruim];
    }
    state.charts.chartPerformancePie = new Chart(ctxPie, {
      type:'doughnut',
      data:{ labels, datasets:[{ data, backgroundColor:['#12c97a','#f4c20d','#ef4444'] }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' } }, datalabels:{ color:'#fff', formatter:v => v || '', display:true } } }
    });
  }
}



// --- v8 sector-locked overrides ---
function refaturadoTotalBySetor(){
  return (state.setores || []).reduce((s,x) => s + Number(x.debit || 0), 0);
}
function substitutoTotalSafe(){
  return (state.substitutos || []).reduce((s,x) => s + Number(x.freteSubstituto || 0), 0);
}
function annualSummaryFromSnapshot(snapshot){
  const setores = (snapshot?.setores || []).map(s => ({...s, debit:Number(s.debit||0)}));
  const subs = (snapshot?.substitutos || []).map(s => ({...s, freteSubstituto:Number(s.freteSubstituto||0)}));
  const prodRows = snapshot?.prodRows || [];
  return {
    refaturado: setores.reduce((s,x)=>s+Number(x.debit||0),0),
    substituto: subs.reduce((s,x)=>s+Number(x.freteSubstituto||0),0),
    total: setores.reduce((s,x)=>s+Number(x.debit||0),0) + subs.reduce((s,x)=>s+Number(x.freteSubstituto||0),0),
    docs: prodRows.filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0)
  };
}
function currentAnnualSummary(){
  const refaturado = refaturadoTotalBySetor();
  const substituto = substitutoTotalSafe();
  const total = refaturado + substituto;
  const docs = (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0);
  const sectors = {};
  allSectorNames().forEach(name => { sectors[name] = { refaturado:0, substituto:0, total:0 }; });
  (state.setores || []).forEach(s => {
    const setor = s.setor || 'NÃO IDENTIFICADO';
    if(!sectors[setor]) sectors[setor] = { refaturado:0, substituto:0, total:0 };
    sectors[setor].refaturado += Number(s.debit || 0);
    sectors[setor].total += Number(s.debit || 0);
  });
  (state.substitutos || []).forEach(r => {
    const setores = parseReducedSectors(r.reduzido || '');
    if(!setores.length) return;
    const value = Number(r.freteSubstituto || 0) / setores.length;
    setores.forEach(setor => {
      if(!sectors[setor]) sectors[setor] = { refaturado:0, substituto:0, total:0 };
      sectors[setor].substituto += value;
      sectors[setor].total += value;
    });
  });
  return { refaturado, substituto, total, docs, sectors };
}
function syncCurrentAnnualEntrySectorLocked(key){
  if(!key) return;
  state.annual[key] = { ...(state.annual[key] || {}), ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
  writeStorage('painel_ref_annual_v32', state.annual);
}
function renderTopInfo(){
  const totalDebito = refaturadoTotalBySetor();
  document.getElementById('chipSheets').textContent = `${state.sheets.length} abas`;
  document.getElementById('chipRef').textContent = `${state.refaturados.length} refaturados`;
  document.getElementById('chipSub').textContent = `${state.substitutos.length} substitutos`;
  const fatCount = (state.setores || []).filter(s => upper(s.setor || '') === 'FATURAMENTO').length;
  document.getElementById('chipFat').textContent = `${fatCount} faturamento`;
  document.getElementById('chipTotal').textContent = fmtMoney(totalDebito);
  document.getElementById('subtitle').textContent = state.sheets.length
    ? `Excel carregado com ${state.sheets.length} aba(s). Refaturados: ${state.refaturados.length}. Substitutos: ${state.substitutos.length}.`
    : 'Importe o Excel para iniciar a leitura.';
}
function renderKPIs(){
  const totalRefaturado = refaturadoTotalBySetor();
  const totalSub = substitutoTotalSafe();
  const totalGeral = totalRefaturado + totalSub;
  const badMonth = state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length;
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="label">Refaturado total</div><div class="value">${fmtMoney(totalRefaturado)}</div><div class="hint">Soma do campo Débito dos blocos FRETES REFATURADOS</div></div>
    <div class="kpi"><div class="label">Valor total</div><div class="value">${fmtMoney(totalGeral)}</div><div class="hint">Refaturado + substituto</div></div>
    <div class="kpi"><div class="label">Frete substituto total</div><div class="value">${fmtMoney(totalSub)}</div><div class="hint">Soma do campo FRETE_SUBSTITUTO</div></div>
    <div class="kpi"><div class="label">Mês diferente</div><div class="value">${badMonth}</div><div class="hint">Solicitação x baixa</div></div>
  `;
}
function renderSummaryBoxes(){
  if(!state.sheets.length){
    document.getElementById('resumoBox').textContent = 'Nenhum arquivo importado ainda.';
    document.getElementById('alertasBox').textContent = 'Sem análise enquanto nenhum arquivo foi importado.';
    const tbody = document.getElementById('tbodyDashSetor');
    if(tbody) tbody.innerHTML = `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
    return;
  }
  const totalRef = refaturadoTotalBySetor();
  const totalSub = substitutoTotalSafe();
  const totalGeral = totalRef + totalSub;
  document.getElementById('resumoBox').innerHTML = `
    Refaturado total: <strong>${fmtMoney(totalRef)}</strong><br>
    Valor total: <strong>${fmtMoney(totalGeral)}</strong><br>
    Frete substituto total: <strong>${fmtMoney(totalSub)}</strong><br>
    Fórmula: <strong>refaturado + substituto</strong>
  `;
  document.getElementById('alertasBox').innerHTML = `
    Série 80/81 sem solicitação: <strong>${state.refaturados.filter(r => !getManual(r.refaturado).requestDate).length}</strong><br>
    Baixas em mês diferente: <strong>${state.refaturados.filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length}</strong><br>
    Faturamento: <strong>${(state.setores || []).filter(s => upper(s.setor || '') === 'FATURAMENTO').length}</strong> linhas<br>
    Demais setores: <strong>${(state.setores || []).filter(s => upper(s.setor || '') !== 'FATURAMENTO').length}</strong> linhas
  `;
  const setores = setorDebitoRows();
  const tbody = document.getElementById('tbodyDashSetor');
  if(tbody){
    tbody.innerHTML = setores.length
      ? setores.map(x => `<tr><td>${esc(x.setor)}</td><td>${fmtMoney(x.valor)}</td></tr>`).join('')
      : `<tr><td colspan="2" class="center muted">Sem dados</td></tr>`;
  }
}
async function loadMonthFromSupabase(monthKey){
  if(!ensureSupabaseConnected()) return false;
  if(!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return false;
  const [ano, mes] = monthKey.split('-');
  const [{ data: refData, error: refError }, { data: prodData, error: prodError }] = await Promise.all([
    state.supabase.from('refaturamento_importado').select('*').eq('ano', ano).eq('mes', mes),
    state.supabase.from('produtividade_usuarios').select('*').eq('ano', ano).eq('mes', mes)
  ]);
  if(refError){ document.getElementById('syncStatus').textContent = 'Erro ao carregar refaturamento: ' + refError.message; return false; }
  if(prodError){ document.getElementById('syncStatus').textContent = 'Erro ao carregar produtividade: ' + prodError.message; return false; }
  const allRef = refData || [];
  const refRows = allRef.filter(r => r.tipo === 'refaturado');
  const subRows = allRef.filter(r => r.tipo === 'substituto');
  const setorRows = allRef.filter(r => r.tipo === 'setor');
  state.sheets = ['supabase'];
  state.refaturados = refRows.map(r => ({
    dataRefaturado: r.data_baixa || '', tomadorRefaturado: r.cliente || '', refaturado: r.documento || '',
    freteRefaturado: parseNumber(r.frete_refaturado || 0), dataOriginal: '', operadorOriginal: r.operador || r.usuario || '',
    tomadorOriginal: r.cliente || '', original: r.documento_original || r.original_doc || '', freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0, reduzido: sectorNormalize(r.reduzido || r.setor || ''), motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''), originalTail: (tailDigits(r.documento_original || r.original_doc || '') || '').replace(/^0+/,'') || '0',
    debit: parseNumber(r.debito || 0), userSetor: r.operador || r.usuario || '', setorLancamento: r.setor || ''
  }));
  state.substitutos = subRows.map(r => ({
    dataSubstituto: r.data_baixa || '', tomadorSubstituto: r.cliente || '', substituto: r.documento || '',
    freteSubstituto: parseNumber(r.frete_substituto || 0), dataOriginal: '', operadorOriginal: r.operador || r.usuario || '',
    tomadorOriginal: r.cliente || '', original: r.documento_original || r.original_doc || '', freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0, reduzido: sectorNormalize(r.reduzido || r.setor || ''), motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''), originalTail: (tailDigits(r.documento_original || r.original_doc || '') || '').replace(/^0+/,'') || '0',

userSetor: r.operador || r.usuario || '',
setorLancamento: r.setor || '',

debit: 0
  }));
  state.setores = setorRows.map(r => ({
    data: '', docto: '', cliente: r.cliente || '', debit: parseNumber(r.debito || 0),
    documentos: docTokens(r.documento_original || r.original_doc || ''), usuario: r.operador || r.usuario || '',
    setor: r.setor || 'NÃO IDENTIFICADO', clientGroup: clientGroup(r.cliente || '')
  }));
  state.prodRows = [];
  (prodData || []).forEach(r => {
    const usuario = prodNorm(r.operador || r.usuario || '');
    const push = (tipo, quantidade) => { const q = Number(quantidade || 0); if(q > 0) state.prodRows.push({ usuario, tipo, quantidade:q }); };
    push('ctrc', r.ctrc); push('manifesto', r.manifesto); push('ost', r.ost); push('nf.fat', r.nf_fat);
  });
  state.selectedMonthKey = monthKey;
  const snapshot = cloneMonthlySnapshot();
  state.annual[monthKey] = { ...currentAnnualSummary(), snapshot };
  writeStorage('painel_ref_annual_v32', state.annual);
  const sel = document.getElementById('monthViewSelect'); if(sel) sel.value = monthKey;
  document.getElementById('syncStatus').textContent = `Mês ${mes}/${ano} carregado da Supabase.`;
  renderAll();
  return true;
}
async function applyMonthViewSelection(){
  const select = document.getElementById('monthViewSelect');
  if(!select) return;
  const key = select.value || '';
  if(!key){
    state.selectedMonthKey = '';
    applySnapshot(state.live);
    renderAll();
    return;
  }
  const remoteKeys = await fetchRemoteMonthKeys();
  if(remoteKeys.includes(key)){
    await loadMonthFromSupabase(key);
    return;
  }
  const entry = state.annual[key];
  if(entry && entry.snapshot){
    state.selectedMonthKey = key;
    applySnapshot(entry.snapshot);
    syncCurrentAnnualEntrySectorLocked(key);
    renderAll();
    return;
  }
  alert('Esse mês não está salvo localmente e não foi possível carregar da Supabase.');
}
function renderAnnualView(){
  const sectorSelect = document.getElementById('annualSectorSelect');
  const sectorNames = Array.from(new Set(Object.values(state.annual || {}).flatMap(entry => Object.keys(entry.sectors || {})))).sort();
  if(sectorSelect){
    const cur = sectorSelect.value || '';
    sectorSelect.innerHTML = '<option value="">Todos</option>' + sectorNames.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(cur && sectorNames.includes(cur)) sectorSelect.value = cur;
  }
  const selectedSector = sectorSelect?.value || '';
  const keys = Object.keys(state.annual).sort();
  const normalized = keys.map(key => {
    const entry = state.annual[key] || {};
    const calc = entry.snapshot ? annualSummaryFromSnapshot(entry.snapshot) : {
      refaturado:Number(entry.refaturado||0), substituto:Number(entry.substituto||0), total:Number(entry.total||0), docs:Number(entry.produtividade || entry.docs || 0)
    };
    const sectors = entry.snapshot ? (function(){
      const fakeState = { setores: entry.snapshot.setores || [], substitutos: entry.snapshot.substitutos || [] };
      const map = {};
      (fakeState.setores || []).forEach(s => { const setor = s.setor || 'NÃO IDENTIFICADO'; if(!map[setor]) map[setor] = { refaturado:0, substituto:0, total:0 }; map[setor].refaturado += Number(s.debit||0); map[setor].total += Number(s.debit||0); });
      (fakeState.substitutos || []).forEach(r => { const setores = parseReducedSectors(r.reduzido || ''); if(!setores.length) return; const val = Number(r.freteSubstituto||0)/setores.length; setores.forEach(setor => { if(!map[setor]) map[setor] = { refaturado:0, substituto:0, total:0 }; map[setor].substituto += val; map[setor].total += val; }); });
      return map;
    })() : (entry.sectors || {});
    const docsCorretos = Number(
  (state.annualProd?.[key]?.documentos) ??
  calc.produtividade ??
  calc.docs ??
  0
);

return { key, ...calc, docs: docsCorretos, sectors };
  });
  const labels = normalized.map(x => monthLabel(x.key));
  const totalAnualData = normalized.map(x => Number(x.total || 0));

let totalSetorData = normalized.map(x => Number(x.total || 0));

if(selectedSector){
  totalSetorData = normalized.map(x =>
    Number(x.sectors?.[selectedSector]?.total || 0)
  );
}

destroyChart('chartAnnualTotals');

const ctxAnnual = document.getElementById('chartAnnualTotals');

if(ctxAnnual){
  state.charts.chartAnnualTotals = new Chart(ctxAnnual, {
    type:'line',
data:{
  labels,
  datasets:[
    {
      label:'Total',
      data: totalAnualData,
      tension:0.35,
      fill:false
    },
    {
      label:'Refaturado',
      data: normalized.map(x => Number(x.refaturado || 0)),
      tension:0.35,
      fill:false
    },
    {
      label:'Substituto',
      data: normalized.map(x => Number(x.substituto || 0)),
      tension:0.35,
      fill:false
    }
  ]
},
options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#fff' } },
        datalabels:{
          color:'#fff',
          align:'top',
          anchor:'end',
          formatter:v => fmtMoney(v),
          display:true
        }
      },
      scales:{
        x:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } },
        y:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } }
      }
    }
  });
}
makeBarChart('chartAnnualSector', labels, totalSetorData, false, 'Valor');
  makeBarChart('chartAnnualProd', labels, normalized.map(x => Number(x.docs || 0)), false, 'Quantidade');
  const tbody = document.getElementById('tbodyAnnualMonths');
  if(tbody){
    tbody.innerHTML = normalized.length ? normalized.map(x => `
      <tr>
        <td>${esc(monthLabel(x.key))}</td>
        <td>${fmtMoney(x.refaturado)}</td>
        <td>${fmtMoney(x.substituto)}</td>
        <td>${fmtMoney(x.total)}</td>
        <td>${Number(x.docs || 0)}</td>
        <td><button class="btn small secondary" data-key="${esc(x.key)}">Consultar</button> <button class="btn small secondary" data-remove-key="${esc(x.key)}">Remover</button></td>
      </tr>`).join('') : `<tr><td colspan="6" class="center muted">Nenhum mês salvo</td></tr>`;
  }
}




function getUsuariosReasonDetailRows(selectedUser){

  const refRows = (state.refaturados || []).filter(r => {
    const user = prodNorm(r.userSetor || r.operadorOriginal || '');
    if(!user) return false;

    const setores = new Set([
      upper(r.setorLancamento || ''),
      ...parseReducedSectors(r.reduzido || '').map(x => upper(x))
    ]);

    if(!setores.has('FATURAMENTO')) return false;
    if(selectedUser && selectedUser !== 'TODOS' && user !== selectedUser) return false;

    return true;
  }).map(r => ({
    tipo: 'Refaturado',
    cte: String(r.refaturado || '').trim(),
    cliente: String(r.tomadorRefaturado || r.tomadorOriginal || '').trim(),
    usuario: prodNorm(r.userSetor || r.operadorOriginal || ''),
    motivo: motivoFinal(r) || 'Sem preenchimento',
    valor: Number(r.debit || r.freteRefaturado || 0),
    setor: String(r.setorLancamento || r.reduzido || '').trim() || 'FATURAMENTO'
  }));

  const subRows = (state.substitutos || []).filter(r => {
    const user = prodNorm(r.userSetor || r.operadorOriginal || '');
    if(!user) return false;

    const setores = parseReducedSectors(r.reduzido || r.setorLancamento || '').map(x => upper(x));

    if(!setores.includes('FATURAMENTO')) return false;
    if(selectedUser && selectedUser !== 'TODOS' && user !== selectedUser) return false;

    return true;
  }).map(r => ({
    tipo: 'Substituto',
    cte: String(r.substituto || '').trim(),
    cliente: String(r.tomadorSubstituto || r.tomadorOriginal || '').trim(),
    usuario: prodNorm(r.userSetor || r.operadorOriginal || ''),
    motivo: inferReasonFromText(r.motivoBaixa) || r.motivoBaixa || 'Sem preenchimento',
    valor: Number(r.freteSubstituto || 0),
    setor: String(r.reduzido || r.setorLancamento || '').trim() || 'FATURAMENTO'
  }));

  const rowsMap = new Map();

[...refRows, ...subRows].forEach(r => {
  const key = [
    r.usuario,
    r.tipo,
    r.cte
  ].join('|');

  if(!rowsMap.has(key)){
    rowsMap.set(key, r);
  }
});

const rows = Array.from(rowsMap.values());

rows.sort((a,b) =>
    b.valor - a.valor ||
    a.tipo.localeCompare(b.tipo) ||
    a.motivo.localeCompare(b.motivo) ||
    a.cte.localeCompare(b.cte)
  );

  return rows;
}

function aggregateUserReasons(rows){
  const map = new Map();
  rows.forEach(r => {
    const key = r.motivo || 'Sem preenchimento';
    if(!map.has(key)) map.set(key, { motivo:key, qty:0, value:0 });
    const item = map.get(key);
    item.qty += 1;
    item.value += Number(r.valor || 0);
  });
  return Array.from(map.values()).sort((a,b) => b.qty - a.qty || b.value - a.value || a.motivo.localeCompare(b.motivo));
}

function renderUsuariosView(){
  const users = usuariosErroAggregate().slice(0,10);
  makeBarChart('chartUsuariosErroQtd', users.map(x=>x.user), users.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuariosErroValor', users.map(x=>x.user), users.map(x=>x.total), true, 'Valor');
  document.getElementById('tbodyUsuarios').innerHTML = users.length
    ? users.map(x => `
<tr>
<td>${esc(x.user)}</td>
<td>${x.qtdRef || 0}</td>
<td>${x.qtdSub || 0}</td>
<td>${x.qty || 0}</td>
<td>${fmtMoney(x.refaturado || 0)}</td>
<td>${fmtMoney(x.substituto || 0)}</td>
<td>${fmtMoney(x.total || 0)}</td>
</tr>
`).join('')
    : `<tr><td colspan="7" class="center muted">Sem dados</td></tr>`;

  const select = document.getElementById('usuariosReasonSelect');
  const allUsers = usuariosErroAggregate().map(x => x.user);
  let selectedUser = 'TODOS';
  if(select){
    const current = select.value || 'TODOS';
    select.innerHTML = '<option value="TODOS">Todos</option>' + allUsers.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    if(current !== 'TODOS' && allUsers.includes(current)) select.value = current;
    else select.value = 'TODOS';
    selectedUser = select.value;
  }

  const detailRows = getUsuariosReasonDetailRows(selectedUser);
  const reasonAgg = aggregateUserReasons(detailRows).slice(0,12);
  makeBarChart('chartUsuarioMotivosQtd', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuarioMotivosValor', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.value), true, 'Valor');

  document.getElementById('tbodyUsuariosMotivos').innerHTML = detailRows.length
    ? detailRows.map(r => `<tr><td><strong>${esc(r.cte)}</strong></td><td>${esc(r.cliente || '-')}</td><td>${esc(r.usuario)}</td><td>${esc(r.motivo)}</td><td>${fmtMoney(r.valor)}</td><td>${esc(r.setor)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados para o usuário selecionado</td></tr>`;
}

function getSetorReasonDetailRows(selectedSetor){
  const rows = (state.refaturados || []).flatMap(r => {
    const setores = Array.from(new Set([
      upper(r.setorLancamento || ''),
      ...parseReducedSectors(r.reduzido || '').map(x => upper(x))
    ].filter(Boolean)));
    if(!setores.length) return [];
    const motivo = motivoFinal(r) || 'Sem preenchimento';
    const valorBase = Number(r.debit || 0);
    const valorPorSetor = setores.length ? (valorBase / setores.length) : valorBase;
    return setores
      .filter(setor => !selectedSetor || selectedSetor === 'TODOS' || setor === selectedSetor)
      .map(setor => ({
        cte: String(r.refaturado || '').trim(),
        cliente: String(r.tomadorRefaturado || r.tomadorOriginal || '').trim(),
        setor,
        motivo,
        valor: valorPorSetor,
        usuario: prodNorm(r.userSetor || r.operadorOriginal || '')
      }));
  });
  rows.sort((a,b) => b.valor - a.valor || a.motivo.localeCompare(b.motivo) || a.cte.localeCompare(b.cte));
  return rows;
}

function aggregateSetorReasons(rows){
  const map = new Map();
  rows.forEach(r => {
    const key = r.motivo || 'Sem preenchimento';
    if(!map.has(key)) map.set(key, { motivo:key, qty:0, value:0 });
    const item = map.get(key);
    item.qty += 1;
    item.value += Number(r.valor || 0);
  });
  return Array.from(map.values()).sort((a,b) => b.qty - a.qty || b.value - a.value || a.motivo.localeCompare(b.motivo));
}

const __origRenderSetoresView = typeof renderSetoresView === 'function' ? renderSetoresView : null;
renderSetoresView = function(){
  if(__origRenderSetoresView) __origRenderSetoresView();

  const select = document.getElementById('setorReasonSelect');
  const setoresDisponiveis = allSectorNames().map(x => upper(x)).filter(Boolean);
  let selectedSetor = 'TODOS';
  if(select){
    const current = select.value || 'TODOS';
    select.innerHTML = '<option value="TODOS">Todos</option>' + setoresDisponiveis.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(current !== 'TODOS' && setoresDisponiveis.includes(current)) select.value = current;
    else select.value = 'TODOS';
    selectedSetor = select.value;
  }

  const detailRows = getSetorReasonDetailRows(selectedSetor);
  const reasonAgg = aggregateSetorReasons(detailRows).slice(0,12);
  makeBarChart('chartSetorMotivosQtd', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartSetorMotivosValor', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.value), true, 'Valor');

  const tbody = document.getElementById('tbodySetoresMotivos');
  if(tbody){
    tbody.innerHTML = detailRows.length
      ? detailRows.map(r => `<tr><td><strong>${esc(r.cte)}</strong></td><td>${esc(r.cliente || '-')}</td><td>${esc(r.setor)}</td><td>${esc(r.motivo)}</td><td>${fmtMoney(r.valor)}</td><td>${esc(r.usuario || '-')}</td></tr>`).join('')
      : `<tr><td colspan="6" class="center muted">Sem dados para o setor selecionado</td></tr>`;
  }
}


function exportPainelExcel(){
  try{
    const wb = XLSX.utils.book_new();
    const monthLabelValue = (() => {
      const sel = document.getElementById('monthViewSelect');
      if(sel && sel.value) return sel.value;
      return state.selectedMonthKey || '';
    })();

    const totalRef = (state.setores || []).reduce((s,x)=>s+Number(x.debit||0),0);
    const totalSub = (state.substitutos || []).reduce((s,x)=>s+Number(x.freteSubstituto||0),0);
    const totalGeral = totalRef + totalSub;
    const badMonth = (state.refaturados || []).filter(r => classifyStatus(getManual(r.refaturado).requestDate || '', r.dataRefaturado) === 'bad').length;
    const semSolic = (state.refaturados || []).filter(r => !getManual(r.refaturado).requestDate).length;

    const dashboardRows = [
      { indicador:'Mês consultado', valor: monthLabelValue || 'Atual' },
      { indicador:'Abas importadas', valor: state.sheets.length },
      { indicador:'Qtd. refaturados', valor: state.refaturados.length },
      { indicador:'Qtd. substitutos', valor: state.substitutos.length },
      { indicador:'Qtd. linhas setor', valor: state.setores.length },
      { indicador:'Refaturado total', valor: totalRef },
      { indicador:'Frete substituto total', valor: totalSub },
      { indicador:'Valor total', valor: totalGeral },
      { indicador:'Série 80/81 sem solicitação', valor: semSolic },
      { indicador:'Baixas em mês diferente', valor: badMonth }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashboardRows), 'Dashboard');

    const registrosRows = currentRowsFiltered().map(r => ({
      tipo: r.kind,
      cte: r.cte,
      original: r.original || '',
      cliente: r.client || '',
      usuario_original: r.userSetor || r.operadorOriginal || '',
      setor: r.setorLancamento || r.reduzido || '',
      baixa: r.date || '',
      debito: Number(r.debit || 0),
      frete_original: Number(r.freteOriginal || 0),
      frete_refaturado: Number(r.freteRefaturado || 0),
      frete_substituto: Number(r.freteSubstituto || 0),
      motivo: r.motivoBaixa || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registrosRows), 'Registros');

    const motivosRows = motivosAggregate().map(x => ({
      motivo: x.motivo,
      quantidade: x.qtd,
      valor_original: Number(x.original || 0),
      valor_refaturado: Number(x.ref || 0),
      valor_substituto: Number(x.sub || 0),
      debito: Number(x.debito || 0)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(motivosRows), 'Motivos');

    const usuariosRows = aggregateProd().filter(x => x.totalDocs > 0 || x.erros > 0).map(x => ({
      usuario: x.usuario,
      ctrc: Number(x['ctrc'] || 0),
      manifesto: Number(x['manifesto'] || 0),
      nf_fat: Number(x['nf.fat'] || 0),
      ost: Number(x['ost'] || 0),
      total_docs: Number(x.totalDocs || 0),
      erros: Number(x.erros || 0),
      performance: x.performance == null ? '' : Number(x.performance.toFixed(2))
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usuariosRows), 'Usuarios');

    const userSelect = document.getElementById('usuariosReasonSelect');
    const selectedUser = userSelect ? (userSelect.value || 'TODOS') : 'TODOS';
    const usuarioMotivosRows = getUsuariosReasonDetailRows(selectedUser).map(r => ({
      cte: r.cte,
      cliente: r.cliente || '',
      usuario: r.usuario || '',
      motivo: r.motivo || '',
      valor: Number(r.valor || 0),
      setor: r.setor || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usuarioMotivosRows), 'Usu_Motivos');

    const setoresRows = setoresAggregate().map(x => ({
      setor: x.setor,
      qtd_refaturados: Number(x.refQty || 0),
      valor_refaturado: Number(x.refValue || 0),
      qtd_substitutos: Number(x.subQty || 0),
      valor_substituto: Number(x.subValue || 0),
      valor_total: Number(x.totalValue || 0)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setoresRows), 'Setores');

    const setorSelect = document.getElementById('setorReasonSelect');
    const selectedSetor = setorSelect ? (setorSelect.value || 'TODOS') : 'TODOS';
    const setorMotivosRows = getSetorReasonDetailRows(selectedSetor).map(r => ({
      cte: r.cte,
      cliente: r.cliente || '',
      setor: r.setor || '',
      motivo: r.motivo || '',
      valor: Number(r.valor || 0),
      usuario: r.usuario || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setorMotivosRows), 'Setor_Motivos');

    const produtividadeRows = (state.prodRows || []).map(r => ({
      usuario: r.usuario || '',
      tipo: r.tipo || '',
      quantidade: Number(r.quantidade || 0)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(produtividadeRows), 'Produtividade');

    const annualRows = Object.keys(state.annual || {}).sort().map(key => {
      const row = state.annual[key] || {};
      return {
        mes: key,
        refaturado: Number(row.refaturado || 0),
        substituto: Number(row.substituto || 0),
        total: Number(row.total || 0),
        documentos: Number(row.docs || 0)
      };
    });
    if(annualRows.length){
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annualRows), 'Anual');
    }

    const safeMonth = (monthLabelValue || 'atual').replace(/[^\dA-Za-z_-]+/g, '_');
    XLSX.writeFile(wb, `painel_refaturamento_${safeMonth}.xlsx`);
  }catch(err){
    console.error(err);
    alert('Erro ao exportar Excel: ' + (err?.message || err));
  }
}

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('usuariosReasonSelect')?.addEventListener('change', renderUsuariosView);
  document.getElementById('setorReasonSelect')?.addEventListener('change', renderSetoresView);

  const syncBtn = document.getElementById('btnSyncSupabase');
  const host = syncBtn?.parentElement;
  if(host && !document.getElementById('btnExportExcel')){
    const btn = document.createElement('button');
    btn.className = 'btn secondary';
    btn.id = 'btnExportExcel';
    btn.type = 'button';
    btn.textContent = 'Extrair Excel';
    host.appendChild(btn);
  }
  document.getElementById('btnExportExcel')?.addEventListener('click', exportPainelExcel);
});


/* =========================================================
   PATCH FINAL LIMPO - ACESSO + DEDUPE/UPDATE SUPABASE
   - não altera layout base, mês, parser ou cálculos do Excel
   - corrige leitura duplicada da Supabase
   - limpa registros antigos do mesmo mês que não existem mais no Excel
   - operacional/consulta veem usuários/performance travados no usuarioRef
========================================================= */
function __getPerfilRefFinal(){
  const url = new URLSearchParams(window.location.search);
  return {
    perfil: (url.get('perfil') || '').toLowerCase(),
    usuarioRef: prodNorm(url.get('usuarioRef') || url.get('usuario') || '')
  };
}
function __isRestritoUsuarioFinal(){
  const p = __getPerfilRefFinal().perfil;
  return p === 'operacional' || p === 'consulta';
}
function __usuarioPermitidoFinal(){
  return __getPerfilRefFinal().usuarioRef;
}
function __normalizeUserFinal(v){ return prodNorm(v || ''); }
function __filterByUsuarioRefFinal(rows, getter){
  if(!__isRestritoUsuarioFinal()) return rows;
  const allowed = __usuarioPermitidoFinal();
  if(!allowed) return [];
  return (rows || []).filter(x => __normalizeUserFinal(getter(x)) === allowed);
}
function __enableAccessMenusFinal(){
  const { perfil } = __getPerfilRefFinal();
  if(perfil === 'operacional' || perfil === 'consulta'){
    ['usuarios','performance'].forEach(view => {
      const btn = document.querySelector(`[data-view="${view}"]`);
      if(btn) btn.style.display = '';
    });
  }
}
function __ensureUsuarioTopFilterFinal(){
  const section = document.getElementById('usuarios');
  if(!section || document.getElementById('filtroUsuarioTop')) return;
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.style.marginBottom = '16px';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;">
      <div>
        <h3>Filtro da análise</h3>
        <div class="sub">Controla os gráficos e a tabela principal desta aba.</div>
      </div>
      <div class="field" style="max-width:280px;min-width:200px;">
        <label>Usuário</label>
        <select id="filtroUsuarioTop"></select>
      </div>
    </div>`;
  section.insertBefore(wrap, section.firstChild);
  document.getElementById('filtroUsuarioTop')?.addEventListener('change', renderUsuariosView);
}
function __setOptionsPreserveFinal(select, values, defaultLabel){
  if(!select) return 'TODOS';
  const current = select.value || 'TODOS';
  const opts = ['<option value="TODOS">'+(defaultLabel || 'Todos')+'</option>'].concat(values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`));
  select.innerHTML = opts.join('');
  if(current !== 'TODOS' && values.includes(current)) select.value = current;
  else select.value = 'TODOS';
  return select.value;
}
function __applyUsuarioLockFinal(select){
  if(!select) return;
  if(__isRestritoUsuarioFinal()){
    const allowed = __usuarioPermitidoFinal();
    if(allowed){
      if(!Array.from(select.options).some(o => o.value === allowed)){
        select.insertAdjacentHTML('beforeend', `<option value="${esc(allowed)}">${esc(allowed)}</option>`);
      }
      select.value = allowed;
    }
    select.disabled = true;
  }else{
    select.disabled = false;
  }
}
function __remoteRefKeyFinal(row){
  return `${row.tipo || ''}|${row.documento || ''}`;
}
function __remoteSetorNaturalKeyFinal(row){
  return [
    'setor',
    upper(row.setor || ''),
    upper(row.cliente || ''),
    prodNorm(row.operador || row.usuario || ''),
    String(row.documento_original || row.original_doc || '').trim(),
    normalizeRowValue(parseNumber(row.debito || 0))
  ].join('|');
}
function __dedupeRemoteRefRowsFinal(rows){
  const map = new Map();
  (rows || []).forEach(row => {
    const baseKey = row.tipo === 'setor' ? __remoteSetorNaturalKeyFinal(row) : __remoteRefKeyFinal(row);
    const prev = map.get(baseKey);
    if(!prev){ map.set(baseKey, row); return; }
    const prevHasDate = !!prev.data_baixa;
    const rowHasDate = !!row.data_baixa;
    const prevUpdated = String(prev.updated_at || prev.created_at || '');
    const rowUpdated = String(row.updated_at || row.created_at || '');
    if((rowHasDate && !prevHasDate) || (rowHasDate === prevHasDate && rowUpdated > prevUpdated)) map.set(baseKey, row);
  });
  return Array.from(map.values());
}
async function __deleteByIdsFinal(table, ids){
  const clean = (ids || []).filter(Boolean);
  for(let i = 0; i < clean.length; i += 100){
    const chunk = clean.slice(i, i + 100);
    const res = await state.supabase.from(table).delete().in('id', chunk);
    if(res.error) return res.error;
  }
  return null;
}
async function loadMonthFromSupabase(monthKey){
  if(!ensureSupabaseConnected()) return false;
  if(!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return false;
  const [ano, mes] = monthKey.split('-');
  const [{ data: refData, error: refError }, { data: prodData, error: prodError }] = await Promise.all([
    state.supabase.from('refaturamento_importado').select('*').eq('ano', ano).eq('mes', mes),
    state.supabase.from('produtividade_usuarios').select('*').eq('ano', ano).eq('mes', mes)
  ]);
  if(refError){ document.getElementById('syncStatus').textContent = 'Erro ao carregar refaturamento: ' + refError.message; console.error(refError); return false; }
  if(prodError){ document.getElementById('syncStatus').textContent = 'Erro ao carregar produtividade: ' + prodError.message; console.error(prodError); return false; }

  const allRef = __dedupeRemoteRefRowsFinal(refData || []).sort((a,b) => String(a.documento || '').localeCompare(String(b.documento || '')));
  const prodMap = new Map();

(prodData || []).forEach(r => {
  const op = prodNorm(r.operador || r.usuario || '');
  if(!op) return;

  prodMap.set(op, {
    ...r,
    operador: op,
    ctrc: parseNumber(r.ctrc || 0),
    manifesto: parseNumber(r.manifesto || 0),
    ost: parseNumber(r.ost || 0),
    nf_fat: parseNumber(r.nf_fat || 0)
  });
});

const allProd = Array.from(prodMap.values())
  .sort((a,b) => String(a.operador || '').localeCompare(String(b.operador || '')));
  const refRows = allRef.filter(r => r.tipo === 'refaturado');
  const subRows = allRef.filter(r => r.tipo === 'substituto');
  const setorRows = allRef.filter(r => r.tipo === 'setor');

  state.sheets = ['supabase'];
  state.refaturados = refRows.map(r => ({
    dataRefaturado: toInputDate(r.data_baixa || ''),
    tomadorRefaturado: r.cliente || '',
    refaturado: r.documento || '',
    freteRefaturado: parseNumber(r.frete_refaturado || 0),
    dataOriginal: '',
    operadorOriginal: r.operador || r.usuario || '',
    tomadorOriginal: r.cliente || '',
    original: r.documento_original || r.original_doc || '',
    freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0,
    reduzido: r.reduzido || r.setor || '',
    motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''),
    originalTail: (tailDigits(r.documento_original || r.original_doc || '') || '').replace(/^0+/,'') || '0',
    debit: parseNumber(r.debito || 0),
    userSetor: r.operador || r.usuario || '',
    setorLancamento: r.setor || ''
  }));
  state.substitutos = subRows.map(r => ({
    dataSubstituto: toInputDate(r.data_baixa || ''),
    tomadorSubstituto: r.cliente || '',
    substituto: r.documento || '',
    freteSubstituto: parseNumber(r.frete_substituto || 0),
    dataOriginal: '',
    operadorOriginal: r.operador || r.usuario || '',
    tomadorOriginal: r.cliente || '',
    original: r.documento_original || r.original_doc || '',
    freteOriginal: parseNumber(r.frete_original || 0),
    diferenca: 0,
    reduzido: r.reduzido || r.setor || '',
    motivoBaixa: r.motivo_baixa || '',
    clientGroup: clientGroup(r.cliente || ''),
    originalTail: (tailDigits(r.documento_original || r.original_doc || '') || '').replace(/^0+/,'') || '0',
    debit: 0
  }));
  state.setores = setorRows.map(r => ({
    data: toInputDate(r.data_baixa || ''),
    docto: String(r.documento || '').split('|')[2] || '',
    cliente: r.cliente || '',
    debit: parseNumber(r.debito || 0),
    documentos: docTokens(r.documento_original || r.original_doc || ''),
    usuario: r.operador || r.usuario || '',
    setor: r.setor || 'NÃO IDENTIFICADO',
    clientGroup: clientGroup(r.cliente || '')
  }));
  state.prodRows = [];
  allProd.forEach(r => {
    const usuario = prodNorm(r.operador || r.usuario || '');
    const pushRow = (tipo, quantidade) => { const q = parseNumber(quantidade || 0); if(q > 0) state.prodRows.push({ usuario, tipo, quantidade:q }); };
    pushRow('ctrc', r.ctrc); pushRow('manifesto', r.manifesto); pushRow('ost', r.ost); pushRow('nf.fat', r.nf_fat);
  });

  const snapshot = cloneMonthlySnapshot();
  state.annual[monthKey] = { ...currentAnnualSummary(), snapshot };
  writeStorage('painel_ref_annual_v32', state.annual);
  state.annualProd[monthKey] = {
    documentos: (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0),
    rows: JSON.parse(JSON.stringify(state.prodRows || []))
  };
  writeStorage('painel_ref_annual_prod_v36', state.annualProd);
  state.selectedMonthKey = monthKey;
  applySnapshot(snapshot);
  refreshMonthViewSelect();
  const monthSel = document.getElementById('monthViewSelect'); if(monthSel) monthSel.value = monthKey;
  const ignored = (refData || []).length - allRef.length;
  const msgIgnored = ignored > 0 ? ` (${ignored} duplicado(s) ignorado(s) na leitura)` : '';
  document.getElementById('syncStatus').textContent = `Mês ${mes}/${ano} carregado da Supabase${msgIgnored}.`;
  renderAll();
  return true;
}
async function syncSupabase(){
  if(!ensureSupabaseConnected()){ alert('Configure a Supabase no HTML primeiro.'); return; }
  const refAno = String(document.getElementById('annualYear')?.value || '').trim();
  const refMes = String(document.getElementById('annualMonth')?.value || '').padStart(2,'0');
  const prodAno = String(document.getElementById('prodYear')?.value || '').trim();
  const prodMes = String(document.getElementById('prodMonth')?.value || '').padStart(2,'0');
  const refKey = /^\d{4}-\d{2}$/.test(`${refAno}-${refMes}`) ? `${refAno}-${refMes}` : '';
  const prodKey = /^\d{4}-\d{2}$/.test(`${prodAno}-${prodMes}`) ? `${prodAno}-${prodMes}` : '';
  const refRowsRaw = refKey ? buildRefRowsForSync(refMes, refAno) : [];
  const prodRowsRaw = prodKey ? buildProdRowsForSync(prodMes, prodAno) : [];
  const refMapLocal = new Map();
  refRowsRaw.forEach(row => {
    row.data_baixa = toInputDate(row.data_baixa || '') || null;
    const k = `${row.tipo}|${row.documento}|${row.mes}|${row.ano}`;
    if(!refMapLocal.has(k)) refMapLocal.set(k, row);
  });
  const prodMapLocal = new Map();
  prodRowsRaw.forEach(row => {
    const k = `${row.operador}|${row.mes}|${row.ano}`;
    if(!prodMapLocal.has(k)) prodMapLocal.set(k, row);
  });
  const refRows = Array.from(refMapLocal.values());
  const prodRows = Array.from(prodMapLocal.values());
  if(!refRows.length && !prodRows.length){ alert('Importe o Excel do mês e/ou o Excel de produtividade antes de sincronizar.'); return; }
  document.getElementById('syncStatus').textContent = 'Comparando Excel com Supabase...';

  let remoteRef = [], remoteProd = [];
  if(refRows.length){
    const res = await state.supabase.from('refaturamento_importado').select('*').eq('ano', refAno).eq('mes', refMes);
    if(res.error){ document.getElementById('syncStatus').textContent = 'Erro: ' + res.error.message; console.error(res.error); return; }
    remoteRef = res.data || [];
  }
  if(prodRows.length){
    const res = await state.supabase.from('produtividade_usuarios').select('*').eq('ano', prodAno).eq('mes', prodMes);
    if(res.error){ document.getElementById('syncStatus').textContent = 'Erro: ' + res.error.message; console.error(res.error); return; }
    remoteProd = res.data || [];
  }

  // Limpa sobras antigas do mesmo mês: registros que estão no banco, mas não existem no Excel atual.
  if(refRows.length && remoteRef.length){
    const localKeys = new Set(refRows.map(row => `${row.tipo}|${row.documento}`));
    const staleIds = remoteRef.filter(row => !localKeys.has(`${row.tipo}|${row.documento}`)).map(row => row.id).filter(Boolean);
    const err = await __deleteByIdsFinal('refaturamento_importado', staleIds);
    if(err){ document.getElementById('syncStatus').textContent = 'Erro limpando duplicados antigos: ' + err.message; console.error(err); return; }
    remoteRef = remoteRef.filter(row => localKeys.has(`${row.tipo}|${row.documento}`));
  }
  if(prodRows.length && remoteProd.length){
    const localUsers = new Set(prodRows.map(row => String(row.operador || '')));
    const staleIds = remoteProd.filter(row => !localUsers.has(String(row.operador || ''))).map(row => row.id).filter(Boolean);
    const err = await __deleteByIdsFinal('produtividade_usuarios', staleIds);
    if(err){ document.getElementById('syncStatus').textContent = 'Erro limpando produtividade antiga: ' + err.message; console.error(err); return; }
    remoteProd = remoteProd.filter(row => localUsers.has(String(row.operador || '')));
  }

  const remoteRefMap = mapByKey(remoteRef || [], row => `${row.tipo}|${row.documento}`);
  const remoteProdMap = mapByKey(remoteProd || [], row => `${row.operador}`);
  const refFinal = refRows.filter(row => { const prev = remoteRefMap.get(`${row.tipo}|${row.documento}`); return !prev || !sameRefRow(row, prev); });
  const prodFinal = prodRows.filter(row => { const prev = remoteProdMap.get(`${row.operador}`); return !prev || !sameProdRow(row, prev); });

  let refError = null, prodError = null;
  if(refFinal.length){
    refError = await __deleteRefDocs(refFinal) || await __insertChunks('refaturamento_importado', refFinal);
  }
  if(prodFinal.length){
    prodError = await __deleteProdOperators(prodFinal) || await __insertChunks('produtividade_usuarios', prodFinal);
  }
  if(refError || prodError){ const err = refError || prodError; document.getElementById('syncStatus').textContent = `Erro: ${err.message}`; console.error(err); return; }

  const monthMap = new Map();
  if(refKey) monthMap.set(refKey, { mes: refMes, ano: refAno, tem_refaturamento: refRows.length > 0, tem_produtividade: false });
  if(prodKey){
    const prevMonth = monthMap.get(prodKey) || { mes: prodMes, ano: prodAno, tem_refaturamento: false, tem_produtividade: false };
    prevMonth.tem_produtividade = prodRows.length > 0 || prevMonth.tem_produtividade;
    monthMap.set(prodKey, prevMonth);
  }
  for(const row of monthMap.values()){
    const prev = await state.supabase.from('meses_importados').select('tem_refaturamento,tem_produtividade').eq('mes', row.mes).eq('ano', row.ano).maybeSingle();
    const merged = { mes: row.mes, ano: row.ano, tem_refaturamento: !!row.tem_refaturamento || !!prev.data?.tem_refaturamento, tem_produtividade: !!row.tem_produtividade || !!prev.data?.tem_produtividade };
    const monthError = await __replaceMesImportado(merged);
    if(monthError){ document.getElementById('syncStatus').textContent = `Erro: ${monthError.message}`; return; }
  }
  if(refKey && refRows.length){ state.annual[refKey] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() }; writeStorage('painel_ref_annual_v32', state.annual); }
  if(prodKey && prodRows.length){ state.annualProd[prodKey] = { documentos: (state.prodRows || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0), rows: JSON.parse(JSON.stringify(state.prodRows || [])) }; writeStorage('painel_ref_annual_prod_v36', state.annualProd); }
  await fetchRemoteMonthKeys();
  const refsMsg = refKey ? `Ref ${refFinal.length} (${monthLabel(refKey)})` : 'Ref 0';
  const prodMsg = prodKey ? `Prod ${prodFinal.length} (${monthLabel(prodKey)})` : 'Prod 0';
  document.getElementById('syncStatus').textContent = `Sincronização concluída. Novos/alterados: ${refsMsg} | ${prodMsg}`;
}
function renderUsuariosView(){
console.log('RENDER USUARIOS ATIVA - FINAL');
  __ensureUsuarioTopFilterFinal();
  const allUsersAgg = usuariosErroAggregate();
console.log('USERS AGG FINAL', allUsersAgg);
  const allUsers = allUsersAgg.map(x => x.user);
  const topSelect = document.getElementById('filtroUsuarioTop');
  let selectedTop = __setOptionsPreserveFinal(topSelect, allUsers, 'Todos');
  __applyUsuarioLockFinal(topSelect);
  selectedTop = topSelect ? (topSelect.value || 'TODOS') : 'TODOS';
  let users = allUsersAgg;
  if(selectedTop !== 'TODOS') users = users.filter(x => x.user === selectedTop);
  users = users.slice(0,10);
  makeBarChart('chartUsuariosErroQtd', users.map(x=>x.user), users.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuariosErroValor', users.map(x=>x.user), users.map(x=>x.total), true, 'Valor');
  document.getElementById('tbodyUsuarios').innerHTML = users.length
  ? users.map(x => `
<tr>
<td>${esc(x.user)}</td>
<td>${x.qtdRef || 0}</td>
<td>${x.qtdSub || 0}</td>
<td>${x.qty || 0}</td>
<td>${fmtMoney(x.refaturado || 0)}</td>
<td>${fmtMoney(x.substituto || 0)}</td>
<td>${fmtMoney(x.total || 0)}</td>
</tr>
`).join('')
  : `<tr><td colspan="7" class="center muted">Sem dados</td></tr>`;

  const select = document.getElementById('usuariosReasonSelect');
  let selectedUser = __setOptionsPreserveFinal(select, allUsers, 'Todos');
  __applyUsuarioLockFinal(select);
  selectedUser = select ? (select.value || 'TODOS') : 'TODOS';
  const detailRows = getUsuariosReasonDetailRows(selectedUser);
  const reasonAgg = aggregateUserReasons(detailRows).slice(0,12);
  makeBarChart('chartUsuarioMotivosQtd', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.qty), true, 'Quantidade');
  makeBarChart('chartUsuarioMotivosValor', reasonAgg.map(x=>x.motivo), reasonAgg.map(x=>x.value), true, 'Valor');
  document.getElementById('tbodyUsuariosMotivos').innerHTML = detailRows.length
    ? detailRows.map(r => `<tr><td><strong>${esc(r.cte)}</strong></td><td>${esc(r.cliente || '-')}</td><td>${esc(r.usuario)}</td><td>${esc(r.motivo)}</td><td>${fmtMoney(r.valor)}</td><td>${esc(r.setor)}</td></tr>`).join('')
    : `<tr><td colspan="6" class="center muted">Sem dados para o usuário selecionado</td></tr>`;
}
function renderPerformanceView(){
  const select = document.getElementById('performanceUserSelect');
  const rowsAll = aggregateProd();
  const allUsers = rowsAll.map(x => x.usuario).filter(Boolean);
  let selected = __setOptionsPreserveFinal(select, allUsers, 'Todos');
  __applyUsuarioLockFinal(select);
  selected = select ? (select.value || 'TODOS') : 'TODOS';
  let rows = rowsAll;
  if(selected !== 'TODOS') rows = rows.filter(x => x.usuario === selected);
  const docsLabels = rows.map(x => x.usuario);
  const docsData = rows.map(x => x.totalDocs || 0);
  makeBarChart('chartProdUsuarioMes', docsLabels, docsData, true, 'Documentos');
  const typeTotals = DOC_TYPES.map(tipo => rows.reduce((s,x)=>s+Number(x[tipo]||0),0));
  makeBarChart('chartProdTiposMes', ['CTRC','MANIFESTO','NF.FAT','OST'], typeTotals, false, 'Quantidade');
  const perfRows = rows.filter(x => x.performance != null);
  makeBarChart('chartPerformance', perfRows.map(x=>x.usuario), perfRows.map(x=>Number((x.performance||0).toFixed(2))), true, 'Performance');
  const buckets = { 'ÓTIMO 99,51 – 100':0, 'REGULAR 97 – 99,50':0, 'RUIM 90 – 96,9':0 };
  perfRows.forEach(x => {
    const p = Number(x.performance || 0);
    if(p >= 99.51) buckets['ÓTIMO 99,51 – 100']++;
    else if(p >= 97) buckets['REGULAR 97 – 99,50']++;
    else buckets['RUIM 90 – 96,9']++;
  });
  makePieChart('chartPerformancePie', Object.keys(buckets), Object.values(buckets));
}
document.addEventListener('DOMContentLoaded', function(){
  __enableAccessMenusFinal();
  __ensureUsuarioTopFilterFinal();
  document.getElementById('filtroUsuarioTop')?.addEventListener('change', renderUsuariosView);
  document.getElementById('usuariosReasonSelect')?.addEventListener('change', renderUsuariosView);
  document.getElementById('performanceUserSelect')?.addEventListener('change', renderPerformanceView);
});




/* ===== PATCH FINAL PRODUTIVIDADE - NÃO ALTERA MESES/SUPABASE ===== */
(function(){
  function keyUser(v){
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,'')
      .trim();
  }
  function displayUser(v){ return String(v || '').trim().toLowerCase(); }
  function sameUser(a,b){ return keyUser(a) === keyUser(b); }
  function validUser(v){
    const s = String(v || '').trim();
    if(!s) return false;
    const k = keyUser(s);
    if(!k || k === 'todos') return false;
    if(k.includes('total')) return false;
    if(/[;,/|]/.test(s)) return false;
    return /^[a-zA-ZÀ-ÿ0-9_.-]+$/.test(s);
  }
  function sortDesc(rows, field){ return (rows || []).slice().sort((a,b)=>Number(b[field]||0)-Number(a[field]||0)); }
  function uniqueUsers(rows){
    const map = new Map();
    (rows || []).forEach(r => {
      const u = displayUser(r.usuario || r.operador || '');
      if(!validUser(u)) return;
      const k = keyUser(u);
      if(!map.has(k)) map.set(k, u);
    });
    return Array.from(map.values()).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }
  function colorPerformance(p){
    p = Number(p || 0);
    if(p >= 99.51) return '#12c97a';
    if(p >= 97) return '#f4c20d';
    return '#ef4444';
  }

  window.__prodValidUserFinal = validUser;
  window.__prodSameUserFinal = sameUser;

  window.parseProdWorkbook = function(workbook){
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });
    const out = [];
    const headerRowIndex = rows.findIndex(r => {
      const norm = (Array.isArray(r) ? r : []).map(prodNorm);
      return norm.some(v => v === 'operador' || v === 'usuario') && norm.includes('ctrc');
    });
    if(headerRowIndex < 0) return out;
    const header = rows[headerRowIndex] || [];
    const norm = header.map(prodNorm);
    const userCol = norm.findIndex(v => v === 'operador' || v === 'usuario');
    const findCol = (names) => norm.findIndex(v => names.some(n => v === n || v.replace(/\s+/g,'') === n.replace(/\s+/g,'')));
    const cols = [
      { c: findCol(['ctrc']), tipo:'ctrc' },
      { c: findCol(['manifesto']), tipo:'manifesto' },
      { c: findCol(['ost']), tipo:'ost' },
      { c: findCol(['nf.fat','nffat','nf fat']), tipo:'nf.fat' }
    ].filter(x => x.c >= 0);
    if(userCol < 0) return out;

    for(let i=headerRowIndex+1; i<rows.length; i++){
      const row = Array.isArray(rows[i]) ? rows[i] : [];
      const usuario = displayUser(row[userCol]);
      if(!validUser(usuario)) continue;
      cols.forEach(({c,tipo}) => {
        const quantidade = parseNumber(row[c]);
        if(Number.isFinite(quantidade) && quantidade > 0){
          out.push({ usuario, tipo, quantidade });
        }
      });
    }
    return out;
  };

  window.aggregateProd = function(){
    const map = new Map();
    function ensure(usuarioRaw){
      const usuario = displayUser(usuarioRaw);
      if(!validUser(usuario)) return null;
      const k = keyUser(usuario);
      if(!map.has(k)){
        map.set(k, { usuario, usuarioKey:k, 'ctrc':0, 'manifesto':0, 'nf.fat':0, 'ost':0, erros:0, erroValor:0, performance:null, totalDocs:0 });
      }
      return map.get(k);
    }
    (state.prodRows || []).forEach(r => {
      const item = ensure(r.usuario || r.operador || '');
      if(!item) return;
      const tipo = normalizeDocType(r.tipo || r.tipo_doc || '');
      const qtd = Number(r.quantidade || 0);
      if(!DOC_TYPES.includes(tipo) || qtd <= 0) return;
      item[tipo] = Number(item[tipo] || 0) + qtd;
    });
   (usuariosErroAggregate() || []).forEach(u => {
  const item = ensure(u.user || '');
  if(!item) return;

  item.erros += Number(u.qty || 0);
  item.erroValor += Number(u.total || 0);
});
    return Array.from(map.values()).map(x => {
      x.totalDocs = Number(x['ctrc']||0) + Number(x['manifesto']||0) + Number(x['nf.fat']||0) + Number(x['ost']||0);
      const base = Number(x['ctrc']||0) + Number(x['ost']||0);
      const perf = base ? (100 - ((Number(x.erros||0) * 100) / base)) : null;
      x.performance = perf === null ? null : Math.max(0, Math.min(100, perf));
      return x;
    });
  };

  window.buildProdRowsForSync = function(mes, ano){
    const map = new Map();
    (state.prodRows || []).forEach(r => {
      const operador = displayUser(r.usuario || r.operador || '');
      const tipo = normalizeDocType(r.tipo || r.tipo_doc || '');
      const qtd = parseNumber(r.quantidade || 0);
      if(!validUser(operador) || !tipo || qtd <= 0) return;
      const key = `${mes}|${ano}|${keyUser(operador)}`;
      if(!map.has(key)) map.set(key, { mes, ano, operador, ctrc:0, manifesto:0, ost:0, nf_fat:0, total_docs:0, docs_performance:0 });
      const row = map.get(key);
      if(tipo === 'ctrc') row.ctrc += qtd;
      else if(tipo === 'manifesto') row.manifesto += qtd;
      else if(tipo === 'ost') row.ost += qtd;
      else if(tipo === 'nf.fat') row.nf_fat += qtd;
      row.total_docs = row.ctrc + row.manifesto + row.ost + row.nf_fat;
      row.docs_performance = row.ctrc + row.ost;
    });
    return Array.from(map.values());
  };

  window.renderPerformanceView = function(){
    const select = document.getElementById('performanceUserSelect');
    const rowsAll = aggregateProd().filter(x => validUser(x.usuario) && (x.totalDocs > 0 || x.erros > 0));
    const users = uniqueUsers(rowsAll);

    if(select){
      const current = select.value || 'TODOS';
      select.innerHTML = '<option value="TODOS">Todos</option>' + users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
      const found = users.find(u => sameUser(u, current));
      select.value = current === 'TODOS' ? 'TODOS' : (found || 'TODOS');
      if(typeof __isRestritoUsuarioFinal === 'function' && __isRestritoUsuarioFinal()){
        const allowed = typeof __usuarioPermitidoFinal === 'function' ? __usuarioPermitidoFinal() : '';
        const allowedFound = users.find(u => sameUser(u, allowed));
        if(allowedFound) select.value = allowedFound;
        else if(validUser(allowed)){
          const val = displayUser(allowed);
          select.insertAdjacentHTML('beforeend', `<option value="${esc(val)}">${esc(val)}</option>`);
          select.value = val;
        }
        select.disabled = true;
      }else{
        select.disabled = false;
      }
    }

    const selected = select ? (select.value || 'TODOS') : 'TODOS';
    let rows = rowsAll;
    if(selected !== 'TODOS') rows = rows.filter(x => sameUser(x.usuario, selected));

    const docsRows = sortDesc(rows, 'totalDocs');
    makeBarChart('chartProdUsuarioMes', docsRows.map(x=>x.usuario), docsRows.map(x=>Number(x.totalDocs || 0)), true, 'Documentos');

    const typeTotals = DOC_TYPES.map(tipo => rows.reduce((s,x)=>s+Number(x[tipo]||0),0));
    makeBarChart('chartProdTiposMes', ['CTRC','MANIFESTO','NF.FAT','OST'], typeTotals, false, 'Quantidade');

    const perfRows = sortDesc(rows.filter(x => x.performance != null), 'performance');
    const perfLabels = perfRows.map(x => x.usuario);
    const perfValues = perfRows.map(x => Number((x.performance || 0).toFixed(2)));
    const perfColors = perfValues.map(colorPerformance);

    destroyChart('chartPerformance');
    const ctxPerf = document.getElementById('chartPerformance');
    if(ctxPerf){
      state.charts.chartPerformance = new Chart(ctxPerf, {
        type:'bar',
        data:{
          labels: perfLabels.map(l => String(l).length > 18 ? String(l).slice(0,18)+'…' : String(l)),
          datasets:[{ label:'Performance', data: perfValues, backgroundColor: perfColors, borderColor: perfColors, borderWidth:1 }]
        },
        options:{
          indexAxis:'y', responsive:true, maintainAspectRatio:false,
          layout:{ padding:{ right:90 } },
          plugins:{
            legend:{ labels:{ color:'#fff' } },
            tooltip:{ callbacks:{ title:(items)=> items.length ? String(perfLabels[items[0].dataIndex] || '') : '', label:(ctx)=> `Performance: ${Number(ctx.raw || 0).toFixed(2)}%` } },
            datalabels:{ color:'#fff', backgroundColor:'rgba(8,16,29,.88)', borderRadius:4, padding:{top:2,right:4,bottom:2,left:4}, anchor:'end', align:'right', offset:8, clamp:false, clip:false, formatter:v => `${Number(v || 0).toFixed(2)}%`, display:true }
          },
          scales:{ x:{ min:90, max:100, ticks:{ color:'#cfe0ff', callback:(v)=>`${v}%` }, grid:{ color:'rgba(255,255,255,.05)' } }, y:{ ticks:{ color:'#cfe0ff' }, grid:{ color:'rgba(255,255,255,.05)' } } }
        }
      });
    }

    const buckets = { 'ÓTIMO 99,51 – 100':0, 'REGULAR 97 – 99,50':0, 'RUIM 90 – 96,9':0 };
    perfRows.forEach(x => { const p=Number(x.performance||0); if(p>=99.51) buckets['ÓTIMO 99,51 – 100']++; else if(p>=97) buckets['REGULAR 97 – 99,50']++; else buckets['RUIM 90 – 96,9']++; });
    destroyChart('chartPerformancePie');
    const ctxPie = document.getElementById('chartPerformancePie');
    if(ctxPie){
      state.charts.chartPerformancePie = new Chart(ctxPie, { type:'doughnut', data:{ labels:Object.keys(buckets), datasets:[{ data:Object.values(buckets), backgroundColor:['#12c97a','#f4c20d','#ef4444'], borderColor:['#12c97a','#f4c20d','#ef4444'], borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#fff' }, position:'bottom' }, datalabels:{ color:'#fff', formatter:v=>v||'', display:true } } } });
    }
  };
})();


document.addEventListener('DOMContentLoaded', function(){
  ['filterSearch','filterTipo','filterStatus','filterSerie80'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('input',()=>{ __PAG_REF.registros=1; });
    if(el) el.addEventListener('change',()=>{ __PAG_REF.registros=1; });
  });
});


window.replaceMesSupabase = replaceSelectedMonthInSupabase;
window.substituirMesNaSupabase = replaceSelectedMonthInSupabase;
window.substituirMesSupabase = replaceSelectedMonthInSupabase;


/* =========================================================
   PATCH v12 - Reimportar mês seguro
   Limpa as 3 tabelas do mês selecionado, confirma que zerou,
   e só depois sincroniza o Excel que está carregado na tela.
   ========================================================= */

function padMesV12(v){
  const s = String(v ?? '').trim();
  if(!s) return '';
  if(/^\d+$/.test(s)) return String(Number(s)).padStart(2,'0');
  const mapa = {
    'janeiro':'01','jan':'01','jan/':'01',
    'fevereiro':'02','fev':'02',
    'março':'03','marco':'03','mar':'03',
    'abril':'04','abr':'04',
    'maio':'05','mai':'05',
    'junho':'06','jun':'06',
    'julho':'07','jul':'07',
    'agosto':'08','ago':'08',
    'setembro':'09','set':'09',
    'outubro':'10','out':'10',
    'novembro':'11','nov':'11',
    'dezembro':'12','dez':'12'
  };
  return mapa[s.toLowerCase()] || s;
}

function getMesAnoConfigV12(){
  let mes = '';
  let ano = '';

  const monthView = document.getElementById('monthViewSelect')?.value || '';
  if(monthView && monthView.includes('-')){
    const parts = monthView.split('-');
    ano = parts[0];
    mes = padMesV12(parts[1]);
  }

  const mesCfg = document.getElementById('monthSelect') || document.getElementById('mesSelect') || document.getElementById('importMonth') || document.querySelector('select[id*="mes" i]');
  const anoCfg = document.getElementById('yearInput') || document.getElementById('anoInput') || document.getElementById('importYear') || document.querySelector('input[id*="ano" i]');

  if(mesCfg && mesCfg.value) mes = padMesV12(mesCfg.value);
  if(anoCfg && anoCfg.value) ano = String(anoCfg.value).trim();

  if(!ano) ano = '2026';

  return { mes, ano };
}

async function countTabelaMesV12(tabela, ano, mes){
  const res = await state.supabase
    .from(tabela)
    .select('id', { count:'exact', head:true })
    .eq('ano', String(ano))
    .eq('mes', String(mes));
  if(res.error) throw res.error;
  return res.count || 0;
}

async function deleteTabelaMesV12(tabela, ano, mes){
  const res = await state.supabase
    .from(tabela)
    .delete()
    .eq('ano', String(ano))
    .eq('mes', String(mes));
  if(res.error) throw res.error;
}

async function reimportarMesSeguroV12(){
  if(!state || !state.supabase){
    alert('Supabase não conectada.');
    return;
  }

  const { mes, ano } = getMesAnoConfigV12();

  if(!mes || !ano){
    alert('Selecione o mês e ano antes de reimportar.');
    return;
  }

  const temRef = Array.isArray(state.refRows) && state.refRows.length > 0;
  const temProd = Array.isArray(state.prodRows) && state.prodRows.length > 0;

  if(!temRef && !temProd){
    alert('Importe o Excel de refaturamento e/ou produtividade antes de reimportar o mês.');
    return;
  }

  const ok = confirm(
    'Reimportar mês ' + mes + '/' + ano + '?\n\n' +
    'Esta ação vai apagar da Supabase:\n' +
    '- refaturamento_importado\n' +
    '- produtividade_usuarios\n' +
    '- meses_importados\n\n' +
    'Depois vai gravar novamente o Excel carregado na tela.'
  );

  if(!ok) return;

  const statusEl = document.getElementById('syncStatus') || document.getElementById('importStatus');

  try{
    if(statusEl) statusEl.textContent = 'Limpando mês ' + mes + '/' + ano + ' na Supabase...';

    await deleteTabelaMesV12('refaturamento_importado', ano, mes);
    await deleteTabelaMesV12('produtividade_usuarios', ano, mes);
    await deleteTabelaMesV12('meses_importados', ano, mes);

    const cRef = await countTabelaMesV12('refaturamento_importado', ano, mes);
    const cProd = await countTabelaMesV12('produtividade_usuarios', ano, mes);
    const cMes = await countTabelaMesV12('meses_importados', ano, mes);

    if(cRef || cProd || cMes){
      alert(
        'Não foi possível limpar o mês completamente.\n\n' +
        'refaturamento_importado: ' + cRef + '\n' +
        'produtividade_usuarios: ' + cProd + '\n' +
        'meses_importados: ' + cMes + '\n\n' +
        'Nada será gravado para evitar duplicidade.'
      );
      return;
    }

    if(statusEl) statusEl.textContent = 'Mês limpo. Sincronizando dados carregados...';

    if(typeof syncSupabase === 'function'){
      await syncSupabase();
    }else if(typeof sincronizarSupabase === 'function'){
      await sincronizarSupabase();
    }else if(typeof salvarMesSupabase === 'function'){
      await salvarMesSupabase();
    }else{
      alert('Não encontrei a função de sincronização no app.js.');
      return;
    }

    if(statusEl) statusEl.textContent = 'Reimportação segura concluída para ' + mes + '/' + ano + '.';

    alert('Mês ' + mes + '/' + ano + ' reimportado com segurança.\n\nAgora clique em Consultar para validar os valores.');

  }catch(err){
    console.error('Erro na reimportação segura:', err);
    alert('Erro ao reimportar mês: ' + (err?.message || err));
  }
}

window.reimportarMesSeguroV12 = reimportarMesSeguroV12;

function ligarBotaoReimportarMesSeguroV12(){
  const btn = document.getElementById('btnReimportarMesSeguro');
  if(!btn) return;
  btn.onclick = function(e){
    e.preventDefault();
    reimportarMesSeguroV12();
  };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ligarBotaoReimportarMesSeguroV12);
}else{
  ligarBotaoReimportarMesSeguroV12();
}


/* PATCH v15 - Exibir NÃO IDENTIFICADO na Análise por Setor */
(function(){
  function norm(v){
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  }

  if(typeof window.parseReducedSectors === 'function' && !window.__patchNaoIdentificadoV15){
    const oldParse = window.parseReducedSectors;
    window.parseReducedSectors = function(v){
      const n = norm(v);
      if(n.includes('NAO IDENTIFICADO')) return ['NÃO IDENTIFICADO'];
      const r = oldParse(v) || [];
      return r.length ? r : [];
    };
  }

  if(typeof window.allSectorNames === 'function' && !window.__patchNaoIdentificadoV15){
    const oldAll = window.allSectorNames;
    window.allSectorNames = function(){
      const set = new Set(oldAll() || []);
      const rows = []
        .concat(window.state?.substitutos || [])
        .concat(window.state?.subRows || [])
        .concat(window.state?.records || []);
      if(rows.some(r => norm(r?.reduzido || r?.setor).includes('NAO IDENTIFICADO'))){
        set.add('NÃO IDENTIFICADO');
      }
      return Array.from(set);
    };
  }

  window.__patchNaoIdentificadoV15 = true;
})();


/* =========================================================
   PATCH FINAL - Reimportar mês usando o Excel recém-carregado
   Corrige o caso em que o painel consultava a Supabase e perdia
   o arquivo novo antes de apagar/gravar o mês.
   ========================================================= */
function __cloneFinalRefV15(obj){
  return JSON.parse(JSON.stringify(obj || null));
}

function __getMesAnoReimportFinalV15(){
  let ano = String(document.getElementById('annualYear')?.value || '').trim();
  let mes = String(document.getElementById('annualMonth')?.value || '').trim();

  if(!ano || !mes){
    const key = String(state?.selectedMonthKey || document.getElementById('monthViewSelect')?.value || '').trim();
    if(/^\d{4}-\d{2}$/.test(key)){
      const parts = key.split('-');
      ano = ano || parts[0];
      mes = mes || parts[1];
    }
  }

  mes = padMesV12(mes);
  return { mes, ano };
}

function __buildRefRowsFromSnapshotFinalV15(snapshot, mes, ano){
  if(!snapshotHasMonthlyData(snapshot)) return [];
  const atual = cloneMonthlySnapshot();
  try{
    applySnapshot(snapshot);
    const rows = buildRefRowsForSync(mes, ano) || [];
    return rows.map(r => ({ ...r, mes, ano, data_baixa: toInputDate(r.data_baixa || '') || null }));
  }finally{
    applySnapshot(atual);
  }
}

function __buildProdRowsFromCacheFinalV15(mes, ano){
  const prod = Array.isArray(state.__ultimoExcelProdutividade)
    ? JSON.parse(JSON.stringify(state.__ultimoExcelProdutividade))
    : [];
  if(!prod.length) return [];
  const atual = state.prodRows;
  try{
    state.prodRows = prod;
    return (buildProdRowsForSync(mes, ano) || []).map(r => ({ ...r, mes, ano }));
  }finally{
    state.prodRows = atual;
  }
}

function __uniqueRefRowsFinalV15(rows){
  const map = new Map();
  (rows || []).forEach(row => {
    const r = { ...row };
    r.tipo = String(r.tipo || '').trim();
    r.documento = String(r.documento || '').trim();
    const k = `${r.ano}|${r.mes}|${r.tipo}|${r.documento}`;
    if(r.tipo && r.documento && !map.has(k)) map.set(k, r);
  });
  return Array.from(map.values());
}

async function __countTabelaMesFinalV15(tabela, ano, mes){
  const res = await state.supabase
    .from(tabela)
    .select('*', { count:'exact', head:true })
    .eq('ano', String(ano))
    .eq('mes', String(mes));
  if(res.error) throw res.error;
  return res.count || 0;
}

async function __deleteMesTabelaFinalV15(tabela, ano, mes){
  const res = await state.supabase
    .from(tabela)
    .delete()
    .eq('ano', String(ano))
    .eq('mes', String(mes));
  if(res.error) throw res.error;
}

async function __insertOrUpsertRefFinalV15(rows){
  if(!rows.length) return null;
  const chunkSize = 400;
  for(let i=0; i<rows.length; i+=chunkSize){
    const chunk = rows.slice(i, i + chunkSize);
    let res = await state.supabase.from('refaturamento_importado').insert(chunk);
    if(res.error){
      res = await state.supabase.from('refaturamento_importado').upsert(chunk, { onConflict:'ano,mes,tipo,documento' });
      if(res.error) return res.error;
    }
  }
  return null;
}

async function __insertOrUpsertProdFinalV15(rows){
  if(!rows.length) return null;
  const chunkSize = 400;
  for(let i=0; i<rows.length; i+=chunkSize){
    const chunk = rows.slice(i, i + chunkSize);
    let res = await state.supabase.from('produtividade_usuarios').insert(chunk);
    if(res.error){
      res = await state.supabase.from('produtividade_usuarios').upsert(chunk, { onConflict:'ano,mes,operador' });
      if(res.error) return res.error;
    }
  }
  return null;
}

async function reimportarMesSeguroV12(){
  if(!state || !state.supabase){
    alert('Supabase não conectada.');
    return;
  }

  const { mes, ano } = __getMesAnoReimportFinalV15();
  if(!mes || !ano){
    alert('Selecione o mês e ano antes de reimportar.');
    return;
  }

  const snapshotRef = state.__ultimoExcelRefaturamento;
  const refRows = __uniqueRefRowsFinalV15(__buildRefRowsFromSnapshotFinalV15(snapshotRef, mes, ano));
  const prodRows = __buildProdRowsFromCacheFinalV15(mes, ano);

  if(!refRows.length && !prodRows.length){
    alert('Importe o Excel de refaturamento e/ou produtividade antes de reimportar o mês.\n\nImportante: selecione o arquivo Excel novamente e depois clique em Reimportar mês seguro.');
    return;
  }

  const ok = confirm(
    'Reimportar mês ' + mes + '/' + ano + '?\n\n' +
    'Esta ação vai apagar da Supabase os registros deste mês e gravar somente o Excel carregado agora.\n\n' +
    'Refaturamento novo: ' + refRows.length + ' linha(s)\n' +
    'Produtividade nova: ' + prodRows.length + ' linha(s)\n\n' +
    'Deseja continuar?'
  );
  if(!ok) return;

  const statusEl = document.getElementById('syncStatus') || document.getElementById('importStatus');

  try{
    if(statusEl) statusEl.textContent = 'Apagando mês ' + mes + '/' + ano + ' na Supabase...';

    await __deleteMesTabelaFinalV15('refaturamento_importado', ano, mes);
    await __deleteMesTabelaFinalV15('produtividade_usuarios', ano, mes);
    await __deleteMesTabelaFinalV15('meses_importados', ano, mes);

    const cRef = await __countTabelaMesFinalV15('refaturamento_importado', ano, mes);
    const cProd = await __countTabelaMesFinalV15('produtividade_usuarios', ano, mes);
    const cMes = await __countTabelaMesFinalV15('meses_importados', ano, mes);

    if(cRef || cProd || cMes){
      alert(
        'Não foi possível limpar o mês completamente. Nada será gravado para evitar duplicidade.\n\n' +
        'refaturamento_importado: ' + cRef + '\n' +
        'produtividade_usuarios: ' + cProd + '\n' +
        'meses_importados: ' + cMes
      );
      if(statusEl) statusEl.textContent = 'Reimportação bloqueada: mês não foi limpo completamente.';
      return;
    }

    if(statusEl) statusEl.textContent = 'Mês limpo. Gravando Excel novo...';

    const refErr = await __insertOrUpsertRefFinalV15(refRows);
    if(refErr) throw refErr;

    const prodErr = await __insertOrUpsertProdFinalV15(prodRows);
    if(prodErr) throw prodErr;

    const monthError = await __replaceMesImportado({
      mes,
      ano,
      tem_refaturamento: refRows.length > 0,
      tem_produtividade: prodRows.length > 0
    });
    if(monthError) throw monthError;

    if(snapshotRef && refRows.length){
      const atual = cloneMonthlySnapshot();
      applySnapshot(snapshotRef);
      const key = `${ano}-${mes}`;
      state.annual[key] = { ...currentAnnualSummary(), snapshot: cloneMonthlySnapshot() };
      state.selectedMonthKey = key;
      writeStorage('painel_ref_annual_v32', state.annual);
      applySnapshot(atual);
    }

    if(prodRows.length){
      const key = `${ano}-${mes}`;
      state.annualProd[key] = {
        documentos: (state.__ultimoExcelProdutividade || []).filter(x => ['ctrc','ost'].includes(normalizeDocType(x.tipo))).reduce((s,x)=>s+Number(x.quantidade||0),0),
        rows: JSON.parse(JSON.stringify(state.__ultimoExcelProdutividade || []))
      };
      writeStorage('painel_ref_annual_prod_v36', state.annualProd);
    }

    await fetchRemoteMonthKeys();
    refreshMonthViewSelect();
    await loadMonthFromSupabase(`${ano}-${mes}`);
    renderAll();

    if(statusEl) statusEl.textContent = 'Reimportação concluída: ' + refRows.length + ' refaturamento(s) e ' + prodRows.length + ' produtividade(s).';
    alert('Mês ' + mes + '/' + ano + ' reimportado com segurança.\n\nRegistros de refaturamento gravados: ' + refRows.length + '\nRegistros de produtividade gravados: ' + prodRows.length);
  }catch(err){
    console.error('Erro na reimportação segura:', err);
    if(statusEl) statusEl.textContent = 'Erro ao reimportar mês: ' + (err?.message || err);
    alert('Erro ao reimportar mês: ' + (err?.message || err));
  }
}

window.reimportarMesSeguroV12 = reimportarMesSeguroV12;
window.replaceMesSupabase = reimportarMesSeguroV12;
window.substituirMesNaSupabase = reimportarMesSeguroV12;
window.substituirMesSupabase = reimportarMesSeguroV12;

function ligarBotaoReimportarMesSeguroV15Final(){
  const btn = document.getElementById('btnReimportarMesSeguro');
  if(!btn) return;
  btn.onclick = function(e){
    e.preventDefault();
    reimportarMesSeguroV12();
  };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ligarBotaoReimportarMesSeguroV15Final);
}else{
  ligarBotaoReimportarMesSeguroV15Final();
}
