# HANDOFF — ICM 18

Estado: primeira entrega implementada na branch `fix/save-anonymous-progress-234`; a funcionalidade principal permanece pendente.

Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/234
PR em rascunho: https://github.com/stefancabral-oss/presidencia-duelo/pull/235

## Feito nesta entrega

- A entrada anônima deixou de prometer "Salvar jogo": o botão agora diz "Entrar".
- O diálogo de Google distingue recuperar uma conta de salvar escolhas futuras.
- Se já houve escolhas anônimas, o diálogo avisa que elas ainda não são incorporadas a uma conta existente.
- Os testes de interface foram atualizados para a nova cópia.

Esta correção de linguagem **não** implementa a incorporação das escolhas. Não fazer deploy como se a issue #234 estivesse resolvida.

## Próxima implementação

1. Definir um vínculo auditável e idempotente de origem anônima para conta de destino, com revogação da credencial antiga.
2. Preservar `choice_rounds`/`votes` imutáveis e impedir qualquer novo voto público durante o vínculo.
3. Construir a visão pessoal consolidada de ranking, coleção e progresso diário, explicitando conflitos de slots diários.
4. Testar primeiro vínculo, conta existente, retry, concorrência, logout e retorno em outro dispositivo em PostgreSQL e navegador.

`player_stats` e `player_pools` são por `player_id`, assim como sessões/respostas/previsões diárias. Somar apenas os placares deixaria o histórico e a sessão inconsistentes; por isso não foi feito um merge parcial silencioso.

## Validação desta entrega

- `npm test --prefix app`: 167 testes passaram.
- `npm run build --prefix app`: passou, incluindo verificadores de assets.
- `VITE_GOOGLE_CLIENT_ID=e2e-client-id npm run build --prefix app`: passou para fluxo Google simulado.
- `interaction-smoke.mjs` e `prediction-identity.mjs` no Chromium: passaram.
- `git diff --check`: passou.

Pendente: implementação da incorporação, testes PostgreSQL correspondentes, PR, CI e gate humano. A issue permanece aberta.
