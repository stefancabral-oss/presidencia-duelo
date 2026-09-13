# PoliMatch — Contexto global ICM

## Norte do produto

PoliMatch é um jogo casual de comparação entre personalidades públicas. Não é pesquisa eleitoral. O produto deve ser simples de jogar, visualmente próprio, colecionável e agradável no celular.

## Decisões já aprovadas

- Frontend claro/porcelana como base.
- Malaquita como estrutura e identidade.
- Ouro usado com contenção.
- Chromas são a principal fonte de cor, brilho e raridade.
- Card mais alto, com proporção inspirada em TCG: imagem dominante e bloco inferior de informação.
- Não usar botão separado "Escolher": votar tocando/clicando diretamente na carta.
- Card precisa ter espaço para: nome, quem é, o que faz e descrição curta.
- Ícones, labels e badges dentro do card devem ter escala consistente e não competir com o rosto.
- Navegação e botões precisam ser exclusivos do PoliMatch, não componentes genéricos reaproveitados visualmente.
- Som faz parte da UX: tap, escolha, troca de aba, modal, sucesso, erro, conquista, combo, zebra, chroma e mudança relevante de posição.
- Haptics devem acompanhar eventos importantes quando suportados.
- Gamificação pode incentivar continuidade, coleção, disputa, defesa de posição e recuperação, mas não deve favorecer ideologicamente uma pessoa/candidato.
- O último colocado pode receber feedback de recuperação; o líder pode receber feedback de defesa de posição. A linguagem deve ser neutra e baseada em estado de jogo.
- SSO real será feito depois. Nesta rodada, apenas preservar compatibilidade para futura autenticação.

## Estado técnico atual

- Frontend: Vite/JavaScript.
- PWA em `app/`, front compartilhado em `front/`.
- Backend/API e ranking agregado já existem.
- Produção usa Dokploy e o autodeploy não tem se mostrado confiável; publicação precisa ser confirmada manualmente.
- Houve regressão anterior em que o PWA redirecionava para Ranking quando player-sync falhava; hotfix já foi aplicado.
- O redesign anterior foi parcial e sofreu com cascata CSS; esta rodada deve evitar overlays intermináveis e consolidar componentes novos.

## Objetivo deste programa ICM

Construir um frontend novo, coerente e testável, substituindo a sensação de "site com cards" por um app de jogo/coleção premium.

## Fora de escopo desta rodada

- SSO real e escolha de provedor OIDC.
- Migração de banco motivada apenas por autenticação.
- Mudança ideológica/editorial no catálogo.
- Manipulação de ranking para favorecer qualquer pessoa.
- Reescrita desnecessária do backend que não seja exigida pelo frontend.

## Gate final

O programa só é considerado concluído quando:

1. Duelo funciona sem regressão em iPhone e desktop.
2. Cards respeitam proporções e hierarquia aprovadas.
3. Sistema de botões é consistente em todas as telas.
4. Som pode ser ligado/desligado e não é invasivo.
5. Collection/Chroma tem destaque real.
6. Ranking e Torneio usam o mesmo sistema visual.
7. Testes críticos passam.
8. Deploy é confirmado em produção.
9. QA pós-deploy é executado.
