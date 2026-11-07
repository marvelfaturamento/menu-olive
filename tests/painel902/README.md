# Testes de regressão — Painel 902

Esta pasta protege as regras críticas do Painel 902 contra regressões.

## Objetivo
Antes de uma alteração do Painel 902 ser considerada segura, os cenários descritos em `scenarios.json` devem continuar válidos.

## Regras protegidas na primeira bateria
- Finalização 902: documento preenchido finaliza a programação correta por Filial + PC.
- PC igual em filiais diferentes não pode cruzar finalização.
- 624: finalização automática exige Pedido/Referência + UF origem + UF destino.
- Exportação BR -> EX ainda na cidade de origem permanece em Coleta, salvo regra especial de maior prioridade.
- Exportação BR -> EX com posição inequivocamente no exterior vai para Faturar / Alerta EXPO.
- IMPO EX -> BR com regra de aduana mantém prioridade Ag. Nota -> Aduana -> Faturar.
- Cliente de alerta nacional tem prioridade sobre a trava geral de cidade de origem.
- Checkpoint pendente é persistente e não deve desaparecer apenas por atualização de posição.
- Status avançados AG Nota, Aduana, Faturar e Finalizado não aparecem como checkpoint não confirmado.

## Segurança
Os testes usam dados fictícios. Não gravam no Supabase e não alteram dados de produção.

## Próxima camada
A suíte será evoluída para executar o motor de classificação isoladamente e, depois, para testes de navegador contra Preview Deployments da Vercel.

## Validador de Excel 902 real
O arquivo `validate-902.js` lê um Excel 902 fora do painel e gera `902-validation-report.json`. Ele é somente leitura: não inicializa Supabase, não chama APIs e não grava na produção.

Uso local (quando a dependência `xlsx` estiver disponível):
```
node tests/painel902/validate-902.js caminho/902.xlsx
```
Também aceita um segundo argumento JSON com as configurações de clientes/aduanas usadas na validação.

O relatório traz total de linhas, distribuição por bucket, motivo da classificação e inconsistências detectadas, incluindo mesma Filial + PC com estados divergentes.
