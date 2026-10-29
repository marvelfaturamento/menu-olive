/* Fretes de importação: reaproveita a interface original Fretes Marvel.
   Não altera a lógica ADV, spot ou escrita de tarifas. */
(()=>{
'use strict';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const key=p=>[p.pagador,p.municipio_origem,p.uf_origem,p.municipio_destino,p.uf_destino].map(norm).join('|');
const active=p=>norm(p.uf_origem)==='EX'&&norm(p.uf_destino)!=='EX'&&!['FINALIZADO','FINALIZADOS'].includes(norm(p.bucket_atual));
function init(){
 const open=document.getElementById('fretesImpoOpen'),run=document.getElementById('marvelTestRun'),missing=document.getElementById('fiMissing'),all=document.getElementById('fiAll'),status=document.getElementById('marvelTestStatus');
 if(!open||!run||!missing||!all||!status)return;
 open.addEventListener('click',()=>{document.querySelector('.navbtn[data-tab="config"]')?.click();setTimeout(()=>{document.getElementById('marvelTestPanel')?.scrollIntoView({behavior:'smooth',block:'start'});},120);});
 let running=false;
 async function fetchPcs(){
  // A fonte correta é o espelho operacional exibido no 902, NÃO o histórico
  // acumulado da tabela painel_902 (que contém PCs já encerradas).
  const sets=currentSets();
  const live=[...sets.ativo,...sets.agNota,...sets.aduana,...sets.alertaInt];
  const unique=new Map();
  for(const p of live){
   if(norm(p.ufRem)!=='EX'||norm(p.ufDest)==='EX')continue;
   const id=String(p.id||p.pv||'');
   if(!id)continue;
   unique.set(id,{id:p.id,pv:p.pv,pagador:p.pagador,municipio_origem:p.cidadeOrigem,
     uf_origem:p.ufRem,municipio_destino:p.cidadeDestino,uf_destino:p.ufDest,
     frete_padrao:Number(p.frete||0),bucket_atual:p.bucket,ref:p.ref,
     referencia:p.referencia,cavalo:p.cavalo});
  }
  return [...unique.values()];
 }
 async function process(mode){
  if(running)return;
  running=true;missing.disabled=all.disabled=true;
  try{
   status.textContent='Identificando PCs de importação...';
   const pcs=await fetchPcs();
   const selected=mode==='all'?pcs:pcs.filter(p=>!(Number(p.frete_padrao)>0));
   const routes=[...new Map(selected.map(p=>[key(p),p])).values()];
   if(!routes.length){status.textContent='Nenhuma rota de importação pendente.';return;}
   const requestId='fi-'+Date.now()+'-'+Math.random().toString(36).slice(2);
   status.textContent='Consultando '+routes.length+' rotas de importação na Marvel ('+selected.length+' PCs). Aguardando a extensão...';
   await new Promise(resolve=>{
    let finished=false;
    const timer=setTimeout(()=>finish('Tempo limite de 5 minutos. Nenhum frete foi presumido.'),300000);
    function finish(msg){if(finished)return;finished=true;clearTimeout(timer);window.removeEventListener('message',receive);status.textContent=msg;resolve();}
    function receive(e){
     if(e.source!==window||e.origin!==location.origin)return;
     const d=e.data;
     if(d?.source!=='marvel-frete-ext'||d.requestId!==requestId)return;
     if(d.type==='marvel-frete-902-progress-v1'){status.textContent='Marvel: '+(d.done||0)+' de '+(d.total||routes.length)+' rotas consultadas.';return;}
     if(d.type==='marvel-frete-902-process-result-v1'){
      const cases=Array.isArray(d.casos)?d.casos:[];
      const out=document.getElementById('marvelTestResults');
      if(out){
       const summary=document.createElement('div');summary.style.cssText='margin:10px 0;padding:12px;border:1px solid #315e89;border-radius:8px';
       summary.textContent='Importação: '+cases.length+' resultados recebidos. '+cases.filter(x=>['Não encontrado','Ambíguo'].includes(x.estado)).length+' pendências. A conferência automática de gravação ainda não está habilitada neste teste.';
       out.prepend(summary);
      }
      finish(d.ok?'Consulta concluída. '+cases.length+' resultados retornados pela extensão (sem gravação automática).':'Falha na consulta: '+String(d.erro||'desconhecida'));
     }
    }
    window.addEventListener('message',receive);
    window.postMessage({source:'painel-902',type:'marvel-frete-902-process-v1',requestId,mode,pcs:routes.map(p=>({id:p.id,pv:p.pv,pagador:p.pagador,municipio_origem:p.municipio_origem,uf_origem:p.uf_origem,municipio_destino:p.municipio_destino,uf_destino:p.uf_destino,frete_padrao:p.frete_padrao,referencia:p.referencia||p.ref,cavalo:p.cavalo}))},location.origin);
   });
  }catch(e){status.textContent='Não foi possível iniciar: '+e.message;}finally{running=false;missing.disabled=all.disabled=false;}
 }
 missing.addEventListener('click',()=>process('missing'));
 all.addEventListener('click',()=>process('all'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();