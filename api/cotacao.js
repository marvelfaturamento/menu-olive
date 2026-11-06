// PTAX de fechamento: boletim oficial de todas as moedas (BCB).
module.exports=async function handler(req,res){
res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=7200');
const currency=String(req.query.moeda||'').toUpperCase();
const day=String(req.query.data||'');
if(!/^[A-Z]{3}$/.test(currency)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))return res.status(400).json({error:'Parâmetros inválidos'});
const end=new Date(day+'T12:00:00Z');if(!Number.isFinite(end.getTime())||end.toISOString().slice(0,10)!==day||end>Date.now())return res.status(400).json({error:'Data inválida'});
const number=v=>Number(String(v||'').trim().replace(/\./g,'').replace(',','.'));
for(let offset=0;offset<15;offset++){
const d=new Date(end);d.setUTCDate(d.getUTCDate()-offset);
const stamp=d.toISOString().slice(0,10).replace(/-/g,'');
try{
const response=await fetch('https://www4.bcb.gov.br/Download/fechamento/'+stamp+'.csv',{signal:AbortSignal.timeout(5000)});
if(!response.ok)continue;
const raw=await response.text();
const lines=raw.split(/\r?\n/);
for(const line of lines){
const parts=line.replace(/^\uFEFF/,'').split(';').map(x=>x.trim().replace(/^"|"$/g,''));
const i=parts.findIndex(p=>p===currency);if(i<0||parts.length<i+3)continue;
const compra=number(parts[i+1]),venda=number(parts[i+2]);
if(compra>0&&venda>0)return res.status(200).json({moeda:currency,data:d.toISOString().slice(0,10),cotacaoCompra:compra,cotacaoVenda:venda,fonte:'BCB - boletim PTAX de fechamento',url:'https://www4.bcb.gov.br/Download/fechamento/'+stamp+'.csv'});
}
}catch(e){}
}
return res.status(404).json({error:'Cotação oficial não encontrada nos últimos 15 dias'});
};