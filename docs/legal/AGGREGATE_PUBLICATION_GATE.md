# Gate de publicação agregada

Status: controle técnico candidato, vinculado à issue #177. A decisão humana permanece pendente.

## Limite deste artefato

Este documento e o código associado **não são parecer jurídico**, certificação de conformidade nem conclusão sobre legislação eleitoral, proteção de dados ou qualquer outra obrigação. O gate controla somente as superfícies técnicas descritas abaixo.

Uma receipt de publicação **não autoriza coleta, armazenamento, tratamento, combinação ou uso** de votos, previsões, identificadores ou qualquer outro dado. A assessoria jurídica eleitoral humana precisa decidir separadamente se essas atividades podem continuar e se outros fluxos também devem ser desativados. Na ausência dessa decisão, nenhuma inferência de autorização pode ser feita a partir do funcionamento do app.

O modo padrão continua registrando as preferências necessárias ao ranking pessoal. Isso é uma característica técnica atual, não uma conclusão de que a coleta ou o tratamento sejam permitidos.

## Comportamento fail-closed

Sem autoridade externa válida, a API anuncia `personal-only` e retém quatro escopos independentes:

| Escopo | Superfícies controladas |
|---|---|
| `global-ranking` | `GET /api/ranking` e o envelope `publicAggregate` de `POST /api/round-vote` e `POST /api/daily-vote` |
| `daily-distribution` | `GET /api/daily-cut` |
| `prediction-reveal` | `POST /api/daily-prediction` e `GET /api/daily-prediction-results` |
| `mirror-comparison` | futura comparação agregada no espelho pessoal |

`GET /api/capabilities` devolve o estado de cada escopo com `Cache-Control: no-store`. Uma capacidade disponível inclui o `validUntil` assinado; o app agenda sua retirada, limpa dados agregados já carregados no limite e repete a verificação quando a aba volta ao primeiro plano. Ausência, JSON malformado, chave não pinada, assinatura inválida, período vencido, ambiente divergente, fingerprint divergente ou receipts duplicadas retêm todos os escopos envolvidos. Não existe variável booleana que libere publicação.

As rotas agregadas são bloqueadas antes de chamar o store. Votos pessoais continuam respondendo pelo contrato V2, no qual:

- `player`, `round`, `vote` e `dailySession` são reconstruídos por allowlists profundas e contêm somente o canal pessoal;
- `feedback` é reconstruído exclusivamente de `personalFeedback`;
- qualquer dado agregado aparece somente em `publicAggregate` quando `global-ranking` tem receipt válida;
- sem essa receipt, `publicAggregate` é exatamente `{ "status": "withheld", "scope": "global-ranking" }`.

No modo pessoal, o app não pede ranking público, corte diário, revelação ou previsão. Um backlog antigo de `pendingPrediction` não bloqueia as dez preferências: o cliente omite `predictionContractVersion`, o HTTP remove esse campo mesmo se um cliente antigo o enviar e nenhuma previsão nova é inventada ou gravada.

## Autoridade externa

A autoridade usa Ed25519 com separação entre confiança versionada, identidade do artefato e configuração operacional:

- [`back/src/aggregate-publication-trust.js`](../../back/src/aggregate-publication-trust.js) contém o keyring pinado de JWKs públicas `OKP/Ed25519`, com emissor e `keyId`. Ele está vazio enquanto a decisão humana estiver pendente; alterá-lo exige revisão de código e novo release;
- o Dockerfile recebe `SOURCE_COMMIT` somente como argumento de build e grava o SHA completo (40 ou 64 caracteres hexadecimais) em `release-identity.js` dentro da imagem. A API não aceita override dessa revisão por variável de runtime;
- `AGGREGATE_AUTHORITY_RECEIPTS` é a única entrada operacional e contém o array JSON de receipts assinadas. JWK, emissor e `keyId` fornecidos por ambiente não são raiz de confiança e são ignorados.

Cada receipt vincula decisão, ambiente, assunto `eleicoes-2026`, escopo, janela de validade, instante da decisão, `releaseRevision` e dois fingerprints:

