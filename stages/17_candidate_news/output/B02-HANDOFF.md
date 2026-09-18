# B02 — handoff de importação em staging

Issue [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211). Branch feat/211-official-import. Base main ffc38984f7d8b33647d3cfbcad3029fca2ec2e38 com #228/#230 mescladas; #210 concluída no GitHub.

Entrega técnica na [PR #231](https://github.com/stefancabral-oss/presidencia-duelo/pull/231), com aceite técnico de Stefan no chat em 18/09/2026 ("211 ok"). A solicitação posterior "Resolve ela integralmente" iniciou a revisão integral registrada abaixo. CI atual fica nos [checks](https://github.com/stefancabral-oss/presidencia-duelo/pull/231/checks) e em verification; os resultados anteriores referem-se ao código 5a9f47b. Aceite editorial/produto e períodos jurídicos continuam pendentes.

## Entrega

Importador oficial com aquisição limitada/checksum, ZIP/CRC, codificação fixada, CSV estrito, vagas oficiais, identidades por eleição, minimização, situações de julgamento, observações explícitas de chapa, quarentena, snapshots imutáveis e diferenças. Não publica nem altera banco/jogo. [Contrato e runbook](../back/B02-contract.md).

## Evidência real do piloto

UF usada nesta execução técnica: SP, proposta ao responsável; escolha definitiva do piloto continua sujeita à revisão. Arquivos TSE fixados na geração 2026-09-17T22:31:04.000Z.

| Recorte | Oficial | Importado | API de vínculos | Vigência pendente |
| --- | ---: | ---: | ---: | ---: |
| Presidência | 14 | 14 | 13 | 14 |
| Governo SP | 7 | 7 | 5 | 7 |
| Senado SP | 16 | 16 | 15 | 16 |

Todas as 37 candidaturas entraram como rascunhos pendentes; nenhuma foi omitida pela ausência na API ou no catálogo do jogo. Quarentena zero. accounted=true; complete=false. 33 chapas têm vínculo explícito observado mas nenhuma tem vigência jurídica fornecida. Outras quatro não têm composição na lista atual da API; não foram removidas. Não criar tickets com instante de coleta/geração.

[Relatório original com hashes e lacunas](B02-pilot-report.json). A entrega agora inclui [snapshot completo minimizado](B02-pilot-export.json), [manifesto de entrega/checksum](B02-pilot-delivery.json), [manifesto de importação fixado](B02-pilot-manifest.json) e [relações observadas](B02-pilot-relations.json). Outro runner B06 pode consumir/restaurar esse lote sem o ZIP mutável; comando no contrato. Os arquivos brutos continuam fora do Git. Reimportação real confirmada sem duplicação; snapshots locais anteriores preservados.

## Revisão integral das fontes e correções

O [dossiê completo](B02-case-review.md) e [JSON](B02-case-review.json) registram consultas reais aos 95 detalhes: todas as 37 candidaturas e seus processos RRC/DRAP, datas locais de atualização, sete substituições explícitas e referências históricas. Os quatro titulares ausentes da lista foram encontrados no detalhe; não são ausência de candidatura. Há 30 observações com cargos esperados (29 coincidem com a lista fixada) e sete históricos ambíguos. DTO de Senado inclui outro titular/deputado e suplentes de registros distintos; não foi associado por partido/nome. Vigência permanece desconhecida em todos os 37 casos. Atualização do DTO não é vigência.

Cinco apontamentos da revisão técnica tratados: exportação durável; replay de lote antigo não recua ponteiros; intervalo comprovado permanece quando outro é pendente; lock com dono/recuperação explícita de PID morto; validação do arquivo lastReconciledBatch antes de preservar sua referência. Todos têm regressões executáveis. Não houve promoção da carga incompleta.

## Validação

49 cenários B02 aprovados após as correções. Suíte integral, comandos, restauração real em diretório novo e CI em [verification](B02-verification.json). PostgreSQL remoto verifica isolamento civic e preservação do jogo, embora esta importação não escreva no banco.

## Pendente e gate humano

#211 permanece aberta. O dossiê torna a revisão concreta: responsável editorial confirma identidades/vínculos, busca atos datados nos processos e revisa os sete históricos; responsável de produto confirma SP e o recorte/exceções. A consulta pública PJe exige hCaptcha; autorização de resolução solicitada no chat, sem completar/contornar o desafio. Base de consulta pública verificada na Resolução 23.609, art. 74; nenhuma licença geral da API presumida. Não marcar vigência comprovada com geração/coleta, nem autocertificar gate. Ingestão/publicação B06 é posterior e não bloqueia B02 staging por si só.

Próxima unidade independente pelo grafo: B04 (#213), apoiada em B01 concluída. B03 depende do aceite de B02 para conclusão. Front/App podem consumir fixtures existentes para protótipos conforme o plano, respeitando seus gates.

## Reversão

Desligar a execução do CLI/consumidores e conservar snapshots. Em falha de fonte, servir/consultar somente a última carga reconciliada conhecida, nunca um lote incompleto nem diretório vazio presumido. Não remover dados históricos, não acionar rollback do PostgreSQL populado, não promover staging a conteúdo público.
