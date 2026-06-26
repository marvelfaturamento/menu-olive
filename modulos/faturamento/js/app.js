/*
  Faturamento v1 modular
  - Extraído do HTML original.
  - CSS separado em css/faturamento.css.
  - JavaScript separado em js/app.js.
  - Lógica preservada.
*/

// 🔐 Acesso vindo do menu pai
const MENU_PAI_URL = "https://menu-rho-olive.vercel.app/";
const params = new URLSearchParams(window.location.search);
const perfil = (params.get("perfil") || "").trim().toLowerCase();
const usuario = params.get("usuario") || "";
const usuarioRef = (params.get("usuarioRef") || "").trim();

if (false) { /* acesso direto liberado */ }

function aclNormUser(v){
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function aclRestritoPorUsuario(){ return false; }
function aclUserMatch(v){ return true; }

if (window.Chart && window.ChartDataLabels) Chart.register(ChartDataLabels);

function setText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setClass(id, value){
  const el = document.getElementById(id);
  if (el) el.className = value;
}


function openPage(pageId){
  document.querySelectorAll('.navbtn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  document.querySelectorAll('.page').forEach(page=>{
    page.classList.toggle('active', page.id === pageId);
  });

  setTimeout(()=>{
    try{
      if(pageId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
      if(pageId === 'diario' && typeof renderDiario === 'function') renderDiario();
      if(pageId === 'graficos' && typeof renderGraficos === 'function') renderGraficos();
      if(pageId === 'anual' && typeof renderAnual === 'function') renderAnual();
      if(pageId === 'config' && typeof updateMetaPreview === 'function') updateMetaPreview();
    }catch(e){
      console.warn('Falha ao renderizar aba:', e);
    }
  }, 80);
}
window.openPage = openPage;

/* COLE AS CREDENCIAIS ENTRE ASPAS SIMPLES, EM UMA LINHA SÓ */
const SUPABASE_A = {
  url: 'https://rhjtyyrlctwetjhnaidu.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoanR5eXJsY3R3ZXRqaG5haWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzE2NzMsImV4cCI6MjA5MTgwNzY3M30.79U7lcPIG511u2_3ExG32VowakoWyWTfTniW9hHrhRE',
  brutoTable: 'faturamento_bruto',
  brutoDateCol: 'data',
  brutoCol: 'total_bruto',
  interCol: 'internacional',
  nacCol: 'nacional',
  metasTable: 'metas_faturamento',
  metasMonthCol: 'mes',
  metasValueCol: 'valor_meta'
};

const SUPABASE_B = {
  url: 'https://bcchonskglushqbnwcni.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjY2hvbnNrZ2x1c2hxYm53Y25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkxNDUsImV4cCI6MjA5MTMyNTE0NX0.M-yWHlHMFHLE9T5DlJ6nDzutYjRjavHEGvZCH9o2AXg',
  table: 'refaturamento_importado',
  refCol: 'debito',
  substCol: 'frete_substituto',
  tipoCol: 'tipo',
  mesCol: 'mes',
  anoCol: 'ano'
};

function hasSupabaseConfig(){
  return !!(SUPABASE_A.url && SUPABASE_A.anonKey && SUPABASE_B.url && SUPABASE_B.anonKey);
}

const state = { brutoRows: [], refRows: [], metas: {}, charts: {} };

function parseBR(v){
  if(v==null||v==='') return 0;
  if(typeof v==='number') return v;
  let s=String(v).trim().replace(/\s/g,'');
  if(s.includes('.')&&s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')&&!s.includes('.')) s=s.replace(',','.');
  return Number(s)||0;
}
function fmtMoney(v){ return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(v){ return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'; }
function shortNumber(v){
  const n=Number(v||0);
  if(Math.abs(n)>=1_000_000) return (n/1_000_000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' mi';
  if(Math.abs(n)>=1_000) return (n/1_000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' mil';
  return n.toLocaleString('pt-BR',{maximumFractionDigits:0});
}
function normalizeDate(raw){
  if(!raw&&raw!==0) return null;
  if(raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0,10);
  if(typeof raw==='number'){
    const d=new Date(Math.round((raw-25569)*86400*1000));
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  const s=String(raw).trim();
  let m=s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return s;
  const d=new Date(s);
  if(!isNaN(d)) return d.toISOString().slice(0,10);
  return null;
}
function normalizeMonthDate(raw){
  const s = normalizeDate(raw);
  return s ? s.slice(0,7) + '-01' : null;
}
function monthKeyFromDate(dateStr){ return dateStr?.slice(0,7); }
function daysInMonth(monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  return new Date(y,m,0).getDate();
}
const monthNames=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function prettyMonth(monthKey){
  if(!monthKey) return '-';
  const [y,m]=monthKey.split('-').map(Number);
  return `${monthNames[m-1]} de ${y}`;
}

function saveLocalMetas(){ localStorage.setItem('painel_bi_metas', JSON.stringify(state.metas)); }
function loadLocal(){
  try{ state.metas = JSON.parse(localStorage.getItem('painel_bi_metas') || '{}'); }
  catch{ state.metas = {}; }
}

function allMonthKeys(){
  const set=new Set();
  state.brutoRows.forEach(r=>set.add(monthKeyFromDate(r.date)));
  state.refRows.forEach(r=>set.add(r.monthKey));
  Object.keys(state.metas).forEach(k=>set.add(k));
  return Array.from(set).filter(Boolean).sort();
}
function allYears(){ return Array.from(new Set(allMonthKeys().map(k=>k.slice(0,4)))).sort(); }
function setSelectOptions(select, values, formatter){
  const current=select.value;
  select.innerHTML='';
  values.forEach(v=>{
    const opt=document.createElement('option');
    opt.value=v;
    opt.textContent=formatter ? formatter(v) : v;
    select.appendChild(opt);
  });
  if(values.includes(current)) select.value=current;
  else if(values.length) select.value=values[values.length-1];
}
function intensityColor(diff, metaDia){
  if(!metaDia) return 'rgba(255,255,255,.03)';
  const ratio=Math.min(Math.abs(diff)/metaDia,1);
  return diff>=0 ? `rgba(31,193,107,${0.14+ratio*0.42})` : `rgba(239,77,97,${0.14+ratio*0.42})`;
}

function detectHeader(obj, candidates){
  const keys=Object.keys(obj||{});
  return keys.find(k=>candidates.some(c=>k.toLowerCase().includes(c)));
}


function parseReportLikeGrid(grid){
  const imported=[];
  let mode='main';
  let valorCol = -1;

  for(const row of grid){
    const normalized = row.map(v => String(v).trim());
    const joined = normalized.join(' ').trim();
    if(!joined) continue;

    if(/FRETE INTERNACIONAL/i.test(joined)){ mode='inter'; continue; }
    if(/FRETE NACIONAL/i.test(joined)){ mode='nac'; continue; }

    const vrIdx = normalized.findIndex(v => /valor realizado/i.test(v));
    if(vrIdx > 0 && normalized.some(v => /^data$/i.test(v))){
      valorCol = vrIdx - 1;
      continue;
    }

    const dateIdx = normalized.findIndex(v => /^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(v));
    if(dateIdx === -1) continue;

    const date = normalizeDate(normalized[dateIdx]);
    if(!date) continue;

    let found = imported.find(r=>r.date===date);
    if(!found){
      found = {date, bruto:0, inter:0, nac:0, source:'Excel'};
      imported.push(found);
    }

    let valor = 0;

    if(valorCol >= 0 && valorCol < row.length){
      valor = parseBR(row[valorCol]);
    }

    if(!valor){
      const nums = row
        .slice(dateIdx + 1)
        .map(v => parseBR(v))
        .filter(v => Number.isFinite(v) && v > 0);
      if(nums.length){
        valor = Math.max(...nums.slice(0, 6));
      }
    }

    if(mode === 'main') found.bruto = valor;
    else if(mode === 'inter') found.inter = valor;
    else if(mode === 'nac') found.nac = valor;
  }

  return imported;
}


function parseExcelToRows(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const grid=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        let imported=parseReportLikeGrid(grid);

        if(!imported.length){
          const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
          if(rows.length){
            const sample=rows[0];
            const dateKey=detectHeader(sample,['data','date']);
            const totalKey=detectHeader(sample,['valor realizado','realizado','total','bruto']);
            const interKey=detectHeader(sample,['internacional','inter']);
            const nacKey=detectHeader(sample,['nacional','nac']);
            imported=rows.map(r=>{
              const date=normalizeDate(r[dateKey]);
              if(!date) return null;
              return {date, bruto:parseBR(r[totalKey]), inter:parseBR(r[interKey]), nac:parseBR(r[nacKey]), source:'Excel'};
            }).filter(Boolean);
          }
        }
        resolve(imported.sort((a,b)=>a.date.localeCompare(b.date)));
      }catch(err){ reject(err); }
    };
    reader.onerror=reject;
    reader.readAsArrayBuffer(file);
  });
}

async function fetchRows(url, key, table, cols){
  const endpoint =
    `${url}/rest/v1/${table}` +
    `?select=${encodeURIComponent(cols.join(','))}` +
    `&limit=5000`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ${res.status} em ${table}: ${txt}`);
  }
  return await res.json();
}

async function loadBrutoFromSupabaseA(){
  if(!SUPABASE_A.url || !SUPABASE_A.anonKey) throw new Error('Preencha SUPABASE_A no início do HTML.');
  const rows=await fetchRows(SUPABASE_A.url,SUPABASE_A.anonKey,SUPABASE_A.brutoTable,[SUPABASE_A.brutoDateCol,SUPABASE_A.brutoCol,SUPABASE_A.interCol,SUPABASE_A.nacCol]);
  state.brutoRows = Object.values(
    rows.map(r=>({
      date: normalizeDate(r[SUPABASE_A.brutoDateCol]),
      bruto: parseBR(r[SUPABASE_A.brutoCol]),
      inter: parseBR(r[SUPABASE_A.interCol]),
      nac: parseBR(r[SUPABASE_A.nacCol]),
      source: 'Supabase A'
    })).filter(r=>r.date).reduce((acc, r) => {
      acc[r.date] = r;
      return acc;
    }, {})
  );
}

async function loadRefaturadoFromSupabaseB(){
  if(!SUPABASE_B.url || !SUPABASE_B.anonKey) throw new Error('Preencha SUPABASE_B no início do HTML.');
  const cols=[SUPABASE_B.mesCol, SUPABASE_B.anoCol, SUPABASE_B.tipoCol, SUPABASE_B.refCol, SUPABASE_B.substCol];
  const rows = await fetchRows(SUPABASE_B.url,SUPABASE_B.anonKey,SUPABASE_B.table,cols);
  state.refRows = rows.map(r => {
    const tipo = String(r[SUPABASE_B.tipoCol] || '').toLowerCase();
    return {
      monthKey: `${String(r[SUPABASE_B.anoCol]).padStart(4,'0')}-${String(r[SUPABASE_B.mesCol]).padStart(2,'0')}`,
      setorValor: tipo.includes('setor') ? parseBR(r[SUPABASE_B.refCol]) : 0,
      substValor: parseBR(r[SUPABASE_B.substCol])
    };
  }).filter(r => r.monthKey);
}

async function loadMetasFromSupabaseA(){
  if(!SUPABASE_A.url || !SUPABASE_A.anonKey) return;
  const rows=await fetchRows(SUPABASE_A.url,SUPABASE_A.anonKey,SUPABASE_A.metasTable,[SUPABASE_A.metasMonthCol,SUPABASE_A.metasValueCol]);
  state.metas={};
  rows.forEach(r=>{
    const d = normalizeMonthDate(r[SUPABASE_A.metasMonthCol]);
    if (!d) return;
    state.metas[d.slice(0,7)] = parseBR(r[SUPABASE_A.metasValueCol]);
  });
  saveLocalMetas();
}

async function refreshAllFromSupabases(showAlert=true){
  try{
    state.brutoRows = [];
    state.refRows = [];
    await Promise.all([
      loadBrutoFromSupabaseA(),
      loadRefaturadoFromSupabaseB(),
      loadMetasFromSupabaseA().catch(()=>{}),
      (typeof carregarValoresReaisSupabaseV12 === 'function' ? carregarValoresReaisSupabaseV12().catch(()=>{}) : Promise.resolve())
    ]);
    renderAll();
    if (showAlert) alert('Leitura atualizada de Supabase A + B.');
  }catch(err){
    if (showAlert) alert(`Falha ao atualizar dados: ${err.message}`);
    else console.error(err);
  }
}

async function upsertBrutoToSupabaseA(rows){
  if(!SUPABASE_A.url || !SUPABASE_A.anonKey) throw new Error('Preencha SUPABASE_A no início do HTML.');
  const payload = rows.map(r=>({
    [SUPABASE_A.brutoDateCol]: r.date,
    [SUPABASE_A.brutoCol]: Number(r.bruto||0),
    [SUPABASE_A.interCol]: Number(r.inter||0),
    [SUPABASE_A.nacCol]: Number(r.nac||0),
  }));
  const res=await fetch(`${SUPABASE_A.url}/rest/v1/${SUPABASE_A.brutoTable}?on_conflict=${encodeURIComponent(SUPABASE_A.brutoDateCol)}`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_A.anonKey,
      Authorization:`Bearer ${SUPABASE_A.anonKey}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=representation'
    },
    body:JSON.stringify(payload)
  });
  if(!res.ok) throw new Error(`Falha ao importar bruto: ${res.status} ${await res.text()}`);
}

