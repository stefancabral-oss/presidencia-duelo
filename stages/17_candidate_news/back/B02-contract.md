# B02 — importação oficial em staging

Issue [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211), dependência [B01](B01-contract.md). Base main ffc38984f7d8b33647d3cfbcad3029fca2ec2e38, #210 concluída e #230 mesclada. Branch feat/211-official-import.

## Arquitetura

Módulos novos em back/src/civic-import.js, civic-acquisition.js, civic-import-store.js, civic-divulga.js, civic-divulga-detail.js e civic-divulga-review-store.js. São executados explicitamente por CLI; não são importados pelo servidor, não montam rotas nem escrevem no PostgreSQL. Staging usa arquivos locais e exporta o contrato civic v1 para a futura ingestão autorizada por B06. Migração B01 permanece independente.

Os CSVs e ZIPs brutos ficam em diretório de staging ignorado pelo Git, pois contêm campos pessoais desnecessários. O conjunto exportado conserva identificação pública, candidatura, situação, origem e vínculos opcionais; descarta CPF, título eleitoral, email, nascimento, gênero, bens e fotos. Não consulta o catálogo nem dados de jogadores. Todas as candidaturas saem como draft/pending, com vínculo ao jogo nulo.

## Fonte e perfil verificados

[Portal TSE candidatos-2026](https://dadosabertos.tse.jus.br/dataset/candidatos-2026): origem CAND/Candex/DivulgaCand, licença Creative Commons Atribuição e geração por arquivo. Os ZIPs adquiridos incluem leiame.pdf, que documenta Latin 1, campos entre aspas e separados por ponto e vírgula, geração em horário de Brasília, sentinelas #NULO/-1 e #NE/-3.

Perfil observado na geração 17/09/2026 19:31:04 Brasília (22:31:04 UTC):
- consulta_cand_2026_BRASIL.csv tem NR_TURNO; selecionamos o primeiro turno.
- consulta_vagas_2026_BRASIL.csv tem QT_VAGA e não possui NR_TURNO; CD_ELEICAO identifica eleição/turno.
- Federal/Presidência usa CD_ELEICAO 6257; estadual/SP usa 6259. O manifesto declara electionKeys por circunscrição. Dataset mantém duas entidades elections com IDs próprios; sequenciais iguais em eleições distintas não se fundem.
- DS_SITUACAO_CANDIDATURA e DS_DETALHE_SITUACAO_CAND são campos aplicáveis até 2022 e estão #NE em 2026. O status corrente vem de DS_SITUACAO_JULGAMENTO no complemento, sem renomear recurso, renúncia ou julgamento pendente.
- SQ_SUBSTITUIDO identifica quem foi substituído pelo registro corrente. Não fornece a vigência jurídica de uma composição.
- DT_ACEITE_CANDIDATURA é data de aceite do registro, e não é convertida automaticamente em início de chapa.
- Histórico de candidaturas foi adquirido para inspeção; não é importado nem usado para fundir pessoas de eleições diferentes.

Manifesto fixa URL oficial, nome do membro CSV, codificação, sha256 do CSV e opcionalmente do ZIP, sourceAt da geração, fetchedAt da coleta e licença. Candidatos/complemento precisam compartilhar a geração. Vacâncias são dados oficiais, sem constante por cargo. Mudança de leiaute, CSV sem linha final, aspas/colunas malformadas, checksum, geração inconsistente ou configuração ambígua recusam o lote.

## CLI e manifesto

Runtime Node 22+ e Python 3.12+ (somente biblioteca padrão para ZIP). CIVIC_PYTHON seleciona o executável quando Python não está no PATH.

1. Inspecionar fontes: `node back/scripts/civic-acquire.mjs 2026 back/data/civic-staging/acquisition`.
2. Revisar inspection.json e o leiame.pdf da fonte; criar manifesto versionado com hashes, codificação, geração e códigos da eleição. O contador de inspeção é observado, não declara reconciliação.
3. Coletar identificadores de vínculos: `node back/scripts/civic-divulga.mjs manifest.json relations.json`. Manifesto declara divulgaElectionKey; em 2026 o endpoint ordinaria/2026 informa 20322002026. Este ID da API não substitui CD_ELEICAO dos CSVs.
4. Importar arquivos fixados: `node back/scripts/civic-import.mjs manifest.json back/data/civic-staging/pilot-SP`.
5. O modo `--download` reacquire os três ZIPs e exige que URL, membro e hash do CSV coincidam com o manifesto revisado; não transforma uma coleta nova em aprovação presumida.
6. Coletar revisão individual: `node back/scripts/civic-divulga-review.mjs manifest.json new-review.json`. Primeiro valida os artefatos fixados; seleciona todas as identidades por ano/CD_ELEICAO/SQ_CANDIDATO/cargo/UE, consulta o endpoint buscar e exporta somente campos institucionais. Limites de 1.000 identidades, 2 MiB por detalhe, 100 referências e 30 segundos por resposta; redirects, resposta truncada/incompatível e perfil incorreto recusam a coleta. Content-Length comprimido não é comparado com bytes descomprimidos; ambos têm limite. Saída completa é exclusiva e imutável, sem modificar state.json.

## Entrega durável e consumo em outro ambiente

[B02-pilot-delivery.json](../output/B02-pilot-delivery.json) fixa o checksum do [snapshot minimizado](../output/B02-pilot-export.json), sua identidade e fingerprint dos registros. Inclui as 37 candidaturas, 95 pessoas, fontes, observações/exceções e zero tickets; conserva draft/pending. Não exige que o ZIP mutável ainda contenha a geração original. Em um checkout novo, executar:

`node back/scripts/civic-import-snapshot.mjs stages/17_candidate_news/output/B02-pilot-delivery.json back/data/civic-staging/restored-SP`

O CLI valida checksum/identidade e contrato antes de restaurar em staging; não aprova a carga incompleta nem cria publicação. [B02-pilot-manifest.json](../output/B02-pilot-manifest.json) e [B02-pilot-relations.json](../output/B02-pilot-relations.json) fixam também a entrada original e os vínculos de lista. Os CSVs brutos devem permanecer no caminho ignorado pelo Git. A reaquisição com `--download` exige os hashes originais: se o TSE atualizou o arquivo, recusar e preservar o snapshot versionado, ou revisar uma geração nova em outro manifesto.

Campos do manifesto v1: year, pilotUf, electionKeys {BR, UF}, candidates/vacancies/complementary {path, url, locator, encoding, sha256, archiveSha256 opcional, sourceAt, fetchedAt, license}; relationsPath opcional. production input usa synthetic:false; fixtures possuem synthetic:true e domínios example.test.

officialCounts {url, locator, sourceAt, totals} fixa denominadores contados na origem oficial por cargo/eleição/circunscrição, independentemente dos resultados do importador. No piloto, uma passagem independente de Python csv contou o arquivo oficial fixado; não usamos os totais menores da API como universo. Campos extras/datas incompatíveis são recusados.

## Composição, histórico e lacunas

A API pública candidaturascomvicessuplentes relaciona integrantes pelo aninhamento parent.id → parent.vices[].sq_CANDIDATO. sq_CANDIDATO_SUPERIOR está nulo no retorno observado; se preenchido com outro titular, o adaptador recusa. Eleição/cargo/UE são verificados e a ordem dos suplentes é comprovada pelo código do cargo da linha oficial, sem associação por nome/partido.

Dados da API não têm data de origem nem vigência jurídica informadas no retorno observado. Elas permanecem nulas nas observações; o Date HTTP é coleta, não geração ou vigência. Termos/licença da API não são herdados do ZIP. Observações ficam no relatório, sem emitir tickets com datas inventadas.

O endpoint individual `buscar/ano/UE/apiElectionKey/candidato/SQ` fornece dataUltimaAtualizacao, RRC/DRAP e substituto explícito. A atualização é conservada como string local com precisão de minuto e fuso nulo, não como sourceAt/validFrom. O array vices pode incluir referências históricas repetidas, outro titular e cargos fora do recorte. Todas são preservadas para revisão; multiplicidade, cargo, circunscrição e parent conflitante impedem chamar a observação de composição com cargos completos. Não deduplicar/escolher pelo status ou partido. [Dossiê real](../output/B02-case-review.md): 95 detalhes, 37 titulares, 30 observações com cargos esperados, sete históricos ambíguos e sete substituições explícitas. 29 observações coincidem com a lista fixada. Nenhuma demonstra período jurídico.

A Resolução TSE 23.609/2019, art. 74, foi consultada como base de acesso público ao RRC e minimização, sem declarar licença geral da API ou permissão de reprodução de documentos/fotos. O JSON conserva apiLicense:null. Os processos permitem buscar o vínculo/apensamento (art. 32) e atos datados; após autorização para completar os desafios, 12 atos foram lidos e minimizados no [dossiê processual](../output/B02-process-review.md). A coleta permanece parcial devido à indisponibilidade e a novo desafio visual do serviço. Publicação tem revisão própria em B06.

Uma relação normalizada com vigência comprovada exige electionKey, holderKey, members [{sourceKey}], validFrom, validTo e evidence {url, locator, sourceAt, fetchedAt, license}. Todos os integrantes precisam existir no mesmo recorte oficial; Executivo exige vice, Senado dois suplentes ordenados. Intervalos sobrepostos e vínculos simultâneos do mesmo integrante a diferentes titulares são recusados. O responsável revisa documentos e períodos antes da publicação B06; JSON não comprova autoridade editorial.

Cada lote recebe identidade dos artefatos, seleção, relações, denominadores e fingerprint dos registros transformados. fetchedAt/updatedAt não tornam uma reimportação nova por si só. Arquivos batches/id.json são append-only, escritos por rename atômico; state.json muda sob lock exclusivo. Falha de aquisição/validação não muda o ponteiro. Lote incompleto pode ser arquivado para revisão, mas não substitui lastReconciledBatch. Geração mais antiga e reutilização de diretório para outra eleição/UF são recusadas.

Diferenças exportam registros adicionados, situação/partido/nome alterados, composições adicionadas/ausentes e ausências no novo lote. Nada é excluído automaticamente. Histórias antigas permanecem nos arquivos anteriores. Isto não implementa escrita/transição editorial no banco.

Um histórico já comprovado continua no lote quando outro intervalo da mesma candidatura está pendente; esse lote conserva complete:false. Reimportar um arquivo já arquivado é no-op, inclusive depois de outro lote da mesma geração tornar-se atual: historicalReplay:true e stateChanged:false explicam a operação; latestBatch/lastReconciledBatch não recuam. Toda referência preservada a lastReconciledBatch é validada quanto à existência, identidade, fingerprint e completude antes de atualizar estado.

O lock registra hostname, PID, UUID e criação. Depois de interrupção do importador, usar explicitamente `node back/scripts/civic-import-recover-lock.mjs staging-directory`. Recuperação exige dono conhecido no mesmo host e PID comprovadamente morto; dono ativo/desconhecido/estrangeiro ou mudança durante o reparo recusa sem tocar snapshots. Guard exclusivo serializa reparos. Não executar reparos em paralelo nem apagar locks manualmente enquanto houver processos ativos. Se o próprio reparo for interrompido, o guard conserva bloqueio seguro: um operador verifica que não há reparo ativo antes de arquivá-lo e repetir. Locks antigos sem metadados precisam dessa verificação operacional; nunca presumir que idade prova ausência de escritor.

## Piloto e procedimento de expansão

[Relatório agregado real](../output/B02-pilot-report.json) e [handoff](../output/B02-HANDOFF.md) registram 37 candidaturas contabilizadas/importadas, zero quarentena, 33 vínculos observados e 37 pendências de composição/intervalo. accounted e complete são distintos: accounted só prova que o universo fixado foi contabilizado; complete também exige composição comprovada e ausência de lacunas. Nenhum deles aprova publicação ou gate humano.

Para ampliar, BACK repete aquisição, revisão de códigos, contagem independente na origem e importação por UF, com diretório separado e relatório datado. A05 coordena a expansão e B06 revisa/publica. As outras 26 UFs estão explicitamente não reconciliadas; não somar Presidência novamente ao reportar total nacional. Todo novo lote deve revalidar hashes, datas e exceções. Não declarar as 27 UFs prontas a partir deste piloto.

## Evidências e limites

49 cenários de regressão exercitam módulos reais, CLIs reais, ZIP/CRC real em Python, cortes por eleição, homônimos, suplentes, vínculos conflitantes, ausência de vigência, idempotência, recuperação de lock, snapshots portáveis, arquivos truncados e preservação da última carga completa. Resultados e comandos em [B02-verification.json](../output/B02-verification.json). CI remoto e revisão humana são conferidos na PR.

Não houve instalação em produção, novas rotas, migração acionada pela importação, publicação editorial ou expansão nacional. #211 permanece aberta para evidência jurídica/amostras, validação das exceções, integração do lote e seu aceite próprio.

## Revisão de atos processuais

`civic-process-review.js` valida os fatos transcritos em B02-process-evidence.json contra os IDs/processos dos 95 detalhes e a identidade do lote/revisão; exporta todas as 37 candidaturas com documentos aplicáveis e pendências preservadas. Não lê/interpreta atos automaticamente, não cria tickets nem altera dataset, estado, PostgreSQL ou jogo. Recusa outro lote, fingerprint alterado, processo não vinculado, jurisdições misturadas, campos pessoais/extras, fonte externa, data impossível/futura, fuso presumido e gate aprovado automaticamente.

Executar `node back/scripts/civic-process-review.mjs stages/17_candidate_news/output/B02-pilot-delivery.json stages/17_candidate_news/output/B02-case-review.json stages/17_candidate_news/output/B02-process-evidence.json new-process-review.json`. A revisão é gravada de modo exclusivo e imutável, com evidenceId; nova coleta escolhe outro arquivo. Assinatura local pode permanecer nula; fatos de precisão de dia não são convertidos em instantes. Os 13 novos testes e o CLI real verificam essas fronteiras. [Entrega factual e pendências](../output/B02-process-review.md). A validação estrutural não atesta a interpretação jurídica ou o gate humano.
