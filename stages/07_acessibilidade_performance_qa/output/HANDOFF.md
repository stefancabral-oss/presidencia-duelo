# HANDOFF — ICM 07

## Status

- Estado: pronto e validado
- Issue: #89
- PR: #113

## Entregue

- Controles nativos, foco visível, rótulos de cartas e diálogos acessíveis.
- Reduced motion, layout 390×844, preload limitado e proteção de cliques concorrentes.
- Smoke em Chromium/WebKit, estado legado, API indisponível e voto sincronizado.

## Evidência

- 229 testes de front, 16 de API e 4 do PWA.
- Builds front/PWA e Design Validator aprovados.
- CI do PR #113: Chromium, WebKit e validator verdes.

## Riscos conhecidos

- Imagens remotas continuam sujeitas a rate limit do provedor e possuem fallback visual.
