-- Execute uma vez no SQL Editor do Supabase do Painel 902.
-- Os campos são necessários tanto no espelho ativo quanto no histórico de finalizados.

alter table public.painel_902
  add column if not exists municipio_origem text,
  add column if not exists municipio_destino text;

alter table public.painel_902_finalizados
  add column if not exists municipio_origem text,
  add column if not exists municipio_destino text;
