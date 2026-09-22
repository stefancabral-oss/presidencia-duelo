# ICM 18 — Salvar escolhas anônimas ao voltar à conta Google

## Pedido e mudança de decisão

Stefan confirmou que o botão **Salvar jogo** deve guardar as escolhas feitas
deslogado também quando a conta Google já existia. Isto substitui, somente
neste fluxo e com a credencial anônima apresentada pelo próprio navegador, a
decisão da etapa 11 de não fundir históricos automaticamente.

Issue: #234. Base: `main` `0200a05`.

## Fonte de verdade e limites

- O voto público, seu recibo e os cortes diários publicados são imutáveis.
- Entrar na conta pode incorporar preferências ao histórico pessoal, mas não
  registra novos votos públicos ou altera métricas agregadas.
- A operação deve ser transacional, idempotente, auditável e de origem única.
- A chave anônima da origem deixa de autenticar depois da incorporação.
- Não inventar solução silenciosa para dois históricos diários que ocupem o
  mesmo slot. Preservar ambos e comunicar explicitamente a sessão ativa.
- O login sem escolhas anônimas continua simples e sem alteração no ranking.

## Escopo

Contrato de incorporação da sessão anônima, backend de autenticação/ranking e
estado de login da PWA. Testes unitários, PostgreSQL e browser proporcionais.

## Fora de escopo

Fusão arbitrária de duas contas Google, edição de votos/cortes publicados,
redesign geral do app, novas edições cívicas, deploy automático ou fechamento
da issue sem validação humana.

## Gate

PR e CI aprovados; prova de ausência de voto público adicional; Stefan testa
com uma conta real os fluxos de sair, jogar anônimo e salvar. A issue permanece
aberta até esse aceite.
