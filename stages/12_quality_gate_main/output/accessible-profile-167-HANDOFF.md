# Handoff técnico — issue #167

## Entrega

A interação do duelo agora separa explicitamente intenção de voto e consulta do perfil. Os slots persistentes da #166 e o contrato de confirmação da #170/#193 foram preservados.

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

## Estado dos gates

- Gate automatizado: aprovado em Chromium e WebKit.
- Build e testes de regressão: aprovados; `npm test` fechou 112/112.
- Gate humano com NVDA/VoiceOver: pendente; não bloqueia a revisão técnica, mas impede declarar a validação assistiva humana concluída.
