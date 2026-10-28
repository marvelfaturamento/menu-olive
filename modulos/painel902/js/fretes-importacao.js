/* Gestão de importações — módulo isolado. Não altera ADV, spots ou classificação operacional. */
(function(){
'use strict';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const valid=p=>norm(p.uf_origem??p.ufRem)==='EX' && norm(p.uf_destino??p.ufDest)!=='EX' && norm(p.bucket_atual??p.bucket)!=='FINALIZADOS' && norm(p.bucket_atual??p.bucket)!=='FINALIZADO';
const routeKey=p=>[p.pagador,p.municipio_origem??p.cidadeOrigem,p.uf_origem??p.ufRem,p.municipio_destino??p.cidadeDestino,p.uf_destino??p.ufDest].map(norm).join('|');
function init(){
const trigger=document.getElementById('fretesImpoOpen');
if(!trigger)return;
const layer=document.createElement('div');layer.id='fretesImpoLayer';layer.hidden=true;
layer.style.cssText='position:fixed;inset:0;z-index:9999;background:#081528ee;overflow:auto;padding:24px;color:#e8f2ff';
layer.innerHTML='<div style="max-width:1200px;margin:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h2>Fretes de Importação</h2><p>Todos os cards operacionais · apenas origem EX e destino Brasil</p></div><button id="fiClose" type="button">✕ Fechar</button></div><div id="fiCounts" style="margin:16px 0"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0"><button id="fiMissing" type="button">Processar somente sem frete</button><button id="fiAll" type="button">Rastrear todos os fretes</button><button id="fiReload" type="button">Atualizar lista</button><input id="fiSearch" placeholder="Buscar PC, cliente ou destino" style="padding:8px;min-width:250px"></div><p id="fiStatus" role="status">Aguardando carregamento.</p><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>PC</th><th>Cliente</th><th>Origem</th><th>Destino</th><th>Frete no 902</th><th>Situação</th></tr></thead><tbody id="fiRows"></tbody></table></div></div>';
document.body.appendChild(layer);
const $=id=>document.getElementById(id);let pcs=[],busy=false;
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cell=(tr,v)=>{const td=document.createElement('td');td.textContent=String(v??'');td.style.cssText='padding:9px;border-bottom:1px solid #32465d';tr.appendChild(td);};
async function load(){
$('fiStatus').textContent='Carregando PCs do Supabase...';
try{
 if(!state.supabase)throw Error('Conexão Supabase indisponível');
 let all=[];for(let from=0;from<20000;from+=1000){
 const {data,error}=await state.supabase.from('painel_902').select('id,pv,pagador,municipio_origem,uf_origem,municipio_destino,uf_destino,frete_padrao,bucket_atual,status').eq('uf_origem','EX').range(from,from+999);
 if(error)throw error;all.push(...(data||[]));if(!data||data.length<1000)break;
 }
 pcs=all.filter(valid);render();$('fiStatus').textContent='Lista atualizada. Nenhuma tarifa foi alterada.';
}catch(e){$('fiStatus').textContent='Não foi possível carregar: '+e.message;}
}
function render(){
 const unique=new Set(pcs.map(routeKey));const missing=pcs.filter(p=>!(Number(p.frete_padrao)>0));
 $('fiCounts').textContent=pcs.length+' PCs de importação · '+unique.size+' rotas distintas · '+missing.length+' PCs sem frete';
 const q=norm($('fiSearch').value),body=$('fiRows');body.replaceChildren();
 pcs.filter(p=>!q||norm([p.pv,p.pagador,p.municipio_destino].join(' ')).includes(q)).slice(0,500).forEach(p=>{
 const tr=document.createElement('tr');cell(tr,p.pv||p.id);cell(tr,p.pagador);cell(tr,p.municipio_origem);cell(tr,p.municipio_destino+' / '+p.uf_destino);cell(tr,Number(p.frete_padrao)>0?money(p.frete_padrao):'—');cell(tr,Number(p.frete_padrao)>0?'Com frete':'Sem frete');body.appendChild(tr);
 });
}
function process(mode){
 if(busy)return;
 const selected=pcs.filter(p=>mode==='all'||!(Number(p.frete_padrao)>0));
 const routes=[...new Map(selected.map(p=>[routeKey(p),p])).values()];
 if(!routes.length){$('fiStatus').textContent='Nenhuma rota pendente para consultar.';return;}
 const requestId='fi-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 busy=true;$('fiMissing').disabled=$('fiAll').disabled=true;
 $('fiStatus').textContent='Solicitando '+routes.length+' rotas à extensão Marvel. Aguardando confirmação...';
 let finished=false;
 const timer=setTimeout(()=>finish('A extensão não confirmou a consulta em 5 minutos. Nenhum resultado foi assumido.'),30000);
 function finish(msg){if(finished)return;finished=true;clearTimeout(timer);window.removeEventListener('message',receive);busy=false;$('fiMissing').disabled=$('fiAll').disabled=false;$('fiStatus').textContent=msg;}
 function receive(e){if(e.source!==window||e.origin!==location.origin)return;const d=e.data;
 if(d?.source!=='marvel-frete-ext'||d.requestId!==requestId)return;
 if(d.type==='marvel-frete-902-progress-v1'){$('fiStatus').textContent='Consultando: '+(d.done||0)+'/'+(d.total||routes.length);return;}
 if(d.type==='marvel-frete-902-test-response-v1'||d.type==='marvel-frete-902-process-result-v1'){finish(d.ok?'Consulta Marvel concluída. Resultados recebidos; gravação automática ainda não habilitada.':'Falha: '+String(d.erro||'desconhecida'));}
 }
 window.addEventListener('message',receive);
 window.postMessage({source:'painel-902',type:'marvel-frete-902-process-v1',requestId,mode,pcs:routes.map(p=>({id:p.id,pv:p.pv,pagador:p.pagador,municipio_origem:p.municipio_origem,uf_origem:p.uf_origem,municipio_destino:p.municipio_destino,uf_destino:p.uf_destino,frete_padrao:p.frete_padrao}))},location.origin);
}
trigger.addEventListener('click',()=>{layer.hidden=false;load();});
$('fiClose').addEventListener('click',()=>{layer.hidden=true;});
$('fiReload').addEventListener('click',load);
$('fiSearch').addEventListener('input',render);
$('fiMissing').addEventListener('click',()=>process('missing'));
$('fiAll').addEventListener('click',()=>process('all'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();