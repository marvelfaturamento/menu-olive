/* Ponte de auditoria somente leitura. Nunca grava fretes.
   A extensão deve publicar os dados somente após consultar a Marvel. */
(function(){
  'use strict';
  const CORE=window.FreteMarvelCore;
  if(!CORE) return;
  const SOURCE='marvel-frete-ext';
  const REQUEST='marvel-frete-902-audit-v1';
  const RESULT='marvel-frete-902-audit-result-v1';
  function pcValida(pc){
    const bucket=CORE.norm(pc.bucket_atual??pc.bucket??'');
    const status=CORE.norm(pc.status??'');
    return ['AG NOTA','AGUARDANDO NOTA','EM ADUANA','ADUANA'].includes(bucket) ||
      ['AG NOTA','AGUARDANDO NOTA','EM ADUANA'].includes(status);
  }
  function auditar(payload){
    if(!Array.isArray(payload.tarifas) || payload.tarifas.length>20000) throw Error('Lote de tarifas inválido');
    const pcs=Array.isArray(payload.pcs)?payload.pcs:[];
    if(pcs.length>20000) throw Error('Lote de PCs inválido');
    const selecionadas=pcs.filter(pcValida);
    const resultados=selecionadas.map(pc=>({id:pc.id, ...CORE.auditar(pc,payload.tarifas)}));
    const contagem={};
    resultados.forEach(r=>{contagem[r.situacao]=(contagem[r.situacao]||0)+1;});
    return {total:resultados.length,contagem,resultados};
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.origin!==location.origin) return;
    const data=event.data;
    if(!data || data.source!==SOURCE || data.type!==REQUEST || typeof data.requestId!=='string') return;
    let output;
    try{output={ok:true,...auditar(data)};}catch(e){output={ok:false,erro:String(e.message||e)};}
    window.postMessage({source:'painel-902',type:RESULT,requestId:data.requestId,...output},location.origin);
  });
  window.MarvelFreteAuditoria=Object.freeze({auditar});
})();
