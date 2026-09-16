# Handoff técnico — issue #167

## Entrega

A interação do duelo agora separa explicitamente intenção de voto e consulta do perfil. Os slots persistentes da #166, a entrada diária e a aposta da #178/#179, além do contrato de confirmação da #170/#193, foram preservados.

Arquivos centrais:

- `app/src/main.js`: artigos com dois controles, coach e perfil nativos, retorno de foco;
- `app/src/persistent-dom.js`: atualização granular dos dois controles por slot;
- `app/src/styles.css`: rodapé próprio de `44px` e composição responsiva;
- `app/e2e/accessible-profile.mjs`: roteiro completo de teclado e invariantes negativas;
- `.github/workflows/ui-interaction-smoke.yml`: gate novo nos dois motores.

## Decisões

- O perfil não contém ação de voto. Conhecer nunca altera escolha, contagem, `roundId` ou ranking.
- A pressão longa continua disponível, mas não é necessária para descobrir o perfil.
- O retorno de foco é explícito para também funcionar quando o perfil foi aberto pelo atalho de pressão longa no WebKit.
- O coach é persistente no DOM e usa `showModal()`, sem simular `aria-modal` em uma `div`.
- A rodada de aposta mantém a dica `Toque para apostar`, não expõe o botão de perfil e não confunde aposta com voto.
- Durante envio e recuperação, os dois controles do slot permanecem bloqueados; o perfil não abre enquanto a escolha está pendente.

## Estado dos gates

- Gate automatizado: 9 fluxos × 2 motores, 18/18 aprovados em Chromium e WebKit.
- Build e testes de regressão: aprovados; `npm test` fechou 152/152 (`shared` 4, `back` 58, `app` 90).
- Auditorias de produção: app e backend com 0 vulnerabilidades.
- Preview isolado: HTTP 200 em `127.0.0.1:4282`, `--strictPort`, processo vinculado a esta worktree.
- Gate humano com NVDA/VoiceOver: pendente; não bloqueia a revisão técnica, mas impede declarar a validação assistiva humana concluída.