async function saveMetaToSupabase(monthKey, value){
  if(!SUPABASE_A.url || !SUPABASE_A.anonKey){
    state.metas[monthKey] = Number(value||0);
    saveLocalMetas();
    return;
  }
  const payload=[{
    [SUPABASE_A.metasMonthCol]: `${monthKey}-01`,
    [SUPABASE_A.metasValueCol]: Number(value||0)
  }];
  const res=await fetch(`${SUPABASE_A.url}/rest/v1/${SUPABASE_A.metasTable}?on_conflict=${encodeURIComponent(SUPABASE_A.metasMonthCol)}`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_A.anonKey,
      Authorization:`Bearer ${SUPABASE_A.anonKey}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=representation'
    },
    body:JSON.stringify(payload)
  });
  if(!res.ok) throw new Error(`Falha ao salvar meta: ${res.status} ${await res.text()}`);
}

async function deleteMetaFromSupabase(monthKey){
  if(!SUPABASE_A.url || !SUPABASE_A.anonKey){
    delete state.metas[monthKey];
    saveLocalMetas();
    return;
  }
  const date=`${monthKey}-01`;
  const res=await fetch(`${SUPABASE_A.url}/rest/v1/${SUPABASE_A.metasTable}?${SUPABASE_A.metasMonthCol}=eq.${date}`,{
    method:'DELETE',
    headers:{apikey:SUPABASE_A.anonKey, Authorization:`Bearer ${SUPABASE_A.anonKey}`}
  });
  if(!res.ok) throw new Error(`Falha ao excluir meta: ${res.status} ${await res.text()}`);
}

function renderMetaList(){
  const keys = Object.keys(state.metas).sort();
  metaList.innerHTML = keys.length
    ? keys.map(k=>`<div class="meta-pill"><span>${prettyMonth(k)}</span><span>${fmtMoney(state.metas[k])}</span></div>`).join('')
    : '<div class="hint">Nenhuma meta cadastrada.</div>';
}

function updateMetaPreview(){
  const monthKey = dashboardMonth.value || allMonthKeys().slice(-1)[0] || metaMonthInput.value;
  configMetaPreview.textContent = fmtMoney(state.metas[monthKey] || 0);
}

function getMonthDataset(monthKey){
  const dim=daysInMonth(monthKey);
  const map=new Map();
  for(let d=1; d<=dim; d++){
    const date=`${monthKey}-${String(d).padStart(2,'0')}`;
    map.set(date,{date, bruto:0, inter:0, nac:0, setor:0, substituicao:0, liquido:0});
  }

  state.brutoRows.filter(r=>monthKeyFromDate(r.date)===monthKey).forEach(r=>{
    const row=map.get(r.date);
    if(!row) return;
    row.bruto += Number(r.bruto||0);
    row.inter += Number(r.inter||0);
    row.nac += Number(r.nac||0);
  });

  const monthB = state.refRows.filter(r=>r.monthKey===monthKey);
  const setorMes = monthB.reduce((s,r)=>s + Number(r.setorValor||0),0);
  const substMes = monthB.reduce((s,r)=>s + Number(r.substValor||0),0);

  const diasComBruto = Array.from(map.values()).filter(r=>r.bruto>0).length || dim;
  const setorDia = setorMes / diasComBruto;
  const substDia = substMes / diasComBruto;

  Array.from(map.values()).forEach(r=>{
    if(r.bruto>0){
      r.setor = setorDia;
      r.substituicao = substDia;
    }
    r.liquido = r.bruto - r.setor;
  });

  return Array.from(map.values());
}

function aggregateYear(year){
  const months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
  return months.map(monthKey=>{
    const rows=getMonthDataset(monthKey);
    const bruto=rows.reduce((s,r)=>s+r.bruto,0);
    const setor=rows.reduce((s,r)=>s+r.setor,0);
    const substituicao=rows.reduce((s,r)=>s+r.substituicao,0);
    const liquido=rows.reduce((s,r)=>s+r.liquido,0);
    const inter=rows.reduce((s,r)=>s+r.inter,0);
    const nac=rows.reduce((s,r)=>s+r.nac,0);
    const meta=Number(state.metas[monthKey] || 0);
    return {monthKey, bruto, setor, substituicao, liquido, inter, nac, meta, refPct: bruto ? ((setor + substituicao)/bruto)*100 : 0};
  });
}

function renderEmpty(){
  const ids = ['cardBruto','cardRef','cardSubst','cardLiquido','cardMeta','cardFalta','cardAtingido','cardErroPct','cardInter','cardNac','cardMediaDia','cardPrecisaDia','cardMetaDia','cardPartInter','cardPartNac','cardMes','cardBestDay','cardBestVal','cardWorstDay','cardWorstVal'];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(id.toLowerCase().includes('pct') || id==='cardAtingido') el.textContent='0,0%';
    else if(id==='cardMes') el.textContent='-';
    else if(id==='cardBestDay' || id==='cardWorstDay') el.textContent='-';
    else el.textContent='0,00';
  });
  setText('dashSubtitle','Sem dados carregados.');
  setText('cardInterPct','0,0% da receita');
  setText('cardNacPct','0,0% da receita');
  setText('cardDaysInMonth','0 dias no mês');
  setText('cardStatus','Sem dados');
  setClass('cardStatus','pill bad');
  const body=document.getElementById('diarioBody');
  if(body) body.innerHTML='';
  Object.values(state.charts||{}).forEach(ch=>{ try{ch.destroy()}catch(e){} });
  state.charts={};
}

function renderDashboard(){
  const monthKey=dashboardMonth.value || allMonthKeys().slice(-1)[0];
  const rows=getMonthDataset(monthKey);
  const bruto=rows.reduce((s,r)=>s+r.bruto,0);
  const setor=rows.reduce((s,r)=>s+r.setor,0);
  const substituicao=rows.reduce((s,r)=>s+r.substituicao,0);
  const valorLiquido=rows.reduce((s,r)=>s+r.liquido,0);
  const inter=rows.reduce((s,r)=>s+r.inter,0);
  const nac=rows.reduce((s,r)=>s+r.nac,0);
  const meta=state.metas[monthKey]||0;
  const dim=daysInMonth(monthKey);
  const metaDia=dim ? (meta/dim) : 0;
  const baseMeta = bruto;
  const falta=meta-baseMeta;
  const atingido=meta ? (baseMeta/meta)*100 : 0;
  const interPct=bruto ? (inter/bruto)*100 : 0;
  const nacPct=bruto ? (nac/bruto)*100 : 0;
  const refPct=bruto ? ((setor + substituicao)/bruto)*100 : 0;
  const mediaDia=dim ? (baseMeta/dim) : 0;
  const precisaDia=meta ? Math.max(0,falta/dim) : 0;
  const populated=rows.filter(r=>r.bruto>0);

  setText('cardBruto', fmtMoney(bruto));
  setText('cardRef', fmtMoney(setor));
  setText('cardSubst', fmtMoney(substituicao));
  setText('cardLiquido', fmtMoney(valorLiquido));
  setText('cardMeta', fmtMoney(meta));

  const faltaDisplay = falta < 0 ? Math.abs(falta) : falta;
  setText('cardFalta', fmtMoney(faltaDisplay));
  setClass('cardFalta', `value ${falta>0?'bad':'good'} sm`);

  setText('cardAtingido', fmtPct(atingido));
  if(atingido < 80) setClass('cardAtingido','value bad');
  else if(atingido < 100) setClass('cardAtingido','value warn');
  else setClass('cardAtingido','value good');

  setText('cardInter', fmtMoney(inter));
  setText('cardNac', fmtMoney(nac));
  setText('cardInterPct', `${fmtPct(interPct)} da receita`);
  setText('cardNacPct', `${fmtPct(nacPct)} da receita`);
  setText('cardMediaDia', fmtMoney(mediaDia));
  setText('cardPrecisaDia', fmtMoney(precisaDia));
  setText('cardMetaDia', fmtMoney(metaDia));
  setText('cardDaysInMonth', `${dim} dias no mês`);
  setText('cardErroPct', fmtPct(refPct));
  setText('cardPartInter', fmtPct(interPct));
  setText('cardPartNac', fmtPct(nacPct));
  setText('cardMes', prettyMonth(monthKey));

  const baseRows = populated.length ? populated : rows;
  let best=baseRows[0], worst=baseRows[0];
  baseRows.forEach(r=>{ if(r.liquido>best.liquido) best=r; if(r.liquido<worst.liquido) worst=r; });
  setText('cardBestDay', best?best.date.split('-').reverse().join('/'): '-');
  setText('cardBestVal', best?fmtMoney(best.liquido):'0,00');
  setText('cardWorstDay', worst?worst.date.split('-').reverse().join('/'): '-');
  setText('cardWorstVal', worst?fmtMoney(worst.liquido):'0,00');

  setText('dashSubtitle', `Período com ${populated.length} dia(s) carregado(s). Último lançamento: ${populated.length ? populated[populated.length-1].date.split('-').reverse().join('/') : '-'}.`);

  if(!meta){ setText('cardStatus','Meta não definida'); setClass('cardStatus','pill bad'); }
  else if(baseMeta>=meta){ setText('cardStatus','Meta batida'); setClass('cardStatus','pill good'); }
  else { setText('cardStatus','Abaixo da meta'); setClass('cardStatus','pill bad'); }

  if(diarioMonth.value!==monthKey) diarioMonth.value=monthKey;
}

function renderDiario(){
  const monthKey=diarioMonth.value || allMonthKeys().slice(-1)[0];
  const rows=getMonthDataset(monthKey);
  const meta=state.metas[monthKey]||0;
  const metaDia=meta/daysInMonth(monthKey);

  if(!window.diarioBody) return;
  diarioBody.innerHTML = rows.map((r,i)=>{
    const valorBrutoDia = Number(r.bruto || 0);
    const valorLiquidoDia = r.bruto - r.setor;
    const diff=valorBrutoDia-metaDia;
    return `<tr style="background:${intensityColor(diff, metaDia)}">
      <td>${String(i+1).padStart(2,'0')}/${monthKey.slice(5,7)}/${monthKey.slice(0,4)}</td>
      <td>${fmtMoney(r.bruto)}</td>
      <td>${fmtMoney(r.setor)}</td>
      <td>${fmtMoney(r.setor)}</td>
      <td>${fmtMoney(r.substituicao)}</td>
      <td>${fmtMoney(valorLiquidoDia)}</td>
      <td>${fmtMoney(metaDia)}</td>
      <td>${fmtMoney(diff)}</td>
    </tr>`;
  }).join('');

  if(dashboardMonth.value!==monthKey){
    dashboardMonth.value=monthKey;
    renderDashboard();
    renderGraficos();
    updateMetaPreview();
  }
}

function destroyChart(key){ if(state.charts[key]){ state.charts[key].destroy(); delete state.charts[key]; } }

function chartOpts(currency=false, datalabels=false, percentAxis=false){
  return {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{labels:{color:'#eef4ff'}},
      datalabels:datalabels ? {
        color:'#fff',
        formatter:(v)=> currency ? shortNumber(v) : `${Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`,
        anchor:'end', align:'top', offset:2, clamp:true, font:{size:10,weight:'700'}
      } : {display:false}
    },
    scales:{
      x:{ticks:{color:'#d9e4ff'},grid:{color:'rgba(255,255,255,.06)'}},
      y:{ticks:{color:'#d9e4ff', callback:(v)=>percentAxis?`${v}%`:shortNumber(v)}, grid:{color:'rgba(255,255,255,.06)'}}
    }
  };
}

function renderGraficos(){
  const monthKey=dashboardMonth.value || allMonthKeys().slice(-1)[0];
  const rows=getMonthDataset(monthKey);
  const labels=rows.map((_,i)=>String(i+1));
  const total=rows.map(r=>r.liquido);
  const inter=rows.map(r=>r.inter);
  const nac=rows.map(r=>r.nac);

  destroyChart('comparativo');
  state.charts.comparativo=new Chart(comparativoChart,{
    type:'line',
    data:{labels,datasets:[
      {label:'Lucro real',data:total,borderColor:'#35b9ff',backgroundColor:'transparent',borderWidth:3,tension:.3},
      {label:'Internacional',data:inter,borderColor:'#ff5f96',backgroundColor:'transparent',borderWidth:3,tension:.3},
      {label:'Nacional',data:nac,borderColor:'#ffb23e',backgroundColor:'transparent',borderWidth:3,tension:.3}
    ]},
    options:chartOpts(true,false,false)
  });

  destroyChart('pizza');
  const interSum=inter.reduce((s,v)=>s+v,0), nacSum=nac.reduce((s,v)=>s+v,0);
  state.charts.pizza=new Chart(pizzaChart,{
    type:'pie',
    data:{labels:['Internacional','Nacional'],datasets:[{data:[interSum,nacSum],backgroundColor:['#35b9ff','#ff5f96'],borderColor:'#1c3165',borderWidth:2}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#eef4ff'}},
        datalabels:{
          color:'#fff',
          formatter:(v,ctx)=>{ const sum=ctx.chart.data.datasets[0].data.reduce((s,n)=>s+n,0); const pct=sum?(v/sum)*100:0; return `${fmtPct(pct)}\n${shortNumber(v)}`; },
          font:{size:11,weight:'700'}
        }
      }
    }
  });

  [
    ['total','totalChart','Lucro real','#35b9ff',total],
    ['inter','interChart','Internacional','#ff5f96',inter],
    ['nac','nacChart','Nacional','#ffb23e',nac]
  ].forEach(([key,id,label,color,data])=>{
    destroyChart(key);
    state.charts[key]=new Chart(document.getElementById(id),{
      type:'bar',
      data:{labels,datasets:[{label,data,backgroundColor:color}]},
      options:chartOpts(true,false,false)
    });
  });
}

function renderAnual(){
  const year=annualYear.value || allYears().slice(-1)[0];
  const agg=aggregateYear(year);
  const labels=agg.map(r=>r.monthKey.slice(5,7));
  const bruto=agg.map(r=>r.bruto);
  const liquido=agg.map(r=>r.liquido);
  const meta=agg.map(r=>r.meta);
  const inter=agg.map(r=>r.inter);
  const nac=agg.map(r=>r.nac);
  const pct=agg.map(r=>r.refPct);

  destroyChart('annualMain');
  state.charts.annualMain=new Chart(annualMainChart,{
    type:'line',
    data:{labels,datasets:[
      {label:'Bruto',data:bruto,borderColor:'#35b9ff',backgroundColor:'transparent',borderWidth:3,tension:.3},
      {label:'Lucro real',data:liquido,borderColor:'#1fc16b',backgroundColor:'transparent',borderWidth:3,tension:.3},
      {label:'Meta',data:meta,borderColor:'#f2c14f',backgroundColor:'transparent',borderWidth:3,borderDash:[8,5],tension:0,pointRadius:3}
    ]},
    options:chartOpts(true,false,false)
  });

  destroyChart('annualPct');
  state.charts.annualPct=new Chart(annualPctChart,{
    type:'bar',
    data:{labels,datasets:[{label:'% refaturado + substituto',data:pct,backgroundColor:'#f2c14f'}]},
    options:chartOpts(false,true,true)
  });

  destroyChart('annualInterNac');
  state.charts.annualInterNac=new Chart(annualInterNacChart,{
    type:'line',
    data:{labels,datasets:[
      {label:'Internacional',data:inter,borderColor:'#ff5f96',backgroundColor:'transparent',borderWidth:3,tension:.3},
      {label:'Nacional',data:nac,borderColor:'#ffb23e',backgroundColor:'transparent',borderWidth:3,tension:.3}
    ]},
    options:chartOpts(true,false,false)
  });

  destroyChart('annualBruto');
  state.charts.annualBruto=new Chart(annualBrutoChart,{
    type:'bar',
    data:{labels,datasets:[{label:'Bruto',data:bruto,backgroundColor:'#35b9ff'}]},
    options:chartOpts(true,false,false)
  });

  destroyChart('annualLiquido');
  state.charts.annualLiquido=new Chart(annualLiquidoChart,{
    type:'bar',
    data:{labels,datasets:[{label:'Lucro real',data:liquido,backgroundColor:'#1fc16b'}]},
    options:chartOpts(true,false,false)
  });
}


function renderValidation(){
  const monthKey = dashboardMonth.value || allMonthKeys().slice(-1)[0];
  if(!monthKey){
    setText('valBruto','0,00');
    setText('valSetor','0,00');
    setText('valLiquido','0,00');
    setText('valStatus','Sem dados');
    setClass('valStatus','value bad');
    setText('valHelp','Nenhum mês encontrado');
    return;
  }

  const rows = getMonthDataset(monthKey);
  const bruto = rows.reduce((s,r)=>s+r.bruto,0);
  const setor = rows.reduce((s,r)=>s+r.setor,0);
  const liquido = rows.reduce((s,r)=>s+r.liquido,0);
  const recalculado = bruto - setor;
  const diff = Math.abs(liquido - recalculado);

  setText('valBruto', fmtMoney(bruto));
  setText('valSetor', fmtMoney(setor));
  setText('valLiquido', fmtMoney(liquido));

  if(bruto === 0){
    setText('valStatus','Sem bruto');
    setClass('valStatus','value warn');
    setText('valHelp','O mês está cadastrado, mas sem valores de faturamento.');
  } else if(diff <= 0.01){
    setText('valStatus','OK');
    setClass('valStatus','value good');
    setText('valHelp','Leitura e cálculo do mês conferidos.');
  } else {
    setText('valStatus','Divergência');
    setClass('valStatus','value bad');
    setText('valHelp',`Diferença encontrada: ${fmtMoney(diff)}`);
  }
}

function renderAll(){
  const months=allMonthKeys();
  renderMetaList();
  if(!months.length){
    dashboardMonth.innerHTML='';
    diarioMonth.innerHTML='';
    annualYear.innerHTML='';
    renderEmpty();
    renderValidation();
    updateMetaPreview();
    return;
  }
  setSelectOptions(dashboardMonth, months, prettyMonth);
  setSelectOptions(diarioMonth, months, prettyMonth);
  setSelectOptions(annualYear, allYears());
  renderDashboard();
  renderDiario();
  renderGraficos();
  renderAnual();
  renderValidation();
  updateMetaPreview();
}

function loadExample(){
  state.brutoRows=[
    {date:'2026-03-25', bruto:2927677.63, inter:1718780.38, nac:1037769.47, source:'Exemplo'},
    {date:'2026-03-26', bruto:3138487.91, inter:1497027.47, nac:1193741.67, source:'Exemplo'},
    {date:'2026-03-27', bruto:3904473.61, inter:2646197.81, nac:1107602.23, source:'Exemplo'},
    {date:'2026-03-28', bruto:1782582.11, inter:998743.50, nac:744351.26, source:'Exemplo'},
    {date:'2026-03-29', bruto:550552.79, inter:82093.03, nac:281462.83, source:'Exemplo'},
    {date:'2026-03-30', bruto:2357596.88, inter:1260349.24, nac:956220.34, source:'Exemplo'},
    {date:'2026-03-31', bruto:4462153.46, inter:2165232.82, nac:1167474.23, source:'Exemplo'}
  ];
  state.refRows=[
    {monthKey:'2026-03', setorValor:894217.11, substValor:283322.10}
  ];
  renderAll();
}



function aplicarPermissoesFaturamento(){
  const permissoesFaturamento = {
    admin: ["dashboard", "diario", "graficos", "anual", "config", "registros", "conciliacao", "cadastro"],
    operacional: ["dashboard", "diario", "graficos", "anual", "registros", "conciliacao", "cadastro"],
    consulta: ["dashboard", "diario", "graficos", "anual"]
  };
  const liberadas = permissoesFaturamento[perfil] || permissoesFaturamento.consulta;
  document.querySelectorAll('[data-page]').forEach(btn => {
    const page = btn.getAttribute('data-page');
    if(!liberadas.includes(page)) btn.style.display = 'none';
  });
  const activePage = document.querySelector('.page.active');
  if(activePage && !liberadas.includes(activePage.id)){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
    const fallback = liberadas[0] || 'dashboard';
    document.getElementById(fallback)?.classList.add('active');
    document.querySelector(`[data-page="${fallback}"]`)?.classList.add('active');
  }
}
aplicarPermissoesFaturamento();


if(window.dashboardMonth) dashboardMonth.addEventListener('change',()=>{ renderDashboard(); renderDiario(); renderGraficos(); updateMetaPreview(); });
if(window.diarioMonth) diarioMonth.addEventListener('change',()=>{ renderDiario(); dashboardMonth.value=diarioMonth.value; renderDashboard(); renderGraficos(); updateMetaPreview(); });
if(window.annualYear) annualYear.addEventListener('change',renderAnual);

if(window.excelInput) excelInput.addEventListener('change', async e=>{
  const file = e.target.files[0];
  if (!file) return;
  try{
    const rows = await parseExcelToRows(file);
    state.brutoRows = rows;
    renderAll();
    alert(`Excel lido com sucesso: ${rows.length} linha(s). Clique em "Salvar" para gravar na base.`);
  }catch(err){
    alert(`Falha ao ler Excel: ${err.message}`);
  }
});

if(window.importToSupabaseBtn) importToSupabaseBtn.addEventListener('click', async ()=>{
  const file = excelInput.files[0];
  if (!file){ alert('Selecione o Excel primeiro.'); return; }
  try{
    const rows = await parseExcelToRows(file);
    await upsertBrutoToSupabaseA(rows);
    await refreshAllFromSupabases(false);
    renderAll();
    alert(`Importação concluída. ${rows.length} linha(s) enviadas para a Supabase A com atualização por data.`);
  }catch(err){
    alert(err.message);
  }
});

if(window.refreshBtn) refreshBtn.addEventListener('click', ()=>refreshAllFromSupabases(true));
if(window.refreshMetasBtn) refreshMetasBtn.addEventListener('click', async ()=>{
  try{
    await loadMetasFromSupabaseA();
    renderAll();
    alert('Metas atualizadas.');
  }catch(err){ alert(err.message); }
});

if(window.saveMetaBtn) saveMetaBtn.addEventListener('click', async ()=>{
  if(!metaMonthInput.value) return alert('Selecione um mês.');
  const value = parseBR(metaValueInput.value);
  try{
    await saveMetaToSupabase(metaMonthInput.value, value);
    state.metas[metaMonthInput.value] = value;
    saveLocalMetas();
    renderAll();
    alert('Meta salva.');
  }catch(err){ alert(err.message); }
});

if(window.deleteMetaBtn) deleteMetaBtn.addEventListener('click', async ()=>{
  if(!metaMonthInput.value) return alert('Selecione um mês.');
  try{
    await deleteMetaFromSupabase(metaMonthInput.value);
    delete state.metas[metaMonthInput.value];
    saveLocalMetas();
    renderAll();
    alert('Meta excluída.');
  }catch(err){ alert(err.message); }
});

if(window.loadExampleBtn) loadExampleBtn.addEventListener('click', loadExample);
if(window.clearImportedBtn) clearImportedBtn.addEventListener('click', ()=>{
  if(!confirm('Limpar dados carregados da tela?')) return;
  state.brutoRows=[];
  state.refRows=[];
  renderAll();
});
if(window.metaMonthInput) metaMonthInput.addEventListener('change', ()=>{
  metaValueInput.value = state.metas[metaMonthInput.value] || '';
  updateMetaPreview();
});


document.querySelectorAll('.navbtn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    openPage(btn.dataset.page);
  });
});

loadLocal();
metaMonthInput.value = new Date().toISOString().slice(0,7);
metaValueInput.value = state.metas[metaMonthInput.value] || '';
renderAll();

window.addEventListener('load', async () => {
  if(!hasSupabaseConfig()){
    console.warn('Preencha SUPABASE_A e SUPABASE_B no início do HTML antes de sincronizar.');
    return;
  }
  try{
    await refreshAllFromSupabases(false);
  }catch(err){
    console.error(err);
  }
});


/* =========================================================
   PATCH v11 - Valores Reais do Mês + Config visível
   Base limpa, sem Receitas Adicionais/Descontos.
   ========================================================= */

try{
  window.perfil = 'admin';
  window.usuario = window.usuario || 'Direto';
  window.usuarioRef = window.usuarioRef || '';
}catch(e){}

function liberarMenuConfigV11(){
  document.querySelectorAll('.navbtn').forEach(btn=>{
    btn.style.display = '';
    btn.hidden = false;
    btn.removeAttribute('hidden');
    btn.removeAttribute('disabled');
  });

  const configBtn = document.querySelector('.navbtn[data-page="config"]');
  if(configBtn){
    configBtn.style.display = '';
    configBtn.hidden = false;
    configBtn.removeAttribute('hidden');
    configBtn.removeAttribute('disabled');
  }

  const configPage = document.getElementById('config');
  if(configPage){
    configPage.hidden = false;
    configPage.removeAttribute('hidden');
  }
}

state.valoresReaisMes = state.valoresReaisMes || {};

function loadValoresReaisV11(){
  try{
    state.valoresReaisMes = JSON.parse(localStorage.getItem('painel_bi_valores_reais') || '{}');
  }catch(e){
    state.valoresReaisMes = {};
  }
}

function saveValoresReaisV11(){
  localStorage.setItem('painel_bi_valores_reais', JSON.stringify(state.valoresReaisMes || {}));
}

function getValoresReaisV11(monthKey){
  return (state.valoresReaisMes || {})[monthKey] || {};
}

function ensureValoresReaisUIV11(){
  const config = document.getElementById('config');
  if(!config) return;

  liberarMenuConfigV11();

  if(document.getElementById('valoresReaisV11')) return;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'valoresReaisV11';
  panel.style.marginTop = '16px';

  panel.innerHTML = `
    <h2>Valores Reais do Mês</h2>
    <div class="sub">Informe o valor final real do bruto e do líquido. Se não informar, o painel usa o cálculo normal.</div>
    <div class="meta-card">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div>
          <label>Mês</label>
          <input type="month" id="vrMesV11">
        </div>
        <div>
          <label>Valor Bruto Real</label>
          <input type="text" id="vrBrutoV11" placeholder="Ex.: 71000000">
        </div>
        <div>
          <label>Valor Líquido Real</label>
          <input type="text" id="vrLiquidoV11" placeholder="Ex.: 66000000">
        </div>
      </div>
      <div class="top-actions" style="margin-top:12px">
        <button id="vrSalvarV11" type="button">Salvar valores reais</button>
        <button id="vrExcluirV11" type="button">Excluir valores do mês</button>
      </div>
      <div id="vrListaV11" class="meta-list"></div>
    </div>
  `;

  const validationTitle = Array.from(config.querySelectorAll('h2')).find(h =>
    h.textContent.trim().toLowerCase().includes('validação')
  );

  if(validationTitle && validationTitle.closest('.panel')){
    config.insertBefore(panel, validationTitle.closest('.panel'));
  }else{
    config.appendChild(panel);
  }

  bindValoresReaisV11();
  renderValoresReaisV11();
}

function renderValoresReaisV11(){
  const box = document.getElementById('vrListaV11');
  if(!box) return;

  const keys = Object.keys(state.valoresReaisMes || {}).sort();
  box.innerHTML = keys.length
    ? keys.map(k=>{
        const v = state.valoresReaisMes[k] || {};
        return `<div class="meta-pill">
          <span>${prettyMonth(k)}</span>
          <span>Bruto: ${fmtMoney(v.bruto || 0)} | Líquido: ${fmtMoney(v.liquido || 0)}</span>
        </div>`;
      }).join('')
    : '<div class="hint">Nenhum valor real informado.</div>';
}

function bindValoresReaisV11(){
  const mes = document.getElementById('vrMesV11');
  const bruto = document.getElementById('vrBrutoV11');
  const liquido = document.getElementById('vrLiquidoV11');
  const salvar = document.getElementById('vrSalvarV11');
  const excluir = document.getElementById('vrExcluirV11');

  if(mes && !mes.value){
    mes.value = dashboardMonth?.value || allMonthKeys().slice(-1)[0] || '';
  }

  if(salvar && !salvar.__boundV11){
    salvar.__boundV11 = true;
    salvar.onclick = function(e){
      e.preventDefault();
      const key = mes?.value || dashboardMonth?.value;
      if(!key) return alert('Selecione o mês.');

      state.valoresReaisMes[key] = {
        bruto: parseBR(bruto?.value || 0),
        liquido: parseBR(liquido?.value || 0)
      };

      saveValoresReaisV11();
      renderValoresReaisV11();
      renderAll();
      alert('Valores reais salvos para ' + prettyMonth(key) + '.');
    };
  }

  if(excluir && !excluir.__boundV11){
    excluir.__boundV11 = true;
    excluir.onclick = function(e){
      e.preventDefault();
      const key = mes?.value || dashboardMonth?.value;
      if(!key) return;
      delete state.valoresReaisMes[key];
      saveValoresReaisV11();
      renderValoresReaisV11();
      renderAll();
      alert('Valores reais removidos de ' + prettyMonth(key) + '.');
    };
  }
}

// Ajusta dataset para usar bruto real/líquido real como valor final do mês.
if(!window.__getMonthDatasetOriginalV11 && typeof getMonthDataset === 'function'){
  window.__getMonthDatasetOriginalV11 = getMonthDataset;

  getMonthDataset = function(monthKey){
    const rows = window.__getMonthDatasetOriginalV11(monthKey);
    const real = getValoresReaisV11(monthKey);
    const brutoReal = Number(real.bruto || 0);
    const liquidoReal = Number(real.liquido || 0);

    if(!rows.length || (!brutoReal && !liquidoReal)){
      return rows;
    }

    const linhasBase = rows.filter(r => Number(r.bruto || 0) > 0);
    const alvo = linhasBase.length ? linhasBase : rows;

    if(brutoReal){
      const brutoAtual = rows.reduce((s,r)=>s + Number(r.bruto || 0),0);
      const deltaBruto = brutoReal - brutoAtual;
      const porLinha = deltaBruto / alvo.length;
      alvo.forEach(r=>{
        r.bruto = Number(r.bruto || 0) + porLinha;
      });
    }

    if(liquidoReal){
      const liquidoAtual = rows.reduce((s,r)=>s + Number(r.liquido || 0),0);
      const deltaLiquido = liquidoReal - liquidoAtual;
      const porLinha = deltaLiquido / alvo.length;
      alvo.forEach(r=>{
        r.liquido = Number(r.liquido || 0) + porLinha;
      });
    }

    return rows;
  };
}

// Ajusta % refaturado + substituto para usar BRUTO REAL quando houver valor real.
if(!window.__renderDashboardOriginalV11 && typeof renderDashboard === 'function'){
  window.__renderDashboardOriginalV11 = renderDashboard;

  renderDashboard = function(){
    window.__renderDashboardOriginalV11();

    const monthKey = dashboardMonth?.value || allMonthKeys().slice(-1)[0];
    const real = getValoresReaisV11(monthKey);
    const rows = getMonthDataset(monthKey);

    const setor = rows.reduce((s,r)=>s + Number(r.setor || 0),0);
    const subst = rows.reduce((s,r)=>s + Number(r.substituicao || 0),0);
    const brutoOperacional = rows.reduce((s,r)=>s + Number(r.bruto || 0),0);
    const baseImpacto = Number(real?.bruto || 0) > 0 ? Number(real.bruto) : brutoOperacional;

    setText('cardErroPct', fmtPct(baseImpacto ? ((setor + subst) / baseImpacto) * 100 : 0));
    const help = document.querySelector('#cardErroPct + .help');
    if(help) help.textContent = '(Refaturado + substituto) ÷ bruto real';
  };
}

// Ajusta anual para percentual usar BRUTO REAL.
if(!window.__aggregateYearOriginalV11 && typeof aggregateYear === 'function'){
  window.__aggregateYearOriginalV11 = aggregateYear;

  aggregateYear = function(year){
    const arr = window.__aggregateYearOriginalV11(year);
    return arr.map(m=>{
      const rows = getMonthDataset(m.monthKey);
      const real = getValoresReaisV11(m.monthKey);
      const setor = rows.reduce((s,r)=>s + Number(r.setor || 0),0);
      const subst = rows.reduce((s,r)=>s + Number(r.substituicao || 0),0);
      const bruto = rows.reduce((s,r)=>s + Number(r.bruto || 0),0);
      const liquido = rows.reduce((s,r)=>s + Number(r.liquido || 0),0);
      const baseImpacto = Number(real?.bruto || 0) > 0 ? Number(real.bruto) : bruto;
      return {
        ...m,
        bruto,
        liquido,
        refPct: baseImpacto ? ((setor + subst) / baseImpacto) * 100 : 0
      };
    });
  };
}

if(!window.__openPageOriginalV11 && typeof openPage === 'function'){
  window.__openPageOriginalV11 = openPage;
  openPage = function(pageId){
    window.__openPageOriginalV11(pageId);
    liberarMenuConfigV11();
    if(pageId === 'config'){
      setTimeout(()=>{
        ensureValoresReaisUIV11();
        renderValoresReaisV11();
      },100);
    }
  };
  window.openPage = openPage;
}

if(!window.__renderAllOriginalV11 && typeof renderAll === 'function'){
  window.__renderAllOriginalV11 = renderAll;
  renderAll = function(){
    liberarMenuConfigV11();
    window.__renderAllOriginalV11();
    ensureValoresReaisUIV11();
    renderValoresReaisV11();
  };
}

loadValoresReaisV11();

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>{
    liberarMenuConfigV11();
    ensureValoresReaisUIV11();
    renderValoresReaisV11();
    try{ renderAll(); }catch(e){}
  });
}else{
  liberarMenuConfigV11();
  ensureValoresReaisUIV11();
  renderValoresReaisV11();
  setTimeout(()=>{ try{ renderAll(); }catch(e){} },50);
}

setTimeout(liberarMenuConfigV11, 300);
setTimeout(liberarMenuConfigV11, 1000);


/* PATCH v12 - Valores reais na Supabase + Dashboard Operacional */

const VALORES_REAIS_TABLE_V12 = 'valores_reais_faturamento';

function aplicarLayoutValoresReaisMeiaTelaV12(){
  const panel = document.getElementById('valoresReaisV11');
  if(!panel) return;
  panel.style.maxWidth = 'calc(50% - 8px)';
  panel.style.minWidth = '520px';
}

async function salvarValoresReaisSupabaseV12(monthKey, bruto, liquido){
  if(!SUPABASE_A?.url || !SUPABASE_A?.anonKey) return;
  const payload = [{ mes: `${monthKey}-01`, bruto_real: Number(bruto||0), liquido_real: Number(liquido||0) }];
  const res = await fetch(`${SUPABASE_A.url}/rest/v1/${VALORES_REAIS_TABLE_V12}?on_conflict=mes`, {
    method:'POST',
    headers:{
      apikey:SUPABASE_A.anonKey,
      Authorization:`Bearer ${SUPABASE_A.anonKey}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=representation'
    },
    body:JSON.stringify(payload)
  });
  if(!res.ok) throw new Error(`Erro ao salvar valores reais: ${res.status} ${await res.text()}`);
}

