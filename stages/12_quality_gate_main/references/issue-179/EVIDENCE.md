# Evidência — Issue #179

## Contrato entregue

- Uma data editorial de `America/Sao_Paulo` possui uma única edição por tema.
- O ruleset v1 materializa dez slots de quatro cartas sem repetição: 40 cartas selecionadas deterministicamente por SHA-256 a partir de data, tema, versão e catálogo ordenado.
- Jogadores diferentes recebem a mesma edição e cada jogador retoma somente o próximo slot autoritativo.
- A décima resposta encerra a sessão; não existe troca de cartas no diário. Depois do `10/10`, a interface oferece o modo livre.
- O recorte público inclui somente sessões concluídas e declara `entre quem concluiu a rodada de DD/MM`.
- A edição seguinte é materializada do catálogo então vigente; uma edição aberta nunca é reinterpretada por mudança de catálogo, ruleset ou projeção pública.

## Persistência e integridade

- `daily_editions` guarda identidade, ruleset, `catalogSchema`, janela, IDs do catálogo, snapshot público e hashes; há unicidade por `(topic_id, edition_date)`.
- `daily_edition_rounds` guarda a ordem e o hash de cada slot.
- `daily_player_sessions`, `daily_answers` e `daily_completions` preservam progresso e fechamento atômicos.
- `daily_publication_cuts.results` guarda as 40 fichas públicas selecionadas, hash do snapshot selecionado, hash do snapshot completo e contagens por slot. Publicação e reabertura validam o conteúdo contra a edição persistida, sem consultar o catálogo atual. Cada slot deve somar exatamente o número de jogadores concluídos, e o total deve ser `jogadores × 10`.
- Um corte armazenado só é servido se ruleset e metodologia coincidirem com a edição, seus totais forem inteiros seguros e `published_at` estiver entre o fechamento persistido e o relógio observado, com tolerância máxima de cinco minutos para skew futuro.
- O alias corrente `publicCandidate` e o schema histórico `candidate-public-v1` compartilham a mesma allowlist versionada. Ela preserva o contrato público existente, inclusive `reviewStatus` e `topicIds`, mas não persiste nem serve campos internos como `secret`, `photoApproved`, `fingerprint` e `publication.audit`.
- O projector histórico `candidate-public-v1` é resolvido pela identidade do ruleset, não pelo alias público corrente. O teste de deploy simulado adiciona `taxonomy` no v2: edição/snapshot v1 permanecem idênticos, e apenas uma data nova com ruleset v2 recebe o campo.
- O banco exige que o vencedor pertença às quatro cartas e vincula a rodada diária à mesma edição, tema, slot e array de candidatos. `daily_answers` também referencia o contexto completo da `choice_round`.
- Votos já admitidos usam advisory lock compartilhado; o corte usa o lock exclusivo. Assim votos de jogadores diferentes continuam concorrentes, enquanto o corte espera todos os admitidos. Se o corte vencer a corrida, o voto acorda e falha com `DAILY_EDITION_CLOSED`.

## Cotas e relógio

- Limite compartilhado de 30 escolhas por dia editorial: até 10 no diário e até 20 no modo livre.
- O diário usa `opensAt`/`closesAt` persistidos; o livre recebe a janela calculada pelo relógio injetado da aplicação. Somente o bucket por minuto usa o relógio do PostgreSQL.
- Buckets legados por dia UTC que sobrepõem a janela editorial são carregados conservadoramente para o total v2, sem conceder uma segunda franquia no deploy.
- Replay idempotente de `answerId` ou `roundId` não consome nova cota.

## Resiliência do cliente

- Falha inicial somente em `/api/daily-session` não derruba catálogo, home, ranking ou modo livre; o diário apresenta erro e retry próprios.
- Login e logout consolidam a nova identidade antes de carregar o diário. Um 5xx posterior não restaura token revogado nem desfaz conta confirmada.
- A restauração de um voto livre não consulta o serviço diário; uma tentativa diária restaura os dois estados.
- Reload e múltiplas abas retomam o slot do servidor. Replay cuja resposta se perdeu relê a edição vigente antes de avançar, inclusive na virada de meia-noite.

## Cobertura automatizada

### Unitários e build local

- `npm run test:shared`: 4/4.
- `npm test --prefix back`: 54/54.
- `npm test --prefix app`: 68/68.
- `npm run build --prefix app`: aprovado, incluindo validação dos retratos; 99/125 slots possuem imagem aprovada.

### Navegadores locais

Chromium e WebKit aprovaram:

- `daily-session.mjs`: igualdade diária, snapshot histórico, `10/10`, reload, virada, resposta perdida, falha inicial do diário, fallback livre e retry;
- `interaction-smoke.mjs`: interação padrão e variante Google com falha diária pós-login e pós-logout;
- `responsive-layout.mjs`: 3 telas em 16 viewports por navegador;
- `vote-recovery.mjs`: timeout, 503, 401, 409, idempotência, resposta truncada e replay legado;
- `vote-trust-states.mjs`: `sending`, 401, 429 e 5xx, incluindo restauração livre enquanto o diário permanece indisponível.

### PostgreSQL 16

`back/scripts/topic-store-smoke.mjs` foi ampliado para provar em banco real:

1. mesma edição para jogadores diferentes e edição distinta no dia seguinte;
2. unicidade por tema/data e adoção do ruleset apenas em data nova;
3. progresso ordenado, replay, concorrência e conclusão exatamente `10/10`;
4. snapshot histórico após remoção do catálogo e corte reaberto com as 40 fichas;
5. migração conservadora da cota legada e janelas explícitas nos dois lados da meia-noite de São Paulo;
6. FKs/CHECKs contra tema, vencedor, array e resposta forjados;
7. dois votos simultâneos sob lock compartilhado, corte esperando ambos e corrida inversa vencida pelo corte.

Os testes unitários também recusam recorte armazenado com total geral divergente, distribuição `9/11` entre slots apesar de total 100, ruleset/metodologia adulterados e publicação fora da janela temporal aceita.

Não há PostgreSQL ou Docker nesta estação. O script passou na verificação de sintaxe, mas sua execução local ficou indisponível; o resultado vinculante deve vir do job obrigatório `back-integration-postgres` com PostgreSQL 16. Nenhum CI remoto foi observado nesta worktree local.
