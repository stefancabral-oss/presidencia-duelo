# Entrega consolidada — PR #205

PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/205

A causa comum era a ausência de contratos persistentes para os novos modos e
uma interface que mostrava eventos internos do ranking. A PR emite pares antes
do voto, mantém confirmação idempotente, separa o descarte, concede inventário
real e devolve escolhas em linguagem compreensível. Quatro cartas continuam no
modo livre e nas dez escolhas diárias.

## Decisões e contratos

- Aquecimento: três pares por identidade. Desempate: maior variância posterior
  Beta(1,1), inclusive contagens desiguais. Alvo de precisão 0,025, atingido no
  máximo após sete observações de cada par. A contagem é um limite superior
  para o recorte atual; não prova ordem estrita nem elimina preferências
  empatadas. Empates na fronteira do quinto lugar entram inteiros no recorte.
- Rodadas nascem no servidor. `choice_rounds` recebe migração com cardinalidade
  por modo; replays conservam feedback inclusive após retirada editorial.
  Aquecimento e desempate consomem a cota de escolhas livres, sem ampliar a
  cota total. Não se reintroduziu `/api/vote`.
- Descarte opcional: `round_discards` é separado de `votes`, não muda Elo,
  vitórias ou derrotas. Pular também é decisão persistente. A repetição deve
  manter o mesmo conteúdo. `discard_offers` registra apresentações reconhecidas
  pelo servidor; rodadas históricas sem apresentação não entram no denominador.
  `GET /api/discard-metrics` é privado, aceita `editionId` e devolve apresentadas,
  respondidas, puladas, pendentes e taxa. Perda de rede no aviso de apresentação
  pode subcontar pendências; uma resposta confirmada também registra a oferta.
- Coleção: doze acabamentos universais, uma aquisição por sessão diária completa,
  sem duplicatas; esgotado o catálogo, a sessão guarda recibo sem novo item.
  Sem venda, compra indireta, patrocínio, valor monetário ou raridade associada
  a pessoa/partido. Inventário é privado e sobrevive ao reinício. A regra foi
  registrada no CONTEXT antes do código. `COLLECTION_ENABLED=false` permite
  desativação operacional. Esta decisão de produto não é parecer jurídico.
- Espelho: área, partido e grupo vêm do snapshot V4, com revisão de conteúdo
  aprovada; inferências e lacunas não viram afirmações. V1/V2/V3 permanecem
  legíveis. A comparação usa a última sessão completa cujo dia fechou, distingue
  empates e compara escolhas com líderes de cada rodada. Não calcula ideologia
  ou porcentagem de pessoas com um perfil igual. Exige receipt independente
  `mirror-comparison`; os textos e a superfície entram no fingerprint revisável.
- Confirmação: sem Elo ou patente na tela; API conserva os dados. Posição
  exibida segue a mesma ordenação da lista e do pódio. Ranking pessoal é padrão.
  Zebra usa probabilidade da rodada inteira, com limiar 10%; comparar só com o
  melhor adversário seria matematicamente igual ao antigo OR de três pares.

## Verificação observada

- Follow-up da revisão automática da PR: a falha persistente ou resposta incompleta
  do descarte permite continuar sem confirmar, conservando repetição idempotente
  enquanto a pessoa permanece nessa decisão. Continuar não envia uma segunda
  decisão nem alega que o descarte não foi salvo. O E2E falhou no runtime anterior
  por ausência dessa saída e passou após a correção, cobrindo 503 e HTTP 200 incompleto.
- CONTEXT da raiz explicita que a #183 autorizada substitui a suspensão temporária
  da entrada Coleção. A política de cotas explicita as vinte escolhas compartilhadas
  entre livre/aquecimento/desempate, sem aumentar os limites ou alterar snapshots.
  PostgreSQL verifica que três votos de aquecimento consomem três unidades, mesmo
  com replays, e que as dez escolhas diárias continuam disponíveis.
- 331 testes unitários passaram localmente; build e validação de assets passaram.
- PostgreSQL no CI passou após corrigir a comparação entre hash da edição inteira
  e hash das quarenta cartas selecionadas (universos diferentes).
- `game-progress.mjs`: aquecimento, bloqueio durante envio, descarte com
  falha/repetição e foco, conclusão, Espelho, inventário, desempate e modo livre.