async function carregarValoresReaisSupabaseV12(){
  if(!SUPABASE_A?.url || !SUPABASE_A?.anonKey) return;
  const res = await fetch(`${SUPABASE_A.url}/rest/v1/${VALORES_REAIS_TABLE_V12}?select=mes,bruto_real,liquido_real&limit=5000`, {
    method:'GET',
    headers:{apikey:SUPABASE_A.anonKey, Authorization:`Bearer ${SUPABASE_A.anonKey}`},
    cache:'no-store'
  });
  if(!res.ok){
    console.warn('Valores reais não carregados:', await res.text());
    return;
  }
  const rows = await res.json();
  rows.forEach(r=>{
    const key = normalizeMonthDate(r.mes)?.slice(0,7);
    if(key) state.valoresReaisMes[key] = { bruto:parseBR(r.bruto_real), liquido:parseBR(r.liquido_real) };
  });
  saveValoresReaisV11?.();
}

async function excluirValoresReaisSupabaseV12(monthKey){
  if(!SUPABASE_A?.url || !SUPABASE_A?.anonKey) return;
  await fetch(`${SUPABASE_A.url}/rest/v1/${VALORES_REAIS_TABLE_V12}?mes=eq.${monthKey}-01`, {
    method:'DELETE',
    headers:{apikey:SUPABASE_A.anonKey, Authorization:`Bearer ${SUPABASE_A.anonKey}`}
  });
}

