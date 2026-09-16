# HANDOFF — ICM 12 · U04 · taxonomia #173

## Status

- Estado: `PR em rascunho; verificação local aprovada e CI da atualização pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/173
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u04-taxonomy-173`
- PR: https://github.com/stefancabral-oss/presidencia-duelo/pull/194 (rascunho)
- Base integrada: `f86aec40ba4770fc71de6deca55175e356ac942d` (merge da #178)
- Commit de implementação: `e8a8534f4f3b065401f6f33752d0c61de8b5774f`
- Commit de correção adversarial: `60357ff39a5bff20087de62e6fa407f6ba19a426`
- Commit de validação semântica: `8116ebf255b0939058616d8567246f5e884e3ca5`

## Causa corrigida

O gerador copiava `partido_ou_area` simultaneamente para cargo, afiliação e partido e criava uma área genérica. A mesma prosa passava pela API e era indexada pela busca. A primeira correção estruturou os campos, mas duas revisões adversariais mostraram que não bastava resolver a fonte nem procurar o token literalmente: `PL` em `órbita PL` e `direita` em `Novo / direita` ainda podiam voltar ao campo errado. O contrato v2 agora resolve cada ponteiro no catálogo real e exige uma relação semântica específica por campo.

## Entregue

- Contrato v2 de `role`, `party`, `primaryArea`, `contextAffiliation` e proveniência por atributo.
- Fonte editorial com 125 registros, ligada por nome aos 125 perfis.
- Vocabulário fechado de 16 siglas partidárias e 11 áreas.
- Quatro ponteiros permitidos, resolvidos contra os arquivos editoriais reais; fonte desconhecida, ausente ou vazia falha.
- Partido `extracted` exige declaração no primeiro segmento legado ou frase explícita de filiação; uma sigla citada apenas como contexto é rejeitada.
- Contexto `extracted` precisa constar no registro institucional fechado `TAXONOMY_CONTEXT_EXTRACTIONS.version = 1`, com ponteiro permitido e literal comprovável.
- As únicas normalizações lexicais de partido ficam no mapa explícito `TAXONOMY_NORMALIZATIONS.version = 1`.
- Reclassificação dos 33 mapeamentos semânticos de área de `extracted` para `inferred`.
- Remoção de contextos que eram ideologia/canal de atuação, sem inventar vínculo: André Janones, Jones Manoel, Carla Zambelli e Deltan Dallagnol ficaram `null`/`ambiguous`.
- Proveniência preservada no JSON gerado e na allowlist da API.
- Remoção dos campos sobrepostos `affiliation`, `area` e `office` do artefato novo.
- Correção de Antonia Fontenelle: cargo descritivo, `PSDB` e `Comunicação digital`.
- Carta e ranking com um único chip estruturado; perfil com seções separadas.
- Busca restrita a nome, partido e área, com filtros combináveis por partido/área e limpeza dos três filtros na troca entre ranking geral e pessoal.
- Um único validador compartilhado pelo gerador, teste e CI.
- Contrato de serialização exercitado sobre os 125 registros reais, incluindo Lula e Antonia Fontenelle.
- Screenshot comparativo em `references/taxonomy-comparison.png`, regenerado com quatro registros reais: Lindbergh Farias (`PT`), Alexandre de Moraes (`Justiça`, partido ambíguo/nulo), Paulo Guedes (`Economia`, sem promover `órbita PL` a partido) e Gracyanne Barbosa (`REPUBLICANOS`).
- Contrato diário promovido para `daily-four-card-v2@2`/`candidate-public-v2` somente em datas ainda não materializadas; `daily-four-card-v1@1` continua registrado para replay e corte de edições persistidas.
- O projector histórico v1 agora falha fechado se receber um registro v2 sem `affiliation`/`office`, impedindo que `undefined` desapareça silenciosamente do JSON e altere o snapshot.
- Frontend e placar de apostas aceitam as identidades seladas v1 e v2, mas rejeitam combinações cruzadas de ID, versão e schema.

## Estado editorial explícito

- `role`: 125 `extracted`.
- `party`: 85 `extracted`; 40 `ambiguous` e `null`.
- `primaryArea`: 14 `extracted`; 111 `inferred`.
- `contextAffiliation`: 18 `extracted`; 1 `inferred`; 106 `ambiguous` e `null`.

Nenhum valor foi criado para um atributo ambíguo. `ambiguous` significa falta de suporte suficiente no material disponível, não afirmação de que a pessoa não tem partido ou vínculo.

## Testes e evidências

- `npm run test:shared`: 16/16 testes e validação estrutural/evidencial/semântica dos 125 registros, incluindo paridade bidirecional e duplicatas nas quatro fontes.
- `npm test`: 163/163 testes (16 shared, 63 back, 84 app), incluindo golden byte a byte do projector v1, rejeição de campos v1 ausentes, replay de edição v1 já persistida, criação de edição v2 e validação cliente dos dois contratos.
- Regressões negativas reais: Paulo Guedes não pode receber `PL` a partir de `órbita PL`; Guilherme Boulos, Jones Manoel, Carla Zambelli e Deltan Dallagnol não podem recuperar rótulos categoriais como contexto; a filiação explícita de Gracyanne continua válida.
- `npm run build`: aprovado; 99/125 retratos presentes e bundle Vite produzido.
- E2E Chromium e WebKit: oito fluxos por navegador aprovados — interação, login/logout, sessão diária, aposta/revelação, troca de identidade, 3 telas em 16 viewports, recuperação de voto e estados de confiança. O preview foi isolado em `127.0.0.1:4178` com `--strictPort`, PID/caminho conferidos, e o fluxo diário atravessou explicitamente uma edição v1 persistida para uma nova edição v2.
- `npm run build --prefix app`: aprovado com `VITE_GOOGLE_CLIENT_ID` de teste; 99/125 retratos presentes e bundle Vite produzido.
- `npm audit --omit=dev --prefix app` e `--prefix back`: 0 vulnerabilidades de produção.
- `git diff --check`: limpo.
- Regeneração consecutiva: hashes SHA-256 idênticos para candidatos e Chromas.
- Workflow: YAML válido; `test:shared` é chamado uma vez pelo job `shared-data` e os caminhos das três fontes editoriais acionam o workflow.

## Lacunas e riscos preservados

- As 111 áreas `inferred` precisam de gate editorial humano; o código valida o conjunto e a proveniência, não substitui a decisão editorial.
- Quarenta partidos e 106 contextos continuam ambíguos por falta de evidência explícita suficiente.
- O único contexto `inferred` preserva a redação editorial sobre a filiação de Gracyanne Barbosa e deve ser confirmado no gate humano.
- Os 125 perfis permanecem com `reviewStatus=pending`; a revisão fonte a fonte descrita no gate editorial anterior não foi simulada nesta unidade.
- A execução remota desta atualização permanece pendente até o push; o PostgreSQL não foi reproduzido localmente neste host.
- `actionlint` não estava disponível neste host; a sintaxe YAML foi validada com `yaml.safe_load` e o workflow deve passar pelo check remoto.

## Próximo passo exato

1. Revisar a amostra visual e as classificações `inferred`.
2. Confirmar os jobs automáticos da PR #194, incluindo PostgreSQL, Chromium e WebKit.
3. Somente após o human gate, integrar em `main`.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar especialmente áreas inferidas, lacunas ambíguas e a separação visual entre partido, área e cargo.
