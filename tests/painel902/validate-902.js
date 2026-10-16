#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function norm(v){ return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim(); }
function isUFEx(v){ const t=norm(v); return t==='EX'||t==='UF EX'||t.endsWith(' EX')||t.startsWith('EX '); }
function isInBrazil(pos){ return norm(pos).includes('BRASIL'); }
function isPosicaoExterior(pos){ return /\b(ARGENTINA|CHILE|PARAGUAI|PARAGUAY|URUGUAI|URUGUAY|BOLIVIA|PERU|EXTERIOR)\b/.test(norm(pos)); }
function rowInOriginCity(r){ const c=norm(r.cidadeOrigem),p=norm(r.posicao); return !!c&&!!p&&p.includes(c); }
function ufPosicaoBrasil(pos){
  const t=norm(pos); if(!t.includes('BRASIL')) return '';
  const ufs=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const ach=[]; t.split('BRASIL')[0].replace(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/g,m=>(ach.push(m),m));
  return ach.at(-1)||'';
}
function startsWithCfg(v,list=[]){ const x=norm(v); return list.some(y=>{y=norm(y);return y&&(x===y||x.startsWith(y+' '));}); }
function detectHeaderRow(matrix){ for(let i=0;i<Math.min(matrix.length,15);i++){const t=(matrix[i]||[]).map(norm).join('|');if(t.includes('REF')&&t.includes('DATA PC')&&t.includes('MOTORISTA'))return i;}return -1; }

function classify(r,cfg){
  if(r.numeroDocumento) return {bucket:'finalizados',status:'Finalizado',reason:'NUMERO_DOCUMENTO'};
  const paga=startsWithCfg(r.pagador,cfg.paga), alerta=startsWithCfg(r.pagador,cfg.alerta)||startsWithCfg(r.remetente,cfg.alerta), expo=startsWithCfg(r.pagador,cfg.expo);
  const aduana=(cfg.aduanas||[]).some(a=>norm(r.posicao).includes(norm(a))) && paga && isUFEx(r.ufRem);
  if(aduana) return {bucket:'aduana',status:'Aduana',reason:'ADUANA'};
  const impoEspecial=isUFEx(r.ufRem)&&paga;
  const alertaNac=alerta&&!isUFEx(r.ufRem)&&!isUFEx(r.ufDest);
  if(rowInOriginCity(r)&&!impoEspecial&&!alertaNac) return {bucket:'ativo',status:'Coleta',reason:'ORIGEM'};
  if(paga&&isUFEx(r.ufRem)&&!isInBrazil(r.posicao)) return {bucket:'agNota',status:'AG Nota',reason:'IMPO_AG_NOTA'};
  if(paga&&isUFEx(r.ufRem)&&isInBrazil(r.posicao)&&!aduana) return {bucket:'alertaInt',status:'Faturar',reason:'IMPO_BR_FORA_ADUANA'};
  if(alertaNac) return {bucket:'alertaNac',status:'Faturar',reason:'ALERTA_NACIONAL'};
  if(expo&&isUFEx(r.ufDest)) return {bucket:'alertaExpo',status:'Faturar',reason:'CLIENTE_EXPO'};
  if(!isUFEx(r.ufRem)&&isUFEx(r.ufDest)&&isPosicaoExterior(r.posicao)) return {bucket:'alertaExpo',status:'Faturar',reason:'EXPO_EXTERIOR'};
  const uf=ufPosicaoBrasil(r.posicao);
  if(isUFEx(r.ufRem)&&isInBrazil(r.posicao)) return {bucket:'alertaInt',status:'Faturar',reason:'IMPO_BR'};
  if(!isUFEx(r.ufRem)&&isUFEx(r.ufDest)&&uf&&uf!==norm(r.ufRem)) return {bucket:'alertaExpo',status:'Faturar',reason:'EXPO_SAIU_UF'};
  if(!isUFEx(r.ufRem)&&!isUFEx(r.ufDest)&&uf&&uf!==norm(r.ufRem)) return {bucket:'alertaNac',status:'Faturar',reason:'NACIONAL_SAIU_UF'};
  return {bucket:'ativo',status:'Coleta',reason:'SEM_EVIDENCIA_AVANCO'};
}