function rebindValoresReaisSupabaseV12(){
  const salvar = document.getElementById('vrSalvarV11');
  const excluir = document.getElementById('vrExcluirV11');
  const mes = document.getElementById('vrMesV11');
  const bruto = document.getElementById('vrBrutoV11');
  const liquido = document.getElementById('vrLiquidoV11');

  if(salvar && !salvar.__boundSupabaseV12){
    salvar.__boundSupabaseV12 = true;
    salvar.addEventListener('click', async ()=>{
      const key = mes?.value || dashboardMonth?.value;
      if(!key) return;
      try{
        await salvarValoresReaisSupabaseV12(key, parseBR(bruto?.value||0), parseBR(liquido?.value||0));
      }catch(e){
        alert(e.message + '\n\nCrie a tabela valores_reais_faturamento na Supabase A.');
      }
    });
  }

  if(excluir && !excluir.__boundSupabaseV12){
    excluir.__boundSupabaseV12 = true;
    excluir.addEventListener('click', async ()=>{
      const key = mes?.value || dashboardMonth?.value;
      if(key) await excluirValoresReaisSupabaseV12(key);
    });
  }
}

function getMonthDatasetOperacionalV12(monthKey){
  if(window.__getMonthDatasetOriginalV11) return window.__getMonthDatasetOriginalV11(monthKey);
  return getMonthDataset(monthKey);
}

