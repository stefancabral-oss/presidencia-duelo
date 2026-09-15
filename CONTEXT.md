# PoliMatch — Contexto global ICM

## Norte do produto

PoliMatch é um jogo casual de comparação entre personalidades públicas. Não é pesquisa eleitoral. O produto deve ser simples de jogar, visualmente próprio, colecionável e agradável no celular.

## Decisões atuais aprovadas

- O frontend anterior foi rejeitado e será substituído, não remendado.
- A direção de arte `Malaquita 2026 / Digital First` enviada em 13/09/2026 está aprovada e é a referência visual oficial.
- O shell usa malaquita escura; porcelana aparece em placas de nome e superfícies editoriais; ouro indica progresso e raridade.
- Cards têm moldura facetada, fotografia dominante, marca pequena, raridade no canto e placa inferior clara.
- Chromas ampliam luz, cor e materialidade progressivamente; o efeito prismático máximo é reservado à Chroma comemorativa.
- O catálogo mestre tem 125 pessoas reconhecíveis: 100 nomes políticos e 25 influenciadores. Por decisão do usuário em 15/09/2026, os influenciadores com fotografia aprovada também participam da edição principal enquanto a edição independente ainda não existe.
- O núcleo é uma rodada rápida de quatro pessoas: todas aparecem com a mesma exposição, um toque confirma uma única preferida e a rodada seguinte traz quatro novas opções.
- Cada escolha gera três comparações auditáveis para o ranking — a escolhida vence as outras três — mas conta como uma única rodada para o jogador e para os indicadores de uso.
- O menu de assuntos nasce pronto para expansão, mas somente `Eleições 2026` estará ativo na primeira edição; ela reúne todos os perfis com fotografia aprovada.
- `Influenciadores` poderá ser uma edição independente futura, sem retirar essas personalidades da edição principal atual.
- Escândalos e acontecimentos serão curadorias independentes, começando posteriormente por casos como Banco Master, Mensalão, INSS e 8 de Janeiro.
- Cada pessoa terá perfil educativo, fontes e contexto suficientes para uma escolha informada.
- Existirão ranking da edição e ranking pessoal. Ranking geral entre assuntos só será exibido quando houver mais de um assunto ativo.
- Cards e Chromas são colecionáveis; Chromas são obtidas por sorte e não determinam o ranking.
- Duelos usam carta padrão por default. Apenas o próprio jogador pode aplicar uma Chroma possuída àquela pessoa.
- Novos debates e discussões podem lançar novas Chromas versionadas sem alterar votos ou rankings anteriores.
- As fotografias serão curadas e tratadas com padrão profissional, sem alterar a identidade da pessoa.
- A aprovação visual dos retratos começa por um lote de dez pessoas antes da escala fotográfica completa.
- O app continua online-only: nenhuma escolha é confirmada antes do servidor.
- A identidade sonora usa efeitos curtos, neutros e sintetizados localmente após interação do usuário; nunca varia por pessoa e oferece controle persistente para desligar.
- Login social e publicação automática ficam fora do primeiro corte; compartilhamento será iniciado pelo usuário.

## Referências visuais aprovadas

- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/01_duelo_mobile.jpeg`
- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/02_sistema_raridades.jpeg`
- `stages/10_rebuild_eleicoes_2026/references/approved-art-direction/03_chroma_comemorativa.jpeg`

Essas peças definem direção de arte, não dimensões literais da interface. A implementação deve preservar leitura, toque e as quatro cartas completas na mesma tela: grade 2 × 2 no celular e uma fileira de quatro no desktop.

As explorações posteriores estão documentadas em `stages/10_rebuild_eleicoes_2026/references/ART_DIRECTION.md`. Elas podem fornecer textura editorial e inspiração para a revelação, mas não substituem a fonte de verdade.

## Estado técnico atual

- Frontend: Vite/JavaScript.
- PWA e frontend consolidados em `app/`; o diretório duplicado `front/` foi removido nesta reconstrução.
- Backend/API e ranking agregado já existem.
- Produção usa Dokploy e o autodeploy não tem se mostrado confiável; publicação precisa ser confirmada manualmente.
- Houve regressão anterior em que o PWA redirecionava para Ranking quando player-sync falhava; hotfix já foi aplicado.
- O redesign anterior foi parcial e sofreu com cascata CSS; esta rodada deve evitar overlays intermináveis e consolidar componentes novos.

## Objetivo deste programa ICM

Construir do zero um frontend coerente e testável para `Eleições 2026`, preservando somente contratos sólidos do backend e removendo as camadas visuais anteriores.

## Fora de escopo desta rodada

- SSO real e escolha de provedor OIDC.
- Migração de banco motivada apenas por autenticação.
- Construção das edições independentes `Influenciadores` e `Escândalos`.
- Manipulação de ranking para favorecer qualquer pessoa.
- Reescrita desnecessária do backend que não seja exigida pelo frontend.

## Gate final

O programa só é considerado concluído quando:

1. O usuário escolhe `Eleições 2026` e chega à primeira rodada de quatro sem ambiguidade.
2. As quatro cartas aparecem juntas, com a mesma exposição, sem exigir rolagem para decidir em iPhone e desktop.
3. A pessoa pode entender quem é cada participante sem perder a rodada atual.
4. O voto só produz resultado depois de confirmado pelo servidor.
5. Ranking da edição, ranking pessoal e coleção têm papéis claramente separados.
6. Cards básicos e revelação de Chroma passam por gate visual humano.
7. O catálogo mestre contém exatamente 125 pessoas e cada assunto público expõe apenas perfis e fotografias aprovados para aquela curadoria.
8. Testes críticos, build, deploy e QA pós-deploy são confirmados.
