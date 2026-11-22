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
const set=(id,v,uf='')=>{const el=$(id);if(el&&v!==null&&v!==undefined){
 const cidade=String(v).trim();
 if(['origem','aduana','destino'].includes(id)){
   el.dataset.cidadeEsperada=cidade;
   if(uf)el.dataset.ufEsperada=String(uf).toUpperCase();
   else delete el.dataset.ufEsperada;
 }
 el.value=cidade;
 el.dispatchEvent(new Event("input",{bubbles:true}));
}};
const apply=p=>{
 snapshot=Object.fromEntries(ids.map(id=>[id,$(id)?.value??""]));
 set("origem",p.municipio_origem||"",p.uf_origem||"");set("destino",p.municipio_destino||"",p.uf_destino||"");
 if(p.talhao)set("aduana",p.talhao,p.uf_aduana||"");
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
 let token="";
 try {
   if (window.top && typeof window.top.marvelGetAccessToken === "function") {
     token = await window.top.marvelGetAccessToken();
   }
 } catch (err) {
   status.textContent="Não foi possível renovar a sessão do Menu Marvel. Entre novamente no sistema.";
   return;
 }
 if(!token){
   // Recuperação da sessão Supabase central quando o módulo foi carregado
   // isoladamente ou o iframe não consegue acessar a função do menu.
   try {
     const authClient=window.supabase?.createClient(
       "https://rqwmhywgckuwhbidqves.supabase.co",
       "sb_publishable_r4Ftl_7kEjwZVTOlY04pKg_Jp03aBH1",
       {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}
     );
     if(authClient){
       const {data,error}=await authClient.auth.getSession();
       if(!error)token=data?.session?.access_token||"";
       if(!token){
         const refreshed=await authClient.auth.refreshSession();
         if(!refreshed.error)token=refreshed.data?.session?.access_token||"";
       }
     }
   }catch(_){}
 }
 if(!token){status.textContent="Sessão de autenticação indisponível. Volte ao Início, saia e entre novamente no Menu Marvel.";return;}
 const btn=$("pd902Buscar");btn.disabled=true;status.textContent="Consultando cargas...";results.replaceChildren();
 try{
 const request=async(t)=>fetch("https://amuhvmvgwigihgzougwz.supabase.co/functions/v1/passar-dados-consulta-902",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},body:JSON.stringify({action:"search",q})});
 let resp=await request(token);
 if(resp.status===401 && typeof window.top?.marvelRefreshAccessToken==="function"){
   status.textContent="Renovando sessão para consultar o Painel 902...";
   token=await window.top.marvelRefreshAccessToken();
   resp=await request(token);
 }
 const payload=await resp.json();if(!resp.ok)throw Error(payload.error||"Falha na consulta");
 const items=payload.items||[];status.textContent=items.length?items.length+" carga(s) encontrada(s). Selecione uma:":"Nenhuma carga ativa encontrada.";
 for(const p of items){const btn=document.createElement("button");btn.type="button";btn.style.cssText="display:block;width:100%;text-align:left;padding:9px;margin-top:5px;border:1px solid #c7d6e7;border-radius:6px;background:white;cursor:pointer;color:#123";
 btn.innerHTML="<b>PC "+esc(p.pv)+" · Frota "+esc(p.cavalo)+"</b><div>"+esc(p.pagador)+"</div><small>"+esc(p.municipio_origem)+" / "+esc(p.uf_origem)+" → "+esc(p.municipio_destino)+" / "+esc(p.uf_destino)+" · Aduana "+esc(p.talhao||"não informada")+" · Frete R$ "+esc(p.frete_padrao)+" · ADV "+(p.adv_percentual==null?"não identificado":esc(p.adv_percentual)+"%")+"</small>";
 btn.addEventListener("click",()=>apply(p));results.appendChild(btn);}
 }catch(e){status.textContent="Consulta indisponível: "+e.message+". O preenchimento manual permanece disponível.";}finally{btn.disabled=false;}
};
$("pd902Buscar").addEventListener("click",search);$("pd902Busca").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();search();}});
})();