function syncOperacionalSelectV12(){
  const sel = document.getElementById('operacionalMonth');
  if(!sel) return;
  const keys = allMonthKeys();
  const current = sel.value || dashboardMonth?.value || keys[keys.length-1];
  sel.innerHTML = '';
  keys.forEach(k=>{
    const opt=document.createElement('option');
    opt.value=k;
    opt.textContent=prettyMonth(k);
    sel.appendChild(opt);
  });
  if(keys.includes(current)) sel.value=current;
  else if(keys.length) sel.value=keys[keys.length-1];
  if(!sel.__boundV12){
    sel.__boundV12 = true;
    sel.addEventListener('change', renderDashboardOperacionalV12);
  }
}

function renderDashboardOperacionalV12(){
  syncOperacionalSelectV12();
  const monthKey = document.getElementById('operacionalMonth')?.value || dashboardMonth?.value || allMonthKeys().slice(-1)[0];
  if(!monthKey) return;
  const rows = getMonthDatasetOperacionalV12(monthKey);
  const bruto = rows.reduce((s,r)=>s+Number(r.bruto||0),0);
  const setor = rows.reduce((s,r)=>s+Number(r.setor||0),0);
  const subst = rows.reduce((s,r)=>s+Number(r.substituicao||0),0);
  const liquido = rows.reduce((s,r)=>s+Number(r.liquido||0),0);
  const inter = rows.reduce((s,r)=>s+Number(r.inter||0),0);
  const nac = rows.reduce((s,r)=>s+Number(r.nac||0),0);
  const pct = liquido ? ((setor+subst)/liquido)*100 : 0;
  setText('opBruto', fmtMoney(bruto));
  setText('opSetor', fmtMoney(setor));
  setText('opSubst', fmtMoney(subst));
  setText('opLiquido', fmtMoney(liquido));
  setText('opPctErro', fmtPct(pct));
  setText('opInter', fmtMoney(inter));
  setText('opNac', fmtMoney(nac));
  setText('opMes', prettyMonth(monthKey));
}

if(!window.__openPageOriginalV12 && typeof openPage === 'function'){
  window.__openPageOriginalV12 = openPage;
  openPage = function(pageId){
    window.__openPageOriginalV12(pageId);
    if(pageId === 'config') setTimeout(()=>{ aplicarLayoutValoresReaisMeiaTelaV12(); rebindValoresReaisSupabaseV12(); },150);
    if(pageId === 'dashboardOperacional') setTimeout(renderDashboardOperacionalV12,100);
  };
  window.openPage = openPage;
}

if(!window.__renderAllOriginalV12 && typeof renderAll === 'function'){
  window.__renderAllOriginalV12 = renderAll;
  renderAll = function(){
    window.__renderAllOriginalV12();
    aplicarLayoutValoresReaisMeiaTelaV12();
    rebindValoresReaisSupabaseV12();
    syncOperacionalSelectV12();
    renderDashboardOperacionalV12();
  };
}

(async function(){
  await carregarValoresReaisSupabaseV12();
  renderValoresReaisV11?.();
  try{ renderAll(); }catch(e){}
})();
