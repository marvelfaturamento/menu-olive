# Integração Marvel → Painel 902 (em desenvolvimento)

## Diagnóstico confirmado em 13/10/2026
- Interface: `modulos/painel902/index.html`.
- Lógica: `modulos/painel902/js/app.js`.
- Banco: `public.painel_902`, `public.config_frete_padrao`.
- `painel_902` possui `municipio_origem`, `municipio_destino` e `frete_padrao`.
- `config_frete_padrao` possui `pagador`, `remetente`, `uf_origem`, `uf_destino`, `frete` e `ativo`, mas não possui municípios.

## Regras aprovadas
1. Início manual por botão **Buscar fretes zerados** no cadastro Frete Padrão.
2. Pesquisar na Marvel **sempre pelo tomador/pagador**, origem e destino.
3. Somente programações em Ag Nota e Aduana com frete zero.
4. Nunca substituir valor positivo; correspondências ambíguas ficam pendentes.
5. Usar a sessão autenticada do navegador; não armazenar senha na extensão.
6. Preservar regras e cadastros existentes; testar antes de gravar.

## Riscos encontrados no código atual
- `fretePadrao(row)` escolhe a primeira regra que combina pagador, remetente e UFs; não considera municípios.
- `reclassify()` reatribui `row.frete = fretePadrao(row)`, podendo apagar um valor consultado se ele não estiver representado corretamente nas regras.
- `dedupeFretes()` remove atributos não previstos no mapeamento; precisa ser adaptado antes de acrescentar municípios.
- Rotina de sincronização de configurações apaga e reinsere linhas de `config_frete_padrao`; a integração deve evitar executar esse fluxo para gravar uma tarifa individual.

## Próxima implementação
1. Adicionar municípios opcionais às regras, com migração reversível e compatibilidade com registros legados.
2. Garantir precedência de tarifa exata por município sobre tarifa genérica por UF, sem alterar as regras legadas existentes.
3. Implementar fila de consulta e prévia dos resultados, com atualização explícita somente após validação.
4. Criar extensão Chrome Manifest V3 para leitura da listagem Marvel; identificar URL e seletores reais por inspeção autorizada da página.
5. Testar com dados fictícios e somente depois habilitar atualização em ambiente de homologação.

Nenhuma alteração no banco de produção está autorizada por este documento.