- `game-recovery.mjs`: sete regressões de envio, identidade, foco, atualização e
  expiração de permissões e alcance por toque. Sonda independente encontrou
  cinco falhas em aa21180, duas em 995a319 e passou 7/7 em 73742a5. Foi incorporada
  ao CI para Chromium e WebKit. As APIs de navegador são simuladas; PostgreSQL
  é exercitado separadamente em banco descartável, nunca com votos de produção.
- `interaction-smoke.mjs` preserva checks de geometria, foco, DOM persistente e
  navegação; agora exige linguagem de escolhas em vez do jargão removido.
- Medição reproduzível em `feedback-measurement.json`: 4.000 rodadas sintéticas,
  dez sementes, 54 forças latentes e deltas Elo de produção. Zebra: 32,225% antes,
  2,125% depois. Sonda de 35 mensagens: sete templates, cinco ocorrências cada.
  É simulação, não pesquisa com usuários nem frequência observada em produção.

Os seis checks passaram no commit de runtime `7e7491bfc875664cf88c3b830e6f22f5b55f7ee4`.
Resultados, links e limites estão em `verification.json`; commits posteriores de
evidência não mudam o runtime verificado.

## Matriz por issue

| Issue | Entrega/evidência | Limite de encerramento |
| --- | --- | --- |
| #151 | Sons neutros, controle persistente e testes existentes preservados; confirmação comum usa som confirm, zebra rara usa zebra. | Escuta real de timbre/volume após deploy ainda pendente. |
| #156 | Feedback transacional, replay e compatibilidade histórica preservados; pares produzem uma comparação, quatro produzem três. | Validação humana da experiência completa ainda pendente. |
| #166 | DOM/foco persistentes e sete regressões adicionais testadas. | Relato do que NVDA/VoiceOver anunciou continua pendente. |
| #167 | Perfil explícito por teclado, dialog nativo e roteiro acessível existentes preservados. | Revisão humana assistiva do estágio anterior não foi simulada. |
| #171 | Gate editorial, provenance e recuperação mínima da PR #204 preservados. | Nenhum dos 125 textos foi promovido a aprovado; fotos restauradas não equivalem a conteúdo aprovado. |
| #173 | Vocabulários fechados, origem por item e validações das 125 pessoas já integrados e testados. | 111 áreas inferred e demais lacunas precisam revisão editorial, conforme handoff anterior. |
| #175 | Checks backend/shared/DB/navegador e revisão independente; nenhuma alteração direta de main. | Macro permanece dependente dos gates reais e da decisão de adiar #176. |
| #176 | Guia, separação foto/arte e isolamento dos assets preservados. | Adiada explicitamente por Stefan em #202; não produzir/validar novo piloto nesta entrega. |
| #177 | Mecânicas consolidadas na mesma PR conforme autorização de Stefan. | O retrato completo ainda depende de dados aprovados; a macro não está integralmente concluída. |
| #180 | Motor de três eixos, fechamento, comparação de sessão fechada e testes sintéticos. | Catálogo recuperado não tem três eixos aprovados; não chamar o Espelho de produto pronto apenas por mostrar lacunas. Publicação comparativa requer receipt. |
| #181 | Descarte próprio sem efeito em ranking; linguagem própria; medição por apresentação/sessão. | Implementação técnica pronta para revisão, sem alegar playtest humano. |
| #182 | Dois modos, migração, emissão/idempotência, precisão e fecho explícitos; quatro preservadas. | Empates honestos permanecem; novas escolhas podem mudar o recorte e a contagem. |
| #183 | Inventário real, navegação e aquisição gratuita; demo removida. | Não há monetização; qualquer introdução futura de venda exige nova decisão de risco. |
| #184 | Sem jargão na UI, zebra rara medida, posição consistente e ranking pessoal padrão. | Dependência de conteúdo do Espelho #180 permanece declarada. |
| #202 | Recuperação da PR #204 mantida; consolidação nesta PR. | Novas mecânicas não foram implantadas nesta execução. |

## Produção e próximo passo

A recuperação está publicada no release `8d7a46db4c5eceb3179cf0add0ba6634397d1c66`,
com 54 fotos verificadas, conforme stage 15 e comentário de deploy da PR #204.
Não mudamos variáveis de produção, banco ou deploy durante a consolidação.

Revisar a PR com os checks finais, sem confundir aprovação de código com revisão
editorial, escuta ou leitor de tela. A PR não é mesclada automaticamente e não
fecha artificialmente as issues dependentes desses resultados. A solicitação
de todas as issues prontas não foi atingida integralmente enquanto persistem
essas pendências explícitas.