- `controlsFingerprint`: endpoints e campos efetivamente controlados;
- `copyPolicyFingerprint`: artefato versionado [`shared/aggregate-publication-copy.js`](../../shared/aggregate-publication-copy.js), com a matriz de superfícies e textos que poderiam aparecer.

O catálogo de copy está marcado `candidate-pending-human-review`. Versioná-lo e gerar seu hash **não significa que ele foi aprovado**. Qualquer mudança de texto ou superfície altera o fingerprint e invalida receipts anteriores. Depois de revisar controles e textos, a autoridade humana externa é quem pode emitir uma receipt nova, limitada a um escopo, ambiente e período.

`releaseRevision` precisa ser idêntico à revisão embutida no build. Ausência, abreviação ou divergência retém todos os escopos, mesmo que controles, copy e assinatura continuem válidos. Assim, a decisão fica ligada ao artefato construído, e não a um `SOURCE_COMMIT` autoafirmado no runtime. O pipeline de imagem deve construir a partir do SHA imutável revisado, injetar esse mesmo SHA como build arg e publicar a imagem por digest; o gate técnico não substitui a verificação de proveniência do pipeline.

## Deploy coordenado do contrato V2

`AGGREGATE_DEPLOYMENT_ID` identifica a implantação concreta e precisa coincidir
com `environment` da autorização assinada (por exemplo, `polimatch-prod-br-01`).
`NODE_ENV=production` sozinho não autoriza nenhuma implantação. Ausência ou
divergência do identificador retém os agregados, mesmo com a mesma revisão.

Ao recuperar foco ou visibilidade, o cliente oculta dados agregados em cache e
consulta novamente `/api/capabilities`. A API também revalida a autorização após
cada leitura assíncrona agregada, antes de entregar a resposta.

As respostas de `POST /api/round-vote` e `POST /api/daily-vote` mudam de forma incompatível. O frontend novo rejeita V1 para não aceitar agregados fora do envelope; o frontend antigo não entende V2. Portanto, frontend e backend **não são compatíveis em um rolling mix**.

Use uma troca atômica/blue-green, roteamento por versão ou uma janela curta de manutenção:

1. prepare frontend e backend do mesmo commit em um ambiente isolado, construa a imagem da API com o SHA completo em `--build-arg SOURCE_COMMIT=...` e promova a imagem pelo digest validado;
2. mantenha todas as receipts ausentes durante a troca;
3. valide `GET /api/health` e `GET /api/capabilities` (`personal-only`, `no-store`);
4. direcione o tráfego para o par V2 simultaneamente e elimine HTML/service worker antigos do caminho ativo;
5. execute o smoke pessoal 10/10 e confirme zero chamadas de previsão/agregado;
6. somente depois, em ambiente de validação, teste cada receipt revisada de forma independente;
7. não habilite receipts em produção enquanto a decisão humana da issue #177 estiver pendente.

O rollback também deve trocar app e API para o mesmo commit. Antes do rollback, remova as receipts e reinicie a API para voltar ao modo fail-closed. Não adicione fallback V1 ao frontend ou resposta dupla no backend: ambos reabririam o canal que este controle procura conter.

## Smoke pós-deploy

- `/api/capabilities` retorna `no-store` e todos os escopos retidos sem receipt;
- `/api/ranking`, `/api/daily-cut`, `/api/daily-prediction-results` e `/api/daily-prediction` respondem `403 AGGREGATE_PUBLICATION_WITHHELD` sem acesso ao store;
- uma escolha pessoal avança uma vez, retorna V2 e não contém `ranking`, `duels`, `rankingPolicy`, `globalEvent` ou feedback público na raiz;
- uma jornada diária chega a 10/10 sem request de previsão;
- home e ranking pessoal não exibem CTA, pódio, pulso, distribuição ou revelação pública;
- uma fixture assinada por escopo libera somente sua superfície, sempre com `Cache-Control: no-store` nas leituras controladas.

Esses testes demonstram contenção técnica. Eles não encerram o gate humano nem validam a legalidade das atividades subjacentes.
