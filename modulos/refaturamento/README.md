# Painel Refaturamento otimizado v1

Base: Painel Refaturamento e Baixas(5).html.

Alterações:
- CSS extraído para css/refaturamento.css.
- JavaScript extraído para js/app.js.
- Bibliotecas via CDN.
- Conteúdos pré-renderizados pesados removidos do HTML inicial.
- Renderização mais leve: renderAll passa a atualizar a aba ativa.
- Aba Registros com paginação visual de 50 linhas.

Como subir:
- Subir index.html, README.md, pasta css/ e pasta js/ na raiz do repositório.
- Testar primeiro em Vercel de homologação.


## v2 - correção filtro mensal
- O seletor de mês agora prioriza o snapshot local salvo e filtra refaturados, substitutos e setores pela data real da baixa.
- Corrige o caso em que Jan/2026 exibia valores acumulados/gerais em vez do mês selecionado.


## v3 - substituir mês na Supabase
- Adicionado botão "Substituir mês na Supabase".
- Ele apaga somente o mês selecionado em refaturamento_importado e regrava com o Excel carregado.
- Não apaga outros meses.
- Use para corrigir meses duplicados/acumulados, como Jan/2026.


## v4 - correção duplicate key ao substituir mês
- Corrigido erro `refaturamento_importado_uk`.
- Antes de regravar, limpa os documentos do Excel atual mesmo que tenham sido salvos em mês errado anteriormente.
- Regrava usando `onConflict: documento`, compatível com a chave única atual da Supabase.


## v6 - correção duplicate key por documento
- O botão Substituir mês agora grava usando upsert por documento.
- Se o documento já existir na Supabase em outro mês, ele é atualizado para o mês importado.
- Evita o erro refaturamento_importado_uk.


## v7 - correção Supabase sem ON CONFLICT
- Removidos todos os upsert/onConflict do app.js.
- Substituir mês: apaga documentos existentes e insere novamente.
- Meses importados: delete + insert.


## v12 - Reimportar mês seguro
- Incluído botão "Reimportar mês seguro".
- Apaga `refaturamento_importado`, `produtividade_usuarios` e `meses_importados` do mês/ano selecionado.
- Confirma que as três tabelas ficaram zeradas antes de gravar.
- Só depois sincroniza o Excel carregado.
- Evita acúmulo e duplicidade ao corrigir um mês já existente.


## v13 - Fluxo limpo da Supabase
- Removido o botão "Substituir mês na Supabase".
- Botão "Sincronizar" renomeado para "Importar mês novo".
- Mantido "Reimportar mês seguro" para corrigir meses já existentes.
- Fluxo recomendado:
  - Mês novo: Importar Excel + produtividade → Importar mês novo.
  - Mês existente/correção: Importar Excel + produtividade → Reimportar mês seguro.


## v14 - Base modular segura
Estrutura criada para evolução modular do Refaturamento.

Arquivos principais:
- `index.html`
- `css/refaturamento.css`
- `js/app.js`

Novos módulos preparados:
- `js/modules/supabase-service.js`
- `js/modules/dashboard-view.js`
- `js/modules/registros-view.js`
- `js/modules/usuarios-view.js`
- `js/modules/clientes-view.js`
- `js/modules/setores-view.js`
- `js/modules/anual-view.js`
- `js/modules/reimportar-mes-seguro.js`
- `js/modules/utils.js`

Observação:
Nesta versão, a lógica validada continua em `js/app.js` para não quebrar o painel.
A pasta `modules` deixa o projeto pronto para mover as funções por etapas, com baixo risco.


## v15 - NÃO IDENTIFICADO na análise por setor
- Reconhece `NÃO IDENTIFICADO` como setor válido.
- Exibe valores sem classificação na tabela/gráfico por setor.
- Evita diferença entre Dashboard e Análise por Setor quando houver registro sem reduzido.
