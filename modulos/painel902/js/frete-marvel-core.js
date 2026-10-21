/* Motor isolado: sem escrita em banco e sem efeitos na classificação do 902.
   Importar em integração após validar autenticação e acesso à Marvel. */
(function(root){
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const aliases = Object.freeze({
    'GARDEN FRUIT':'GARDEN',
    'COMERCIO DE CARNES BOI OURO':'BOI OURO',
    'MINERVA':'MINERVA',
    'SIMPLOT ARGENTINA':'SIMPLOT'
  });
  function nomeBusca(pagador){
    const p=norm(pagador);
    const match=Object.keys(aliases).find(k=>p.includes(k));
    return match ? aliases[match] : p.replace(/\b(S A|SA|LTDA|EIRELI|COMERCIO|INDUSTRIA|IMPORTACAO|EXPORTACAO)\b/g,' ').trim().replace(/\s+/g,' ');
  }
  function route(row){
    return {
      pagador:norm(row.pagador),
      origem:norm(row.municipio_origem ?? row.cidadeOrigem),
      ufOrigem:norm(row.uf_origem ?? row.ufRem),
      destino:norm(row.municipio_destino ?? row.cidadeDestino),
      ufDestino:norm(row.uf_destino ?? row.ufDest)
    };
  }
  function auditar(pc, tarifas){
    const r=route(pc), termo=nomeBusca(pc.pagador);
    if(!r.pagador || !r.origem || !r.ufOrigem || !r.destino || !r.ufDestino)
      return {situacao:'dados_incompletos',motivo:'Tomador ou rota incompleta'};
    const correspondentes=(tarifas||[]).filter(t=>{
      const tR=route(t);
      const titulo=norm(t.tabela ?? t.tarifa_marvel_nome ?? t.nome_marvel);
      return titulo.includes(termo) && tR.origem===r.origem && tR.ufOrigem===r.ufOrigem &&
        tR.destino===r.destino && tR.ufDestino===r.ufDestino;
    });
    if(!correspondentes.length) return {situacao:'nao_encontrado'};
    if(correspondentes.length!==1) return {situacao:'ambiguo',quantidade:correspondentes.length};
    const t=correspondentes[0];
    // Somente a coluna frete; não soma adicionais descritos na tabela.
    const valor=Number(t.frete);
    if(!Number.isFinite(valor)||valor<0) return {situacao:'erro',motivo:'Frete Marvel inválido'};
    const atual=Number(pc.frete_padrao ?? pc.frete ?? 0);
    return {situacao:atual===valor?'correto':'divergente',freteAtual:atual,
      freteMarvel:valor,diferenca:valor-atual,tarifaMarvelId:t.id??t.tarifa_marvel_id??null,
      tarifaMarvelNome:t.tabela??t.tarifa_marvel_nome??null};
  }
  root.FreteMarvelCore=Object.freeze({norm,nomeBusca,route,auditar});
})(typeof window !== 'undefined' ? window : globalThis);
