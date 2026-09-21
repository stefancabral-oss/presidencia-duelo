# A02 — handoff do cliente, estado público e preferência de UF

Issue [#224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224), branch `claude/open-issues-check-0y643o` sobre `main` `0200a05`. Autorização de Stefan em 21/09/2026 para executar A02 em paralelo com F01 e A01. Commit da unidade `1083e74`; árvore completa verificada em `03d9fe3`. PR registrada na issue.

## Entrega técnica

- `app/src/civic/client.js`: leitura anônima (`credentials: "omit"`), timeout, cancelamento, uma repetição só para falhas de transporte, `validateEnvelope` com `validateCivicRecord` do contrato B01 em cada registro, recusa de `changes`/`versions` e de identidade de editor no histórico, e `CivicReadError` com doze tipos.
- `app/src/civic/store.js`: um estado por área com época por requisição e `AbortController`; resposta antiga nunca sobrescreve filtro ou recorte mais recente; falha após leitura mantém a última versão permitida como desatualizada com `Retry-After`; 410 invalida a entrada local e remove o registro das listas; comparação incompatível conhecida é recusada sem requisição; ausência de edição é vazio, não erro.
- `app/src/civic/uf-preference.js`: seleção manual Brasil/UF validada contra os 27 códigos, chave `polimatch:civic:uf`, fallback em memória e reset. Sem geolocalização, sem vínculo com votos ou identidade Google.
- `app/src/civic/view-models.js` (coedição com FRONT) e `app/src/civic/mock-transport.js` com cenários de contraste sobre as fixtures sintéticas B01. Envelopes e caminhos HTTP propostos para B06 no [contrato](../app/A02-contract.md).

## Evidências e limites

- Unitários: `civic-client.test.js` (7), `civic-store.test.js` (8), `civic-uf-preference.test.js` (4); suíte do app com 198 aprovados. Cobrem corrida de requisições, troca de UF em voo, retenção da última versão, retirada, comparação incompatível, estados distintos e storage limpo.
- E2E Chromium: corrida de UF, retirada/limite e comparação; inspeção de `localStorage` no navegador encontrou só `polimatch:civic:uf`.
- Limites: endpoints reais são de B06 (#215) e a integração ponta a ponta é de A04 (#226); os caminhos `/api/civic/v1/*` são proposta. Logs não foram instrumentados (nada é registrado pelo cliente). Não houve leitura de API real.

## Revisão humana pendente

Produto revisa textos e recuperação de erro; responsável por privacidade confirma a preferência local e a ausência de vínculos com dados do jogador. #224 permanece aberta. Detalhes em [A02-verification.json](A02-verification.json).

## Reversão

Módulos isolados em `app/src/civic/`; reverter o commit não afeta jogo, banco ou storage do jogador. `clear()` remove a única chave gravada.

## CI da PR #233

Head documental `ccb74d5`: UI Interaction Smoke aprovado em Chromium e WebKit (inclui `civic-navigation.mjs`), Design Validator e Civic Planning aprovados. Backend/Shared não dispara porque a PR não altera `back/` nem `shared/`. Registro posterior só de evidência; nenhum gate humano foi aprovado.
