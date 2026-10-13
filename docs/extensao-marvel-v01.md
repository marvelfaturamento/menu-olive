# Extensão Marvel Fretes — versão 0.1 (somente leitura)

Protótipo Manifest V3 disponibilizado para teste local. A extensão usa activeTab + scripting, lê linhas visíveis de tabelas na página autenticada, exige tomador/origem/destino na mesma linha e recusa correspondências ambíguas. Não escreve no Supabase.

**Estado:** protótipo de validação; falta identificar DOM real da Marvel e integrar com o botão no Painel 902. Não habilitar gravação antes de testar o mapeamento das colunas, municípios e tarifa.

**Instalação:** Chrome → chrome://extensions → Modo do desenvolvedor → Carregar sem compactação. Os arquivos instaláveis foram disponibilizados como ZIP na conversa do projeto.

**Regras:** pesquisar sempre pelo tomador; atualizar apenas valores zero; não sobrescrever tarifas positivas; exigir correspondência inequívoca.
