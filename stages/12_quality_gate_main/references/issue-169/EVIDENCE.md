# Evidência — issue #169

## Contrato da rodada

- `personalFeedback`: canal primário obrigatório, calculado exclusivamente dos snapshots pessoais anterior e posterior.
- `globalEvent`: canal secundário opcional, emitido somente quando há um acontecimento público relevante.
- `feedback`: alias de compatibilidade que aponta para o mesmo conteúdo pessoal nas rodadas novas.
- `feedbackScope: "personal"`: marca persistida que impede confundir o canal global legado com o pessoal.

A ordem no DOM e na leitura assistiva é sempre `No seu ranking` antes de `No placar do público`. Quando não existe evento público relevante, o segundo bloco nem é renderizado.

## Critério do ranking pessoal

Política: `pairwise-majority-scc-v1`.

1. Cada rodada de quatro cartas gera três comparações diretas entre a escolha e as demais cartas.
2. Para cada par, vence a direção com maioria de escolhas observadas; empate não cria aresta.
3. Ciclos são condensados em um mesmo componente fortemente conexo.
4. As camadas do grafo condensado definem posições de competição; componentes sem relação resolvida podem compartilhar posição.
5. Elo, número de exposições e ID não são usados para desempatar a preferência. Eles continuam visíveis somente como contexto.

## Regressão de 35 rodadas

O teste `the measured 35-round regression no longer uses exposure or Elo as a tiebreak` reproduz 35 rodadas, 53 pessoas e 105 comparações. O cenário comprova que a ordenação pessoal não deriva aprovação aparente ou Elo de exposições desiguais:

- cinco pessoas invictas, mas sem comparação entre si, compartilham a posição 1;
- Lula fica na posição 6 porque existe maioria direta de Janja sobre Lula;
- as posições históricas arbitrárias `1/2/3/4/6/9`, produzidas por exposição/Elo, não são reutilizadas.

## Compatibilidade e recuperação

- Rodada nova: persiste feedback pessoal e feedback público em colunas separadas e restaura ambos de forma idempotente.
- Rodada antiga: o campo genérico é tratado como fato global legado; a resposta fornece feedback pessoal neutro e mantém o conteúdo antigo somente em `globalEvent`.
- O smoke PostgreSQL simula uma instalação anterior à #169, executa novamente a inicialização e valida a migração aditiva e o replay legado.

## Evidência visual

- `feedback-personal-390x844.png`: somente o canal primário, sem espaço vazio para evento público.
- `feedback-both-390x844.png`: canal pessoal primeiro e canal público explicitamente secundário.
- `personal-ranking-390x844.png`: política visível e posições compartilhadas para empates reais.

## Validação local

- Back: 27/27 testes.
- App: 49/49 testes.
- Build: aprovado, com 99/125 retratos disponíveis.
- Interação: Chromium com os dois cenários e WebKit com os dois canais.
- Responsividade: 3 telas × 16 viewports em Chromium e WebKit.
- Recuperação de voto: Chromium e WebKit.

O ambiente local não possui Docker/PostgreSQL. A execução real do smoke de migração fica a cargo do job PostgreSQL 16 já obrigatório no CI de `back/`; o script e suas asserções estão versionados nesta unidade.
