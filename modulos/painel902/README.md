# Painel 902 refatorado real v1

Base: Painel 902 v12.2 Paginação Supabase(9).html.

Alterações:
- CSS extraído para css/painel902.css.
- JavaScript extraído para js/app.js.
- Bibliotecas Supabase e XLSX via CDN.
- Tabelas pré-renderizadas removidas do HTML inicial.
- Paginação visual de 50 linhas por tabela no renderTable.

Como subir:
- Subir o conteúdo desta pasta na raiz do repositório.
- Manter as pastas css/ e js/.
- Testar primeiro em Vercel de homologação.


## v3 - regra exportação sem regra padrão
- Casos sem regra padrão, com UF destino EX, quando a UF da posição em BRASIL divergir da UF do remetente, sobem automaticamente para Alerta internacional expo.


## v4 - Importar 624
- Adicionado botão "Importar 624".
- Lê a coluna Observação do relatório 624/CT-e.
- Finaliza automaticamente somente quando a referência do 902 estiver preenchida, tiver pelo menos 5 caracteres e for encontrada dentro da observação do 624.
- Campos vazios não finalizam registros.


## v5 - Prioridade de Aduana corrigida
- Clientes cadastrados em "Clientes com regra de aduana" agora têm prioridade sobre alertas automáticos.
- Se a posição atual estiver em uma aduana monitorada, o registro permanece na aba Aduana.
- Isso vale mesmo se o status estiver como Faturar ou se a origem for EX.
- Só deve ir para Alerta IMPO/EXPO/Nacional após sair da aduana ou quando não tiver regra padrão.
