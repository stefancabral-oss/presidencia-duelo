# Evidência — Issue #170

## Política aplicada

| Superfície | Regra | Bloqueio esperado |
|---|---|---|
| escrita no ranking | token opaco de jogador obrigatório | `401 PLAYER_SESSION_REQUIRED` |
| rodada por jogador | 8 novas rodadas por minuto UTC | `429 VOTE_RATE_LIMITED` |
| rodada por jogador | 30 novas rodadas por dia UTC | `429 VOTE_DAILY_LIMIT` |
| emissão anônima | 3 jogadores novos por dia UTC e pseudônimo de rede | `429 PLAYER_ISSUANCE_LIMIT` |
| replay | mesmo `roundId` e mesma escolha não consomem nova cota | resposta idempotente original |

A decisão normativa completa está em `docs/security/VOTE_ABUSE_POLICY.md`. O commit de política (`fa9f005`) antecede os commits de implementação.

## Prova de abuso

`back/scripts/vote-abuse-smoke.mjs` executa contra PostgreSQL real e prova, em sequência:

1. a quarta emissão anônima da mesma rede no dia é bloqueada;
2. voto sem token não altera ranking;
3. a nona rodada nova no minuto é bloqueada;
4. o limite diário de 30 rodadas bloqueia a seguinte;
5. repetir uma rodada confirmada continua permitido;
6. o replay não aumenta contadores nem versão.

O workflow `back-shared.yml` executa essa prova no job PostgreSQL 16. Localmente não havia instância PostgreSQL disponível; por isso, o resultado vinculante será o run do CI da PR.

## Matriz CORS e configuração

| Caso | Ambiente | Resultado automatizado |
|---|---|---|
| `https://polimatch.com.br` | produção padrão | permitido |
| `https://www.polimatch.com.br` | produção padrão | `403` |
| origem hostil | produção | `403` antes da rota |
| localhost | desenvolvimento | permitido |
| localhost | produção | `403` salvo configuração explícita |
| segredo ausente/curto | produção | inicialização rejeitada |
| `TRUST_PROXY_HOPS` ausente/inválido | produção | inicialização rejeitada |

Os testes unitários também cobrem pseudônimo HMAC, equivalência de endereços IPv6 no mesmo `/64` e agrupamento seguro de endereços inválidos.

## Contrato de erro interno

Em `500`/`503`, o cliente recebe somente `erro interno`, `INTERNAL_ERROR` e `requestId`; `X-Request-Id` carrega a mesma correlação. Os testes confirmam que mensagem de banco e stack não saem na resposta. O log estruturado preserva status, código, mensagem e stack, mas não inclui `Authorization`, corpo, token ou IP bruto.

## Estados visuais e invariantes

| Estado | Mensagem/ação | Cartas e troca | Rodada e contador |
|---|---|---|---|
| `sending` | `Confirmando sua escolha…` | bloqueadas | preservados |
| `401` | `Sua sessão precisa ser restabelecida` / `Restabelecer sessão` | bloqueadas | preservados |
| `429` | espera explícita / repetição só após o prazo | bloqueadas até o prazo | preservados |
| `5xx` | `Não foi possível confirmar agora.` / `Tentar novamente` | bloqueadas | preservados |

O teste em navegador também comprova que:

- o `401` não emite credencial automaticamente e uma ação explícita emite exatamente uma;
- `429` e `5xx` repetem exatamente `roundId`, vencedor e conjunto de candidatos;
- nenhum dos estados não confirmados avança o contador ou troca as cartas;
- segredo interno simulado não aparece no DOM.

## Artefatos

- Chromium: `chromium-sending.png`, `chromium-401-session-required.png`, `chromium-429-rate-limited.png`, `chromium-503-server-error.png` e `chromium-states.json`.
- WebKit: `webkit-sending.png`, `webkit-401-session-required.png`, `webkit-429-rate-limited.png`, `webkit-503-server-error.png` e `webkit-states.json`.
- Os registros JSON deixam `screenshot` vazio nos estados-base que servem apenas para comparação automatizada e não possuem captura versionada.
