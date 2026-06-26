# Painel BI Faturamento - v1 modular

Estrutura:
- `index.html`
- `css/faturamento.css`
- `js/app.js`

Objetivo:
- Deixar o painel mais leve e mais fácil de manter.
- Preservar os cálculos e a integração atual com Supabase.

Teste recomendado:
1. Abrir `index.html` localmente.
2. Pressionar F12 → Console.
3. Verificar se não há erro de CSS/JS.
4. Testar Dashboard, Diário, Gráficos, Anual e Config.


## v11 - Valores Reais com Config visível
- Base limpa, sem blocos antigos de Receitas/Descontos.
- Mantém aba Config visível.
- Adiciona apenas Valores Reais do Mês.
- Valor Bruto Real substitui o bruto final do mês quando informado.
- Valor Líquido Real substitui o líquido final do mês quando informado.
- % Refaturado + Substituto passa a usar o líquido real quando existir.


## v12 - Valores reais na Supabase + Dashboard Operacional

Crie esta tabela na Supabase A:

```sql
create table if not exists valores_reais_faturamento (
  id uuid primary key default gen_random_uuid(),
  mes date unique not null,
  bruto_real numeric default 0,
  liquido_real numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table valores_reais_faturamento enable row level security;

create policy "allow_select_valores_reais"
on valores_reais_faturamento for select using (true);

create policy "allow_insert_valores_reais"
on valores_reais_faturamento for insert with check (true);

create policy "allow_update_valores_reais"
on valores_reais_faturamento for update using (true) with check (true);

create policy "allow_delete_valores_reais"
on valores_reais_faturamento for delete using (true);
```
