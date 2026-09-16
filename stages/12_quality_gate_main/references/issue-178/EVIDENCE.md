# Evidência — Issue #178

## Contrato entregue

- Cada preferência diária confirmada abre uma pergunta opcional sobre qual das mesmas quatro cartas será a mais escolhida pelo recorte do dia. O jogador pode escolher uma carta ou pular.
- Preferência e aposta possuem IDs, tabelas e operações distintas. Uma aposta nunca executa o cálculo de Elo, não grava voto, não altera ranking e não avança a preferência diária.
- O servidor só aceita o próximo slot pendente da edição e do jogador autenticado. A ordem das quatro cartas vem da rodada materializada; o cliente não consegue substituir edição, jogador, slot ou conjunto de candidatos.
- O app atual declara `predictionContractVersion: 1`; nesse contrato, enquanto a aposta do slot anterior não for respondida ou pulada, uma nova preferência diária é recusada. Clientes da #179, que não enviam essa capacidade, podem concluir preferências sem o servidor fabricar pulos. Ao atualizar, retomam o backlog real pelo primeiro slot ainda sem aposta.
- Toda sessão transporta os dez quartetos materializados. Catálogo e rodadas precisam formar uma partição exata `10×4`; todas as preferências, apostas, pendências e a rodada atual são correlacionadas ao quarteto do próprio slot, com IDs idempotentes únicos.
- O palpite usa uma linha de base visível de 25%, correspondente à escolha casual entre quatro cartas. A precisão acumulada é a única métrica de treino.

## Persistência, atomicidade e idempotência

- `daily_predictions` guarda `prediction_id`, edição, jogador, slot, `answer_id`, o array autoritativo de candidatos, candidato previsto ou pulo explícito e horário da resposta.
- Chaves compostas ligam a aposta tanto à resposta do mesmo jogador quanto à rodada exata da edição. `CHECK`s exigem exatamente uma das opções — candidato válido ou pulo — e um trigger torna o registro imutável.
- A primeira escrita válida do slot vence. Repetir o mesmo `prediction_id` e payload devolve a confirmação anterior; outro ID ou payload para o slot já respondido é recusado.
- Há duas barreiras deliberadamente separadas. Preferências usam o lock compartilhado `daily-cut`; a publicação adquire sua versão exclusiva e, na ordem global, também a versão exclusiva de `daily-prediction-reveal` antes de ler ou publicar o corte. Apostas usam a versão compartilhada da segunda barreira. Assim o próprio corte espera apostas já admitidas, o histórico lê um estado cumulativo fechado e nenhuma aposta nova atravessa a publicação.
- Um replay idêntico continua consultável depois da virada do dia, sem criar escrita retroativa. Uma nova tentativa após o fechamento recebe `DAILY_EDITION_CLOSED` e o cliente abre a edição vigente.

## Revelação lacrada e apuração

- Não há endpoint de distribuição parcial de apostas ou preferências. A tela de aposta mostra somente as quatro cartas, o próprio estado e a linha de base.
- O histórico privado descobre apenas edições do próprio jogador cujo `closes_at` já passou. Para cada uma, primeiro obtém o corte diário persistido e validado; somente então calcula o resultado individual a partir desse corte imutável.
- A distribuição comparada é a distribuição real das preferências entre jogadores que concluíram a edição, nunca uma contagem das apostas.
- Maior contagem única define a carta vencedora. Empate no topo e edição sem amostra são neutros; pulos e slots sem resposta também não entram no denominador.
- Acurácia é `acertos / (acertos + erros)`. O histórico expõe separadamente acertos, erros, neutros e pulos e sinaliza amostra pequena sem transformar o produto em pesquisa eleitoral.

## Resiliência e acessibilidade

- Falha ao salvar mantém a mesma identidade idempotente para retry; estado incerto oferece repetir a mesma tentativa ou sincronizar novamente com o servidor.
- Um `200 created` de aposta só avança a interface se `predictionId`, edição, slot, candidato/pulo e status coincidirem exatamente com a tentativa, nenhuma preferência mudar ou surgir e a sessão acrescentar exatamente uma aposta com progresso `+1`. Em `alreadyProcessed`, prefixos precisam permanecer idênticos, mas avanços monotônicos reais de outra aba são aceitos. Corpo truncado, candidato fora do quarteto ou mutação extra preserva o slot e a chave de retry.
- Se o retry idempotente atravessar a meia-noite, o cliente primeiro instala a resposta antiga já correlacionada e só depois transiciona explicitamente para a edição vigente; a edição nova nunca é reinterpretada como corpo da confirmação antiga nem dispara loop de retry.
- Falha ao carregar o histórico ou o diário não derruba home, ranking, login nem modo livre.
- Login e logout invalidam consultas antigas e limpam `loading`, resultados, erros, tentativa e seleção de aposta; a identidade seguinte pode abrir seu próprio placar mesmo se a resposta anterior chegar atrasada.
- Cartas de aposta exibem e anunciam “Toque para apostar”, funcionam por teclado com foco visível e `Enter` e suprimem o clique gerado depois de uma pressão longa. O botão de pular permanece uma ação explícita.
- A interface compacta foi exercitada em `320×568` sem overflow horizontal e mantém textos de lacre, separação de métricas e baseline visíveis.

