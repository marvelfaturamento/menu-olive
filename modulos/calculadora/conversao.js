let fxDirection='toBRL',fxSide='venda',fxQuote=null,fxRequest=0;
const fxNames={USD:'Dólar americano',ARS:'Peso argentino',CLP:'Peso chileno',PYG:'Guarani',UYU:'Peso uruguaio',PEN:'Sol peruano',EUR:'Euro'};
const fxMoney=(v,c)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c,maximumFractionDigits:2}).format(v);
function setFxDirection(d){fxDirection=d;$('fxToBrl').classList.toggle('active',d==='toBRL');$('fxFromBrl').classList.toggle('active',d==='fromBRL');renderFx()}
function toggleFxSide(){fxSide=fxSide==='venda'?'compra':'venda';$('fxSide').textContent=fxSide==='venda'?'Venda / Importação':'Compra / Exportação';renderFx()}
function fxDateFormat(d){return String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'-'+d.getFullYear()}
function copyFxValue(){const rate=fxQuote?.[fxSide];if(!Number.isFinite(rate)||rate<=0)return;const amount=val('fxAmount');const value=fxDirection==='toBRL'?amount*rate:amount/rate;const clean=value.toFixed(2).replace('.',',');const btn=$('fxCopy');const done=()=>{if(btn){btn.textContent='✓ Copiado';setTimeout(()=>{if(btn.isConnected)btn.textContent='📋 Copiar'},1400)}};if(navigator.clipboard?.writeText){navigator.clipboard.writeText(clean).then(done).catch(()=>legacyCopyFx(clean,done))}else legacyCopyFx(clean,done)}
function legacyCopyFx(value,done){const el=document.createElement('textarea');el.value=value;el.style.position='fixed';el.style.opacity='0';document.body.appendChild(el);el.select();try{if(document.execCommand('copy'))done()}finally{el.remove()}}
function renderFx(){const cur=$('fxCurrency').value,rate=fxQuote?.[fxSide],amount=val('fxAmount');$('fxToBrl').textContent=cur+' → R$';$('fxFromBrl').textContent='R$ → '+cur;
if(!fxQuote||!Number.isFinite(rate)||rate<=0){$('fxResult').innerHTML='<h2>Resultado da conversão</h2><p class="notice">Sem cotação válida. Selecione a data e atualize.</p>';return}
const result=fxDirection==='toBRL'?amount*rate:amount/rate;const from=fxDirection==='toBRL'?cur:'BRL',to=fxDirection==='toBRL'?'BRL':cur;
$('fxResult').innerHTML='<h2>Resultado da conversão</h2><div class="metric"><small>Valor convertido</small><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><strong>'+fxMoney(result,to)+'</strong><button id="fxCopy" type="button" onclick="copyFxValue()" style="border:1px solid #4878b7;background:#214c88;color:white;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:bold">📋 Copiar</button></div></div><div class="line"><span>Valor original</span><b>'+fxMoney(amount,from)+'</b></div><div class="line"><span>PTAX '+fxSide+'</span><b>R$ '+rate.toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:6})+' / '+cur+'</b></div><div class="line"><span>Data da cotação</span><b>'+fxQuote.date+'</b></div><p class="notice">Fonte: '+(fxQuote.fonte||'Banco Central do Brasil (PTAX)')+'. A cotação exibida é por unidade da moeda estrangeira em reais.</p>'}
async function loadFx(){
const request=++fxRequest;fxQuote=null;
$('fxResult').innerHTML='<h2>Resultado da conversão</h2><p class="notice">Consultando PTAX no Banco Central...</p>';
const date=$('fxDate').value,cur=$('fxCurrency').value;if(!date)return;
const end=new Date(date+'T12:00:00'),start=new Date(end);start.setDate(start.getDate()-30);
const initial=fxDateFormat(start),final=fxDateFormat(end);
const base='https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/';
const standard=cur==='USD'?'CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)':'CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)';
const args=(cur==='USD'?'':"@moeda='"+cur+"'&")+"@dataInicial='"+initial+"'&@dataFinalCotacao='"+final+"'";
const primary=base+standard+'?'+args+'&$format=json';
const closing=base+'CotacaoMoedaPeriodoFechamento(codigoMoeda=@codigoMoeda,dataInicialCotacao=@dataInicialCotacao,dataFinalCotacao=@dataFinalCotacao)?@codigoMoeda=\''+cur+'\'&@dataInicialCotacao=\''+initial+'\'&@dataFinalCotacao=\''+final+'\'&$format=json';
let errors=[];
async function query(url){const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();return (data.value||[]).filter(q=>Number(q.cotacaoVenda)>0&&Number(q.cotacaoCompra)>0).sort((a,b)=>String(b.dataHoraCotacao||'').localeCompare(String(a.dataHoraCotacao||'')))[0]||null}
let q=null;try{q=await query(primary)}catch(e){errors.push('PTAX: '+e.message)}
if(!q){try{q=await query(closing)}catch(e){errors.push('Fechamento: '+e.message)}}
if(!q){try{const response=await fetch('/api/cotacao?moeda='+encodeURIComponent(cur)+'&data='+encodeURIComponent(date));if(response.ok){const data=await response.json();q={cotacaoCompra:data.cotacaoCompra,cotacaoVenda:data.cotacaoVenda,dataHoraCotacao:data.data+'T13:00:00',fonte:data.fonte}}else{errors.push('Boletim oficial: HTTP '+response.status)}}catch(e){errors.push('Boletim oficial: '+e.message)}}
if(request!==fxRequest)return;
if(q){fxQuote={venda:Number(q.cotacaoVenda),compra:Number(q.cotacaoCompra),date:String(q.dataHoraCotacao||'').slice(0,10).split('-').reverse().join('/'),fonte:q.fonte||'BCB - PTAX'};renderFx();return}
let available=null;
try{const response=await fetch(base+'Moedas?$format=json');if(response.ok){const data=await response.json();available=(data.value||[]).some(m=>String(m.simbolo||'').toUpperCase()===cur)}}catch(e){}
if(request!==fxRequest)return;
const reason=available===false?'A moeda '+cur+' não consta na relação de moedas retornada pelo serviço PTAX do Banco Central.':available===true?'A moeda consta no serviço PTAX, mas não foi encontrada cotação válida no período consultado.':'Não foi possível confirmar uma cotação PTAX para '+cur+'.';
$('fxResult').innerHTML='<h2>Resultado da conversão</h2><p class="notice">'+reason+' Nenhuma taxa foi estimada. '+(errors.length?'Detalhes: '+errors.join('; ').replace(/[<>]/g,''):'')+'</p>';
}
(function(){const today=new Date();$('fxDate').value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');$('fxDate').max=$('fxDate').value;['fxDate','fxCurrency'].forEach(id=>$(id).addEventListener('change',loadFx));$('fxAmount').addEventListener('input',renderFx);loadFx()})();