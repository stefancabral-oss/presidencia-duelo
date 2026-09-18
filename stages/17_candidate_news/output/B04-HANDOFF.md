# B04 — handoff do cadastro e coletor de notícias

Issue [#213](https://github.com/stefancabral-oss/presidencia-duelo/issues/213), branch feat/213-news-collection sobre main ffc3898. Stefan autorizou iniciar #213; #210 está concluída. PR e commit da entrega são registrados no estado operacional da issue e na descrição da PR. B02/#211 está entregue tecnicamente na [PR #231](https://github.com/stefancabral-oss/presidencia-duelo/pull/231), com seus próprios gates pendentes.

## Entrega técnica

Cadastro nominal de sete candidatos, metodologia editorial versionada, adaptadores RSS/Atom/JSON, validação de direitos, SSRF/DNS fixado, limites de rede/XML, metadados minimizados, quarentena, drafts B01 quando fatos suficientes, snapshots verificáveis e expiração. [Contrato/runbook](../back/B04-contract.md) e [metodologia](../back/B04-methodology.md).

## Evidências e limites

[Relatório executado do cadastro](B04-pilot-report.json) e [verificação](B04-verification.json). Execução real do CLI registra permission_pending para os sete veículos, sem baixar matérias. Elegíveis por espaço: direita zero, esquerda zero, internacional zero. Países/entidades/canais propostos precisam revisão; BBC/DW não foram declaradas neutras nem aprovadas.

Transporte HTTPS real com DNS validado/fixado consultou somente página pública de termos EBC: HTTP 200, 87.131 bytes; hash registrado na verificação. Esta prova de rede não é ingestão editorial nem licença homologada. Conteúdo bruto dessa página não é versionado. Fixtures de feed/matérias/aprovações são inventadas e não comprovam piloto real.

## Revisão humana pendente

- Validar metodologia, lista nominal, país/redação/entidade jurídica atual e correções por fonte.
- Informar orientação/corpus/evidências/responsável/versão, resolvendo contestação sem mover veículo para preencher lacuna.
- Homologar canal, termos vigentes, atribuição, limites/retenção e eventuais custos por veículo.
- Produzir duas opções elegíveis por espaço; ausência continua explícita até essa evidência.
- Depois, executar coleta autorizada real em staging e revisar amostras de autoria, tipo, sindicação/acesso antes do fluxo B05/B06.

Nenhum desses gates foi autocertificado. #213 permanece aberta. A aprovação do código pode ocorrer separadamente da aprovação editorial. Não houve publicação, contato externo, contrato pago, mudança do jogo ou deploy.

## Reversão

Desligar a invocação do CLI. Respeitar vencimento/retenção dos registros existentes; leitura recusa conteúdo vencido e execução remove arquivos expirados. Manter somente a evidência cuja retenção esteja documentada. O desligamento não altera votos, ranking, banco ou frontend.
