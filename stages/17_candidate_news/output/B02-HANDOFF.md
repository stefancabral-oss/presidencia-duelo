# B02 — handoff de importação em staging

Issue [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211). Branch feat/211-official-import. Base main ffc38984f7d8b33647d3cfbcad3029fca2ec2e38 com #228/#230 mescladas; #210 concluída no GitHub.

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

[Relatório real com hashes e lacunas](B02-pilot-report.json). Snapshots completos e manifesto estão no workspace fora do checkout, em work/b02-pilot-stage e b02-source-cache; arquivos brutos não estão versionados. Reimportação real confirmada sem duplicação. Relatórios antigos da preparação local permanecem históricos.

## Validação

431 testes locais aprovados, incluindo 32 novos cenários, build Vite aprovado. ZIP/CRC, CLI, minimização, captura de relações e regras de eleição são executados de verdade pelos testes. [verification](B02-verification.json). CI remoto será registrado na descrição da PR; PostgreSQL existente continua verificando isolamento civic e preservação do jogo, embora esta importação não escreva no banco.

## Pendente e gate humano

#211 permanece aberta. Responsável editorial deve revisar amostras/identidades e justificar as lacunas; responsável de produto deve reconhecer o universo em staging e as exceções. Vigências, composições ausentes, termos da API e ingestão futura B06 não são aprovados pelo agente. Estas pendências impedem declarar B02 completo; não impedem revisão do código e testes desta PR.

Próxima unidade independente pelo grafo: B04 (#213), apoiada em B01 concluída. B03 depende do aceite de B02 para conclusão. Front/App podem consumir fixtures existentes para protótipos conforme o plano, respeitando seus gates.

## Reversão

Desligar a execução do CLI/consumidores e conservar snapshots. Em falha de fonte, servir/consultar somente a última carga reconciliada conhecida, nunca um lote incompleto nem diretório vazio presumido. Não remover dados históricos, não acionar rollback do PostgreSQL populado, não promover staging a conteúdo público.

