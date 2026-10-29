/* Painel 902 — limpeza de resíduos em competências encerradas. */
(function(){
 function install(){
  if(typeof renderMonthsPanel!=='function'||typeof obterCompetenciaCompleta902!=='function')return;
  const original=renderMonthsPanel;
  renderMonthsPanel=function(){
   original();
   document.querySelectorAll('#mesesBox .monthCard').forEach(card=>{
    const reopen=card.querySelector('button[onclick^="reabrirCompetencia("]');
    if(!reopen||card.querySelector('.btn-residuos-902'))return;
    const month=(reopen.getAttribute('onclick')||'').match(/\d{4}-\d{2}/)?.[0];
    if(!month)return;
    const summary=card.querySelector('.small');
    const count=dbMonthCounts902[month];
    if(summary){
     const old=card.querySelector('.residuos-count-902');
     if(old)old.remove();
     const info=document.createElement('div');
     info.className='small residuos-count-902';
     info.style.marginTop='6px';
     if(!dbMonthFetched902) info.textContent='Resíduos: consultando Supabase...';
     else if(count&&count.total>0) info.textContent='Resíduos: '+count.total+' | Finalizados: '+count.finalizados+' | Em andamento: '+(count.total-count.finalizados);
     else info.textContent='Resíduos identificados: 0';
     summary.parentNode.appendChild(info);
    }
    const btn=document.createElement('button');
    btn.type='button';btn.className='mini btn-red btn-residuos-902';btn.textContent='Limpar resíduos';
    btn.disabled=!dbMonthFetched902||!count||count.total===0;
    btn.title=btn.disabled?'Nenhum resíduo identificado para esta competência':'Exportar backup e limpar resíduos';
    btn.onclick=()=>window.limparResiduos902(month);
    reopen.parentNode.insertBefore(btn,reopen);
   });
  };
  window.limparResiduos902=async function(month){
   if(!/^\d{4}-\d{2}$/.test(month)||!state.supabase||!state.competenciasZeradas.has(month))return alert('Competência não encerrada ou conexão indisponível.');
   try{
    const backup=await obterCompetenciaCompleta902(month);
    if(!backup.total)return alert('Nenhum resíduo identificado. Bloqueio mantido.');
    baixarBackup902(backup);
    if(!confirm('Backup preparado com '+backup.total+' registros. Confira o arquivo baixado. A competência continuará bloqueada. Prosseguir?'))return;
    if(prompt('Digite exatamente '+month+' para confirmar a exclusão:')!==month)return;
    for(const table of ['painel_902','painel_902_finalizados','pcs_finalizadas']){
     const ids=backup.tabelas[table].map(r=>r.id).filter(id=>id!==null&&id!==undefined);
     for(let i=0;i<ids.length;i+=150){
      const {error}=await state.supabase.from(table).delete().in('id',ids.slice(i,i+150));
      if(error)throw Error(table+': '+error.message);
     }
    }
    const remaining=await obterCompetenciaCompleta902(month);
    if(remaining.total)throw Error('Restaram '+remaining.total+' registros.');
    state.rows=state.rows.filter(r=>(r.competencia||competenciaMes(r.dataPC||r.data_pc||''))!==month);
    state.finalizados=state.finalizados.filter(r=>(r.competencia||competenciaMes(r.dataPC||r.data_pc||''))!==month);
    delete dbMonthCounts902[month];
    await saveLocal();renderAll(true);
    alert('Resíduos removidos: '+backup.total+'. Competência permanece encerrada.');
   }catch(e){alert('Limpeza não concluída: '+(e.message||e)+'. Bloqueio preservado.');}
  };
  renderMonthsPanel();
 }
 window.addEventListener('load',install);
})();