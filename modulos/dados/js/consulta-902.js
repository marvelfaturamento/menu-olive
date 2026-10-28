(()=>{"use strict";
const host=document.querySelector(".card h3");
if(!host||!host.textContent.includes("SIMULADOR"))return;
const root=document.createElement("section");root.style.cssText="padding:12px;margin:0 0 15px;border:1px solid #b5c8df;border-radius:9px;background:#edf5ff";
root.innerHTML='<label style="font-weight:700;display:block;margin-bottom:7px">🔎 Buscar carga do Painel 902 (frota, pedido ou cliente)</label><div style="display:flex;gap:7px"><input id="pd902Busca" placeholder="Ex.: 3000, 160068 ou cliente" style="flex:1;min-width:0;padding:9px"><button type="button" id="pd902Buscar" style="padding:9px;background:#004b9c;color:white;border:0;border-radius:6px">Buscar</button></div><div id="pd902Status" role="status" style="font-size:12px;margin-top:6px"></div><div id="pd902Resultados" style="max-height:230px;overflow:auto"></div><button type="button" id="pd902Desfazer" hidden style="margin-top:8px">↶ Desfazer preenchimento</button>';
host.parentElement.insertBefore(root,host.nextSibling);
const $=id=>document.getElementById(id),status=$("pd902Status"),results=$("pd902Resultados");
let snapshot=null;
const ids=["origem","aduana","destino","freteBRL","frota","adv"];
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const set=(id,v)=>{const el=$(id);if(el&&v!==null&&v!==undefined){el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));}};
const apply=p=>{
 snapshot=Object.fromEntries(ids.map(id=>[id,$(id)?.value??""]));
 set("origem",p.municipio_origem||"");set("destino",p.municipio_destino||"");
 if(p.talhao)set("aduana",p.talhao);
 // A aduana não está cadastrada no 902: preservar preenchimento atual.
 if(Number(p.frete_padrao)>0)set("freteBRL",p.frete_padrao);
 set("frota",String(p.cavalo||"").split("-")[0].trim());
 set("adv",p.adv_percentual===null||p.adv_percentual===undefined||Number(p.adv_percentual)===0?"0.101":p.adv_percentual);
 $("pd902Desfazer").hidden=false;
 status.textContent="PC "+(p.pv||p.id)+" selecionada.";
 results.replaceChildren();
};
$("pd902Desfazer").addEventListener("click",()=>{if(!snapshot)return;Object.entries(snapshot).forEach(([k,v])=>set(k,v));snapshot=null;$("pd902Desfazer").hidden=true;status.textContent="Preenchimento anterior restaurado.";});
let debounce=null;
$("pd902Busca").addEventListener("input",()=>{clearTimeout(debounce);const q=$("pd902Busca").value.trim();if(q.length<2){results.replaceChildren();status.textContent="Digite pelo menos 2 caracteres.";return;}debounce=setTimeout(search,350);});
const search=async()=>{
 const q=$("pd902Busca").value.trim();if(q.length<2){status.textContent="Informe ao menos 2 caracteres.";return;}
 const raw=localStorage.getItem("sb-rqwmhywgckuwhbidqves-auth-token");let token="";
 try{token=JSON.parse(raw||"null")?.access_token||"";}catch(_){}
 if(!token){status.textContent="Entre no Menu Olive para consultar o 902.";return;}
 const btn=$("pd902Buscar");btn.disabled=true;status.textContent="Consultando cargas...";results.replaceChildren();
 try{
 const resp=await fetch("https://amuhvmvgwigihgzougwz.supabase.co/functions/v1/passar-dados-consulta-902",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({action:"search",q})});
 const payload=await resp.json();if(!resp.ok)throw Error(payload.error||"Falha na consulta");
 const items=payload.items||[];status.textContent=items.length?items.length+" carga(s) encontrada(s). Selecione uma:":"Nenhuma carga ativa encontrada.";
 for(const p of items){const btn=document.createElement("button");btn.type="button";btn.style.cssText="display:block;width:100%;text-align:left;padding:9px;margin-top:5px;border:1px solid #c7d6e7;border-radius:6px;background:white;cursor:pointer;color:#123";
 btn.innerHTML="<b>PC "+esc(p.pv)+" · Frota "+esc(p.cavalo)+"</b><div>"+esc(p.pagador)+"</div><small>"+esc(p.municipio_origem)+" / "+esc(p.uf_origem)+" → "+esc(p.municipio_destino)+" / "+esc(p.uf_destino)+" · Aduana "+esc(p.talhao||"não informada")+" · Frete R$ "+esc(p.frete_padrao)+" · ADV "+(p.adv_percentual==null?"não identificado":esc(p.adv_percentual)+"%")+"</small>";
 btn.addEventListener("click",()=>apply(p));results.appendChild(btn);}
 }catch(e){status.textContent="Consulta indisponível: "+e.message+". O preenchimento manual permanece disponível.";}finally{btn.disabled=false;}
};
$("pd902Buscar").addEventListener("click",search);$("pd902Busca").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();search();}});
})();