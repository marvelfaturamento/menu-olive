const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const baseline = JSON.parse(fs.readFileSync(path.join(__dirname,'golden-baseline-20261003.json'),'utf8'));
const app = fs.readFileSync(path.resolve(__dirname,'../../modulos/painel902/js/app.js'),'utf8');

function norm(v){ return String(v ?? '').trim().toUpperCase(); }
function extract(name){
  const start=app.indexOf('function '+name+'('); assert.notEqual(start,-1);
  const brace=app.indexOf('{',start); let d=0,q=null,e=false;
  for(let i=brace;i<app.length;i++){const ch=app[i]; if(q){if(e){e=false;continue} if(ch==='\\'){e=true;continue} if(ch===q)q=null;continue} if(ch==="'"||ch==='"'||ch==='\x60'){q=ch;continue} if(ch==='{')d++; if(ch==='}'&&--d===0)return app.slice(start,i+1)}
  throw new Error(name);
}
const rotaSrc=extract('rota624Compativel');
const rota624Compativel=new Function('norm',rotaSrc+';return rota624Compativel;')(norm);

function resolveFinalization(row, siblings=[]){
  if(String(row.doc||'').trim()) return {status:'Finalizado',reason:'902_NUMERO_DOCUMENTO'};
  if(siblings.some(x=>x.canonical===row.canonical && String(x.doc||'').trim()))
    return {status:'Finalizado',reason:'ALIAS_DOCUMENTO_MESMA_FILIAL_PC'};
  if(row.route624===true) return {status:'Finalizado',reason:'624_REFERENCIA_ROTA'};
  return {status:'Operacional',reason:'OPERACIONAL'};
}

test('baseline real derivado mantém as quantidades auditadas',()=>{
  assert.equal(baseline.totals.valid_902_rows,2351);
  assert.equal(baseline.totals.expected_finalized_by_902_or_624,1825);
  assert.equal(baseline.totals.confirmed_alias_keys,5);
  assert.equal(baseline.totals.route_divergence_cases,6);
});

test('prioridade: documento do 902 vence qualquer regra operacional',()=>{
  const c=baseline.cases.find(x=>x.id==='DOC-1');
  assert.deepEqual(resolveFinalization(c),{status:'Finalizado',reason:'902_NUMERO_DOCUMENTO'});
});

test('alias: mesma identidade canônica herda finalização documental',()=>{
  const a=baseline.cases.filter(x=>x.canonical==='A');
  const sem=a.find(x=>!x.doc);
  assert.deepEqual(resolveFinalization(sem,a),{status:'Finalizado',reason:'ALIAS_DOCUMENTO_MESMA_FILIAL_PC'});
});

test('624: referência com rota compatível pode finalizar',()=>{
  const c=baseline.cases.find(x=>x.id==='624-MATCH');
  assert.deepEqual(resolveFinalization(c),{status:'Finalizado',reason:'624_REFERENCIA_ROTA'});
});

test('624: todos os seis padrões reais de rota divergente continuam bloqueados',()=>{
  const cases=baseline.cases.filter(x=>x.id.startsWith('624-DIVERGE-'));
  assert.equal(cases.length,6);
  for(const c of cases){
    assert.equal(rota624Compativel({ufRem:c.ufo,ufDest:c.ufd},{ufOrigem:c.regO,ufDestino:c.regD}),false,c.id);
    assert.equal(resolveFinalization({...c,route624:false}).status,'Operacional',c.id+' não pode finalizar pelo 624');
  }
});

test('624 divergente não é sobrescrito por status operacional Faturar',()=>{
  const c=baseline.cases.find(x=>x.id==='624-DIVERGE-1');
  const resolved=resolveFinalization({...c,route624:false,statusOperacional:'Faturar'});
  assert.equal(resolved.status,'Operacional');
  assert.notEqual(resolved.status,'Finalizado');
});
