const $=id=>document.getElementById(id);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(n)?n:0);
function parseBR(v){v=String(v??'').trim();if(!v)return 0;if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');return Math.max(0,Number(v.replace(/[^\d.-]/g,''))||0)}
const val=id=>parseBR($(id).value),pct=id=>Math.max(0,Number($(id).value)||0);
const row=(name,n)=>'<div class="line"><span>'+name+'</span><b>'+brl(n)+'</b></div>';
const metric=(name,n)=>'<div class="metric"><small>'+name+'</small><strong>'+brl(n)+'</strong></div>';
const final=n=>'<div class="total">Valor final<br><strong>'+brl(n)+'</strong></div>';
let current='home';
function openPage(page){current=page;document.querySelectorAll('main section').forEach(s=>s.classList.toggle('hide',s.id!==page));$('back').classList.toggle('hide',page==='home');$('back').onclick=()=>openPage(['cte','isento','nfs'].includes(page)?'nestle':'home');let group=['cte','isento','nfs'].includes(page)?'nestle':page;['Home','Nestle','Geral'].forEach(k=>$('menu'+k).classList.toggle('active',k.toLowerCase()===(group==='nestle'?'nestle':group)));const titles={home:'Central de Cálculos',nestle:'Nestlé',geral:'Calculadora Geral',cte:'Frete / CT-e',isento:'Frete / CT-e / Isento',nfs:'NFS / ISS'};$('heading').textContent=titles[page];$('hint').textContent=page==='home'?'Selecione uma das calculadoras':page==='nestle'?'Escolha uma modalidade pelos cards':page==='geral'?'Frete, ICMS, Ad Valorem e pedágio':'Regras específicas da Nestlé';calc()}
function calc(){
const f=val('cf'),p=f/.9075,t=Math.min(99.99,pct('ci'))/100,ct=p/(1-t);
$('cr').innerHTML='<h2>Resultado</h2><div class="result">'+metric('PIS/COFINS',p-f)+metric('ICMS',ct-p)+metric('Valor total',ct)+'</div>'+row('Frete-base',f)+row('Frete + PIS/COFINS',p)+row('ICMS',ct-p)+final(ct)+'<p class="notice">Divisor PIS/COFINS: 0,9075. Divisor ICMS: '+(1-t).toFixed(4)+'.</p>';
const fi=val('if'),it=fi/.9075;$('ir').innerHTML='<h2>Resultado</h2><div class="result">'+metric('PIS/COFINS',it-fi)+metric('Valor total',it)+'</div>'+row('Frete-base',fi)+final(it);
const fn=val('nf'),nb=fn/.9075,iss=nb*Math.min(100,pct('ni'))/100;$('nr').innerHTML='<h2>Resultado NFS</h2><div class="result">'+metric('Valor bruto',nb)+metric('ISS',iss)+metric('A receber',nb-iss)+'</div>'+row('PIS/COFINS',nb-fn)+row('Valor bruto',nb)+row('ISS descontado',iss)+final(nb-iss);
const gf=val('gf'),gm=val('gm'),adv=gm*pct('ga')/100,ped=val('gp'),base=gf+adv+ped,ex=$('gex').checked,inc=$('gin').checked,rate=Math.min(99.99,pct('gi'))/100,ic=ex?0:inc?base*rate:base/(1-rate)-base,total=ex||inc?base:base+ic;
$('gin').disabled=ex;$('gi').disabled=ex;
$('gr').innerHTML='<h2>Resultado da conferência</h2><div class="result">'+metric('Ad Valorem',adv)+metric('ICMS',ic)+metric('Frete total',total)+'</div>'+row('Frete-base',gf)+row('Ad Valorem',adv)+row('Pedágio',ped)+row('ICMS',ic)+final(total)+'<p class="notice">'+(ex?'Operação marcada como isenta: ICMS zerado.':inc?'ICMS destacado dentro do valor total.':'ICMS calculado por dentro e acrescido ao valor-base.')+' A composição da base de cálculo depende do enquadramento tributário da operação; confira o tratamento de pedágio e ADV.</p>';
}
document.querySelectorAll('input').forEach(input=>input.addEventListener('input',calc));
document.querySelectorAll('input[type=checkbox]').forEach(input=>input.addEventListener('change',calc));
openPage('home');