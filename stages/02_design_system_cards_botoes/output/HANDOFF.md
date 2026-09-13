# HANDOFF — ICM 02

## Status

Estado: pronto para revisão visual, validação técnica final e human gate.
Issue principal: #84
PR: #101
Branch: `icm/02-design-system`

## Entregue

- design tokens do tema claro/porcelana;
- malaquita estrutural e ouro restrito;
- famílias de botões PoliMatch;
- card TCG 5:7 reutilizável;
- slots para nome, papel, descrição e meta;
- estados Regular, Rara, Ultra e Chromas;
- Chroma Suprema e Comemorativa;
- playground visual em `/playground.html`;
- preview de duas cartas lado a lado;
- estados de interação e reduced motion;
- bridge de migração do CSS legado;
- front e PWA carregando o mesmo design system;
- correção do caminho do bridge no PWA;
- testes de contrato adicionados;
- workflow de CI adicionado para front e PWA.

## Pendências antes do merge

- confirmar visual em dispositivo real;
- confirmar execução de testes/build no CI;
- registrar human gate.

## Próximo passo depois da aprovação

1. Mesclar #101.
2. Fechar #84 e #97.
3. Abrir `icm/03-duelo-mobile-first`.
4. Reconstruir o shell do Duelo sem depender da estrutura visual antiga.

## Human gate

Status: pendente.