function parse(matrix){
 const h=detectHeaderRow(matrix); if(h<0) throw new Error('Cabeçalho 902 não encontrado.');
 const hs=matrix[h].map(norm), idx=(...n)=>n.map(norm).map(x=>hs.indexOf(x)).find(i=>i>=0)??-1;
 const col=(r,...n)=>{const i=idx(...n);return i>=0?String(r[i]??'').trim():'';};
 return matrix.slice(h+1).filter(r=>r&&r.length>=10).map(r=>{
   let numeroDocumento=col(r,'NUMERO_DOCUMENTO','NUMERO DOCUMENTO','NUM_DOCUMENTO','NUM DOCUMENTO','DOCUMENTO','DOCTO','NUM','NUM.');
   return {ref:col(r,'REF'),dataPC:col(r,'DATA PC'),filial:col(r,'FILIAL_PC','FILIAL PC'),pc:col(r,'PC'),numeroDocumento,posicao:col(r,'ULTIMA POSIÇÃO','ULTIMA POSICAO','POSICAO','POSIÇÃO'),remetente:col(r,'REMETENTE_PC','REMETENTE PC'),cidadeOrigem:col(r,'MUNICIPIO_REMETENTE','MUNICÍPIO_REMETENTE','MUNICIPIO REMETENTE'),ufRem:col(r,'UF_REMETENTE','UF REMETENTE','UF_ORIGEM','UF ORIGEM'),ufDest:col(r,'UF_DESTINATARIO','UF DESTINATARIO','UF_DESTINO','UF DESTINO'),pagador:col(r,'PAGADOR_PC','PAGADOR PC','PAGADOR')};
 }).filter(r=>r.ref&&r.pc);
}

function main(){
 const file=process.argv[2]; if(!file){console.error('Uso: node validate-902.js arquivo.xlsx [config.json]');process.exit(2);}
 let XLSX; try{XLSX=require('xlsx');}catch{console.error('Dependência xlsx ausente. Execute: npm install xlsx');process.exit(2);}
 const cfgFile=process.argv[3];
 const cfg=cfgFile?JSON.parse(fs.readFileSync(cfgFile,'utf8')):{aduanas:['SAO BORJA','SANTO TOME','DIONISIO','BERNARDO','FOZ DO IGUACU','PUERTO IGUACU','CHUI','CHUY'],alerta:['MARS','NISSIN','CAMPARI','COLGATE'],expo:[],paga:['BENASSI']};
 const wb=XLSX.readFile(path.resolve(file),{cellDates:false}); const ws=wb.Sheets[wb.SheetNames[0]];
 const rows=parse(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}));
 const out=rows.map(r=>({...r,...classify(r,cfg)}));
 const counts={}; for(const r of out) counts[r.bucket]=(counts[r.bucket]||0)+1;
 const duplicateKeys=new Map(); for(const r of out){const k=norm(r.filial)+'|'+norm(r.pc);const a=duplicateKeys.get(k)||[];a.push(r);duplicateKeys.set(k,a);}
 const suspeitos=[];
 for(const [k,a] of duplicateKeys){
   if(a.length<=1 || new Set(a.map(x=>x.status)).size<=1) continue;
   const temFinalizado=a.some(x=>x.status==='Finalizado');
   const temDocumento=a.some(x=>!!x.numeroDocumento);
   if(temFinalizado && temDocumento){
     // Alias esperado: a evidência documental da mesma Filial + PC prevalece.
     for(const x of a){ x.validacao='OK'; x.observacaoValidacao='Finalização confirmada; alias da mesma Filial + PC será consolidado.'; }
   } else {
     suspeitos.push({tipo:'MESMA_FILIAL_PC_STATUS_DIVERGENTE',chave:k,linhas:a});
   }
 }
 for(const r of out){
   if(!r.validacao) r.validacao = r.reason==='624_ROTA_DIVERGENTE' ? 'REVISAR' : 'OK';
   if(r.reason==='624_ROTA_DIVERGENTE') r.observacaoValidacao='Bloqueado: referência existe no 624, mas a rota não confere. Nenhuma regra do 624 pode sobrescrever este bloqueio.';
 }
 const report={arquivo:path.basename(file),total:out.length,contagem:counts,suspeitos:suspeitos.length,detalhesSuspeitos:suspeitos,linhas:out};
 const target=path.resolve(process.cwd(),'902-validation-report.json'); fs.writeFileSync(target,JSON.stringify(report,null,2));
 console.log(JSON.stringify({arquivo:report.arquivo,total:report.total,contagem:report.contagem,suspeitos:report.suspeitos,relatorio:target},null,2));
}
if(require.main===module) main();
module.exports={norm,classify,parse};