## Validação defensiva da revelação

- Antes de renderizar, o cliente exige identidade completa e autoconsistente da edição: tema, ruleset, versão, schema, hashes, ID derivado, tamanho elegível, dez slots, quatro cartas e janelas editoriais à meia-noite de São Paulo.
- O snapshot revelado contém exatamente 40 IDs únicos, e os dez slots formam uma partição exata `10×4`, sem reutilização ou carta alheia ao catálogo.
- `publishedAt` não pode anteceder o fechamento. Preferências e apostas precisam estar dentro da janela, em ordem temporal, sem lacunas ou IDs repetidos; toda aposta exige sua preferência correspondente.
- `completed`, metodologia, aviso de amostra, distribuições, líderes, empates, percentuais e totais acumulados são recalculados e comparados antes da renderização.
- A regressão `ACCEPTED_INVALID_REVEAL` reproduz payloads anteriormente aceitos apesar de identidade reinterpretada, partição quebrada ou histórico incoerente e comprova sua recusa.

## Cobertura automatizada

### Unitários e build local

- `npm run test:shared`: 4/4.
- `npm test --prefix back`: 58/58.
- `npm test --prefix app`: 81/81.
- `npm run build --prefix app`: aprovado; a auditoria de retratos encontrou 99/125 slots com imagem aprovada e preservou os 26 pendentes já conhecidos.
- `npm audit --prefix back --audit-level=high`: zero vulnerabilidades. O app mantém o único alerta conhecido em `playwright <1.55.1` (`GHSA-7mvr-c777-76hp`); a dependência não foi atualizada por determinação explícita desta reabertura.

### Navegadores locais

Chromium e WebKit aprovaram a regressão completa:

- `interaction-smoke.mjs`;
- `responsive-layout.mjs`: 3 telas em 16 viewports;
- `vote-recovery.mjs`;
- `vote-trust-states.mjs`;
- `daily-session.mjs`;
- `daily-prediction.mjs`;
- `prediction-identity.mjs`.

Os cenários específicos de diário e aposta cobrem mesmas quatro cartas, teclado, retry após resposta perdida, `200` divergente sem avanço, pressão longa sem perfil ou aposta acidental, retomada autoritativa, troca de identidade durante load, virada de data, lacre sem parcial, revelação após corte, empate neutro, baseline de 25%, falha isolada e viewport `320×568`.

## PostgreSQL 16

`back/scripts/topic-store-smoke.mjs` foi ampliado para provar em banco real:

1. aposta obrigatoriamente posterior à resposta do mesmo slot, bloqueio do próximo voto no contrato v1 e compatibilidade legada com 10 preferências/0 apostas sem pulos inventados;
2. idempotência concorrente do mesmo ID e vitória única entre IDs diferentes;
3. invariância integral dos rankings geral e pessoal antes e depois da aposta;
4. escolha fora das quatro cartas, ordem forjada e `UPDATE` de aposta recusados pelo banco;
5. alternância de escolhas e pulos nos dez slots, conclusão e histórico acumulado;
6. corridas entre última resposta e corte e entre aposta admitida e publicação, incluindo espera do corte, presença da aposta no histórico e recusa de novo ID pós-fechamento;
7. recusa do corte antecipado e histórico vazio durante a edição aberta, sem distribuição parcial;
8. distribuição, baseline e contabilidade de acerto/erro/neutro derivados do corte, incluindo resultado válido para histórico legado 10/0 e cauda parcial.

Não há PostgreSQL ou Docker nesta estação. O script passou na verificação de sintaxe, mas sua execução local ficou indisponível; o resultado vinculante deve vir do job obrigatório `back-integration-postgres` com PostgreSQL 16. Nenhum CI remoto foi observado nesta worktree local.

## Limite da evidência

Não foi declarada validação humana ou aprovação visual manual. As afirmações acima vêm de testes automatizados, inspeção dos contratos e build local; a evidência PostgreSQL permanece condicionada ao job remoto indicado.
