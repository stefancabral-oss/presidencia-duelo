# B04 — coleta limitada de notícias em staging

Issue [#213](https://github.com/stefancabral-oss/presidencia-duelo/issues/213), branch feat/213-news-collection, base main ffc3898 após #210/#230. B02/#211 não é dependência desta unidade. O jogo e seus endpoints permanecem isolados da coleta.

## Execução e autorização

```sh
npm ci --prefix back
node back/scripts/news-collect.mjs stages/17_candidate_news/back/B04-source-registry.json back/data/news-staging
```

O [cadastro proposto](B04-source-registry.json) é a entrada revisável. Na versão entregue, sete permissões são pending, feedUrl é null e nenhum domínio recebe requisição de coleta. O CLI registra estados de permissão pendente e três espaços insuficientes. Não substituir pending por permitted apenas para demonstrar coleta real.

O operador autorizado precisa homologar domínio/canal exato, acordo/termos, escopo, atribuição, responsável, datas e retenção antes de permitir o coletor. Trata-se de arquivo operacional local, não endpoint público nem assinatura editorial. A publicação ainda exige a autoridade B06. [Metodologia editorial proposta](B04-methodology.md).

## Adaptadores e contrato

RSS 2.0, Atom e JSON estruturado leem somente manchete e metadados do feed/API. JSON aceita items com url, title, author, date_published, kind, sponsored, origin_outlet_id, syndicated_from_id, language e paywall. Campos extras não saem do adaptador. Tipo/sindicação desconhecidos permanecem null; nunca são deduzidos de partido/manchete. Mesmo permission.content=full não ativa leitura de corpos nesta versão.

Corpo, resumo e imagens permanecem null/null/[]; bodyRead=false. Descrição RSS, conteúdo Atom, CPF/cookies e ativos não são persistidos. Paywall declarado fica explícito, sem busca do artigo ou contorno de acesso. Notícias patrocinadas declaradas são excluídas; campos inválidos vão para quarentena por índice/código. Falta de data de origem não vira data de coleta. Informação patrocinada não declarada no canal depende da revisão humana posterior.

URL canônica deve ser HTTPS em host exato homologado. Remove fragmento e parâmetros utm/fbclid/gclid; não segue links de artigos. Identidade é hash de veículo+URL canônica, sem nomes de políticos ou sinais do jogador. Duplicatas idênticas colapsam; versões conflitantes do mesmo URL são excluídas do lote e identificadas como canonical_conflict.

Observações incompletas ficam fora dos registros públicos B01. Dados suficientes geram sources/outlets/articles B01, sempre draft/pending: fonte da metodologia própria e explícita, autoria/tipo/origem fornecidos e relação de origem conhecida. Sindicação de outra agência permanece observação até que referências possam ser reconciliadas. O feed não é usado como prova de orientação. Nenhuma fonte ou classificação é inventada para preencher FK.

## Segurança de rede e análise

HTTPS somente, porta padrão, sem credenciais, IP literal, localhost ou host fora da allowlist. DNS retorna até 64 endereços e todos precisam ser globais permitidos; respostas mistas público/privado são rejeitadas. Transporte HTTPS usa lookup fixado no endereço validado, mantendo Host, SNI e verificação TLS no domínio original. Não há nova resolução após a validação. IPv6 aceita somente unicast global ordinário, excluindo escopos locais, mapeados, NAT64, túneis e faixas especiais/documentais.

Até três redirects, com allowlist e DNS novamente validados em cada salto. Limite padrão de 1 MiB, máximo configurável de 2 MiB, cabeçalhos até 16 KiB, parede de 10s (máximo 30s) incluindo DNS/retries. Resposta comprimida é recusada; HTTP não-200 encerra leitura do corpo. Content-Length truncado/incompatível e conteúdo inesperado falham. 429/5xx têm até duas repetições; Retry-After longo/data é reportado sem repetir imediatamente.

XML UTF-8 estrito com saxes 6.0.0, namespaces, fechamento completo, DTD recusada e nenhuma resolução de entidades externas. Até 500 itens, profundidade 24, 20.000 elementos, limite de texto e tamanho global. Dependência arquivada upstream, fixada no lockfile: uso limitado ao parser estrito, sem DTD/extensões ou rede; alterações de manutenção requerem revisão. Texto vira string simples, com blocos executáveis/tags/controles removidos; consumidores devem usar textContent, nunca innerHTML. Nenhuma instrução encontrada nas fontes é executada.

Fontes técnicas: [HTTPS/lookup Node](https://nodejs.org/api/https.html), [faixas especiais IPv4 IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml), [parser saxes](https://github.com/lddubeau/saxes). URLs recebidas e dados coletados são não confiáveis.

## Persistência e retenção

Diretório por hash do veículo, batches imutáveis e state.json sob lock exclusivo. Registro de coleta conserva cadastro/classificação/permissão utilizados, datas, metadados e relatório; fingerprint detecta alterações no conteúdo. Identidade de matéria é estável, recibo de coleta é datado. Repetir o mesmo recibo não duplica arquivo; recolher em novo instante registra nova observação histórica, sem duplicar matérias no lote atual.

Gravação temporária com sync e rename atômico protege o ponteiro. Falha/restrição não substitui o último lote válido por lista vazia. Coleções antigas são recusadas; diretório não mistura fontes sintéticas e reais. Retenção máxima é sete dias, reduzida pelo vencimento da permissão. Leitura nunca devolve lote vencido; nova execução remove arquivos expirados daquele veículo. Parar o job exige rotina de expiração/remoção do diretório antes de abandonar a infraestrutura. Nenhum corpo bruto vai para o Git ou logs. Este staging não é arquivo público nem substitui histórico editorial B06.

## Estados e reversão

collected, permission_pending, restricted e collection_failed são explícitos por provedor. Falhas são códigos, sem páginas brutas ou rastros pessoais. Três espaços continuam presentes mesmo sem opções. Desligar o CLI desliga a coleta; não desligar o jogo nem executar rollback do banco. Rever retenção dos snapshots restantes, conservar apenas evidência cuja retenção tenha autorização. Não há scheduler, endpoint, publicação, resumo de corpo, download de imagens, contratação ou deploy nesta entrega.

[Handoff](../output/B04-HANDOFF.md), [relatório real do cadastro](../output/B04-pilot-report.json) e [verificação](../output/B04-verification.json) distinguem testes sintéticos, acesso real a termos e ingestão editorial ainda não autorizada.
