# F01 — handoff do protótipo e dos componentes editoriais

Issue [#217](https://github.com/stefancabral-oss/presidencia-duelo/issues/217), branch `claude/open-issues-check-0y643o` sobre `main` `0200a05`. Autorização de Stefan em 21/09/2026 para executar F01 em paralelo com A01 e A02. Commit da unidade `e56c988`; árvore completa verificada em `03d9fe3`. PR registrada na issue.

## Entrega técnica

- Protótipo navegável dentro de `app/` (`VITE_CIVIC_MOCK=1`) com dados sintéticos identificados em tela: diretório com filtros, ficha com chapa e afirmações, comparação por temas equivalentes, edição com acontecimentos, acontecimento com três espaços, destino inexistente e área indisponível.
- Componentes e painel de estados em `app/src/civic/ui/` com estilos isolados (`civic.css`): fonte/localizador, data de referência, cobertura do recorte, situação oficial, placeholder de fotografia, cartão de integrante, seção de chapa, afirmação com natureza textual, cartão de cobertura por espaço, barra de filtros, barra de comparação.
- Estados carregando, vazio, erro/retry, parcial, não reconciliado, pendente, desatualizado, corrigido, retirado, restrito e limite; combinação de filtros sem resultado com orientação.
- Inventário, contrato de propriedades/eventos para F02–F06, matriz de estados ↔ fixtures, mapa FRONT/APP, hierarquia visual e checklist de semântica em [F01-prototype.md](../front/F01-prototype.md).
- Capturas em [F01-screens](F01-screens/) (15 JPEG, 390×844 e 1280×800, página inteira, Chromium), geradas pelo E2E.

## Evidências e limites

- Suíte do app: 198 aprovados; build aprovado. E2E Chromium 13/13 cenários confirma foco no título, ordem de Tab (título → filtros → cartões), larguras iguais dos cartões no desktop, três espaços por acontecimento com lacunas e motivo, links externos só HTTPS com `rel="noreferrer noopener"`, fotografia pendente com placeholder.
- Só especificação, sem medição: zoom até 200% e leitores de tela (NVDA/VoiceOver). Nenhuma sessão real de produto ou usabilidade ocorreu; capturas e testes não substituem essa evidência.
- Decisões e dúvidas registradas no protótipo: `Ranking` dentro de `Mais` versus `Notícias` dentro de `Mais`; rótulos das naturezas das afirmações; frase sobre o espaço internacional.

## Revisão humana pendente

Produto valida a proposta de navegação e a hierarquia; editorial valida linguagem de pendência/fonte e os rótulos; revisão assistiva humana e pessoas usuárias validam os fluxos centrais. #217 permanece aberta. Detalhes em [F01-verification.json](F01-verification.json).

## Reversão

Reverter o commit remove telas, componentes, CSS e capturas; nenhuma dependência do jogo, do banco ou do deploy.

## CI da PR #233

Head documental `ccb74d5`: UI Interaction Smoke aprovado em Chromium e WebKit (inclui `civic-navigation.mjs`), Design Validator e Civic Planning aprovados. Backend/Shared não dispara porque a PR não altera `back/` nem `shared/`. Registro posterior só de evidência; nenhum gate humano foi aprovado.
