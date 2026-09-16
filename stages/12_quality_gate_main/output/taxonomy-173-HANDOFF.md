# HANDOFF — ICM 12 · U04 · taxonomia #173

## Status

- Estado: `pronto para revisão local`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/173
- Macro: https://github.com/stefancabral-oss/presidencia-duelo/issues/175
- Branch: `icm/12-u04-taxonomy-173`
- PR: `não aberta por instrução`
- Base do restack: `dbf55ca304989a455e792f82b0d73e1070dcd857`
- Commit de implementação: `c3e05215b1ea98468e23cab315008374c4ad6d89`
- Commit de correção adversarial: `49e709004421da7abdca64cd6c8d8951fd107d0d`
- Commit de validação semântica: `178e46331be91924124ddaa73dc55a95ed7eb169`

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

## Estado editorial explícito

- `role`: 125 `extracted`.
- `party`: 85 `extracted`; 40 `ambiguous` e `null`.
- `primaryArea`: 14 `extracted`; 111 `inferred`.
- `contextAffiliation`: 18 `extracted`; 1 `inferred`; 106 `ambiguous` e `null`.

Nenhum valor foi criado para um atributo ambíguo. `ambiguous` significa falta de suporte suficiente no material disponível, não afirmação de que a pessoa não tem partido ou vínculo.

## Testes e evidências

- `npm run test:shared`: 16/16 testes e validação estrutural/evidencial/semântica dos 125 registros, incluindo paridade bidirecional e duplicatas nas quatro fontes.
- `npm test`: 98/98 testes (16 shared, 31 back, 51 app).
- Regressões negativas reais: Paulo Guedes não pode receber `PL` a partir de `órbita PL`; Guilherme Boulos, Jones Manoel, Carla Zambelli e Deltan Dallagnol não podem recuperar rótulos categoriais como contexto; a filiação explícita de Gracyanne continua válida.
- `npm run build`: aprovado; 99/125 retratos presentes e bundle Vite produzido.
- E2E Chromium e WebKit: navegação, rodada, perfil estruturado, busca, filtros, ranking, anatomia móvel atual e limpeza de filtros na troca de visão aprovados.
- Regeneração consecutiva: hashes SHA-256 idênticos para candidatos e Chromas.
- Workflow: YAML válido; `test:shared` é chamado uma vez pelo job `shared-data` e os caminhos das três fontes editoriais acionam o workflow.

## Lacunas e riscos preservados

- As 111 áreas `inferred` precisam de gate editorial humano; o código valida o conjunto e a proveniência, não substitui a decisão editorial.
- Quarenta partidos e 106 contextos continuam ambíguos por falta de evidência explícita suficiente.
- O único contexto `inferred` preserva a redação editorial sobre a filiação de Gracyanne Barbosa e deve ser confirmado no gate humano.
- Os 125 perfis permanecem com `reviewStatus=pending`; a revisão fonte a fonte descrita no gate editorial anterior não foi simulada nesta unidade.
- O disparo remoto em `pull_request` permanece pendente porque não houve push nem PR.
- `actionlint` não estava disponível neste host; a sintaxe YAML foi validada com `yaml.safe_load` e o workflow deve passar pelo check remoto.

## Próximo passo exato

1. Revisar a amostra visual e as classificações `inferred`.
2. Abrir PR da branch e confirmar o job automático `shared-data` no evento `pull_request`.
3. Somente após o human gate, integrar em `main`.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan Cabral
- Observação: revisar especialmente áreas inferidas, lacunas ambíguas e a separação visual entre partido, área e cargo.
