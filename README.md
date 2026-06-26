# Painel Operacional Unificado

Primeira versão segura da unificação.

## Estrutura

- `index.html`: Menu Pai central.
- `modulos/faturamento`: módulo de faturamento original.
- `modulos/refaturamento`: módulo de refaturamento original.
- `modulos/painel902`: módulo 902 original.
- `modulos/agrupaPdf`: junta CT-e/NF original.
- `modulos/leitor`: leitor scanner original.
- `modulos/instrutivo`: instrutivo original.
- `modulos/dados`: contém o arquivo RAR original, pendente de extração.

## Alteração feita

O Menu Pai passou a abrir os módulos por caminhos locais:

- `modulos/faturamento/index.html`
- `modulos/refaturamento/index.html`
- `modulos/painel902/index.html`
- `modulos/agrupaPdf/index.html`
- `modulos/leitor/index.html`
- `modulos/instrutivo/index.html`
- `modulos/dados/index.html`

Não foram alterados cálculos, conexões Supabase ou regras internas dos módulos.
