# B02 — dossiê de revisão do piloto SP

Issue [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211), [PR #231](https://github.com/stefancabral-oss/presidencia-duelo/pull/231). Dados institucionais públicos, minimizados, somente em staging.

`batchId=254cafe319d15c06a0f893af202638cc00c91b44770f7847340a0d8da92f1209`
`reviewId=081e8e6eff4cf8b7f85ee0cc296e1a6a07da58c44ba2924899c551e1b9289b93`

As 37 candidaturas do CSV fixado e as 95 identidades foram consultadas individualmente. O endpoint de lista anterior observa 33 chapas; o detalhe retorna histórico: 30 referências com os cargos esperados (29 coincidem com a lista), sete casos ambíguos. Isso não demonstra vigência jurídica. Os quatro titulares ausentes da lista estão no detalhe e são preservados. Nenhum ticket foi criado, nenhuma publicação ou aprovação editorial ocorreu.

O [dossiê JSON](B02-case-review.json) conserva hash e URL de cada resposta, atualização local de origem com precisão de minuto/sem fuso presumido, processos RRC/DRAP e referências de substituição. Não contém CPF, email, nascimento, bens, fotos ou cópia de documentos. O [relatório do lote CSV](B02-pilot-report.json) permanece histórico e não é reescrito com dados de uma coleta posterior.

## Universo completo para revisão

| ID oficial | Nome de urna | Cargo/UF | Situação no detalhe | Composição observada | RRC |
| --- | --- | --- | --- | --- | --- |
| 250002544516 | MAÍRA DE SOUZA | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602046-70.2026.6.26.0000) |
| 280002548139 | VETERINÁRIO WILSON GRASSI | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601444-05.2026.6.00.0000) |
| 250002551502 | SIMONE TEBET | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602653-83.2026.6.26.0000) |
| 250002532794 | SALLES | senator/SP | Deferido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0600551-88.2026.6.26.0000) |
| 280002554479 | LEONARDO AVALANCHE | president/BR | Pendente de julgamento | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602033-94.2026.6.00.0000) |
| 250002553928 | GUTO SCHIAVETTO | senator/SP | Pedido não conhecido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603024-47.2026.6.26.0000) |
| 250002536915 | VERA LÚCIA | governor/SP | Deferido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601255-04.2026.6.26.0000) |
| 280002553884 | PABLO MARÇAL | president/BR | Indeferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601586-09.2026.6.00.0000) |
| 280002539826 | ZEMA | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601404-23.2026.6.00.0000) |
| 250002541312 | GUILHERME DERRITE | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601868-24.2026.6.26.0000) |
| 250002552955 | EDNELSON CESARETTI | senator/SP | Indeferido em prazo recursal ou com recurso | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602814-93.2026.6.26.0000) |
| 250002541365 | WELLER GONÇALVES | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601788-60.2026.6.26.0000) |
| 250002544673 | GERALDO RUFINO | senator/SP | Deferido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602036-26.2026.6.26.0000) |
| 250002549705 | FERNANDO HADDAD | governor/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602497-95.2026.6.26.0000) |
| 250002544912 | VIVIAN MENDES | governor/SP | Deferido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602040-63.2026.6.26.0000) |
| 280002551547 | ESCRITOR AUGUSTO CURY | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601536-80.2026.6.00.0000) |
| 280002538811 | SAMARA | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601399-98.2026.6.00.0000) |
| 250002544514 | MARCIO ALVES | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602045-85.2026.6.26.0000) |
| 250002554075 | GUTO SCHIAVETTO | senator/SP | Deferido | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603102-41.2026.6.26.0000) |
| 250002541308 | ANDRÉ DO PRADO | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601867-39.2026.6.26.0000) |
| 250002553252 | WILLIAM TEIXEIRA | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602904-04.2026.6.26.0000) |
| 250002552153 | PETTER MAAHS | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602725-70.2026.6.26.0000) |
| 250002548080 | POLICIAL EDJANE | governor/SP | Indeferido em prazo recursal ou com recurso | Histórico ambíguo | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602323-86.2026.6.26.0000) |
| 280002552484 | CLARIANA BARAO | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601576-62.2026.6.00.0000) |
| 280002551932 | RONALDO CAIADO | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601552-34.2026.6.00.0000) |
| 280002542548 | LULA | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601426-81.2026.6.00.0000) |
| 280002551544 | FLAVIO BOLSONARO | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601535-95.2026.6.00.0000) |
| 280002541457 | HERTZ DIAS | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601419-89.2026.6.00.0000) |
| 280002540694 | RENAN SANTOS | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601415-52.2026.6.00.0000) |
| 250002552369 | SONINHA FRANCINE | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602734-32.2026.6.26.0000) |
| 250002551501 | MARINA SILVA | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602652-98.2026.6.26.0000) |
| 250002541362 | DRA ELIANA FERREIRA | senator/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601784-23.2026.6.26.0000) |
| 250002553062 | IZADORA DIAS | governor/SP | Indeferido em prazo recursal ou com recurso | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602742-09.2026.6.26.0000) |
| 250002550913 | CARLOS MACHADO | governor/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602509-12.2026.6.26.0000) |
| 280002551975 | EDMILSON COSTA | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601547-12.2026.6.00.0000) |
| 250002541303 | TARCÍSIO | governor/SP | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601865-69.2026.6.26.0000) |
| 280002552487 | RUI COSTA PIMENTA | president/BR | Deferido | Cargos presentes; vigência não comprovada | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601578-32.2026.6.00.0000) |

## Casos históricos e ausentes da lista

### SALLES — 250002532794

Situação consultada: Deferido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002532794), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0600551-88.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0600549-21.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002550682 | 9 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602507-42.2026.6.26.0000) |
| 250002532793 | 9 | Renúncia | 250002550682 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0600550-06.2026.6.26.0000) |
| 250002532792 | 10 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0600552-73.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; historical_or_ambiguous_nested_references; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

### GUTO SCHIAVETTO — 250002553928

Situação consultada: Pedido não conhecido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002553928), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603024-47.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603021-92.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002554075 | 5 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603102-41.2026.6.26.0000) |
| 250002546629 | Fora do recorte; DTO: Deputado Federal | — | — | Não coletado |
| 250002554136 | 9 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603104-11.2026.6.26.0000) |
| 250002553929 | 9 | Pedido não conhecido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603023-62.2026.6.26.0000) |
| 250002553930 | 10 | Pedido não conhecido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603022-77.2026.6.26.0000) |
| 250002554143 | 10 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603105-93.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; absent_from_list_endpoint; historical_or_ambiguous_nested_references. Não escolher por nome, partido, situação ou posição no array.

### VERA LÚCIA — 250002536915

Situação consultada: Deferido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002536915), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601255-04.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601253-34.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002554470 | 4 | Aguardando julgamento | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0604416-22.2026.6.26.0000) |
| 250002536916 | 4 | Indeferido | 250002554470 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601254-19.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; absent_from_list_endpoint; historical_or_ambiguous_nested_references; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

### PABLO MARÇAL — 280002553884

Situação consultada: Indeferido. O DTO aponta o substituto 280002554479. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/BR/20322002026/candidato/280002553884), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601586-09.2026.6.00.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601584-39.2026.6.00.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 280002553883 | 2 | Renúncia | 280002554490 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0601585-24.2026.6.00.0000) |

Pendências factuais: legal_interval_not_in_detail; absent_from_list_endpoint; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

### GERALDO RUFINO — 250002544673

Situação consultada: Deferido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002544673), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602036-26.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602034-56.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002544671 | 9 | Renúncia | 250002554098 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602035-41.2026.6.26.0000) |
| 250002554098 | 9 | Deferido com recurso | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603100-71.2026.6.26.0000) |
| 250002544672 | 10 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602037-11.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; historical_or_ambiguous_nested_references; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

### VIVIAN MENDES — 250002544912

Situação consultada: Deferido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002544912), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602040-63.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602038-93.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002552372 | 4 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602735-17.2026.6.26.0000) |
| 250002544911 | 4 | Renúncia | 250002552372 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602039-78.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; historical_or_ambiguous_nested_references; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

### GUTO SCHIAVETTO — 250002554075

Situação consultada: Deferido. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002554075), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603102-41.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603021-92.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002553928 | 5 | Pedido não conhecido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603024-47.2026.6.26.0000) |
| 250002546629 | Fora do recorte; DTO: Deputado Federal | — | — | Não coletado |
| 250002554136 | 9 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603104-11.2026.6.26.0000) |
| 250002553929 | 9 | Pedido não conhecido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603023-62.2026.6.26.0000) |
| 250002553930 | 10 | Pedido não conhecido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603022-77.2026.6.26.0000) |
| 250002554143 | 10 | Deferido | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603105-93.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; historical_or_ambiguous_nested_references. Não escolher por nome, partido, situação ou posição no array.

### POLICIAL EDJANE — 250002548080

Situação consultada: Indeferido em prazo recursal ou com recurso. [Detalhe oficial](https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/SP/20322002026/candidato/250002548080), [RRC](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602323-86.2026.6.26.0000), [DRAP](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602322-04.2026.6.26.0000).

| Referência | Cargo verificado no CSV/detalhe | Situação | Substituto explícito | RRC |
| --- | --- | --- | --- | --- |
| 250002554211 | 4 | Renúncia | — | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0603196-86.2026.6.26.0000) |
| 250002548079 | 4 | Renúncia | 250002554211 | [Processo](https://consultaunificadapje.tse.jus.br/#/public/resultado/0602324-71.2026.6.26.0000) |

Pendências factuais: legal_interval_not_in_detail; absent_from_list_endpoint; historical_or_ambiguous_nested_references; explicit_substitution_requires_dated_registration_evidence. Não escolher por nome, partido, situação ou posição no array.

## Condições de consulta e provas ainda necessárias

A [Resolução TSE 23.609/2019, art. 74](https://www.tse.jus.br/legislacao/compilada/res/2019/resolucao-no-23-609-de-18-de-dezembro-de-2019) prevê consulta pública do pedido de registro e a minimização dos dados divulgados. Essa base de consulta não é uma licença geral da API nem autorização de publicação de documentos, fotos ou conteúdo de terceiros. A licença dos ZIPs não foi herdada; apiLicense permanece null. Publicação posterior passa por B06.

Para cada composição, localizar nos processos o vínculo/apensamento titular–vice/suplente e os atos datados de registro/substituição/renúncia. O art. 32 disciplina a associação processual; o art. 69 trata a renúncia datada/homologada. Atualização do DTO e geração do CSV não demonstram esses períodos. Transcrever somente fatos necessários no manifesto de relações, com URL/localizador, data de origem, intervalo e condição de uso verificados; executar o importador novamente. Não transformar o prazo geral de substituição em data individual.

A consulta pública unificada apresentou hCaptcha em 18/09/2026 antes de exibir o RRC 0603024-47.2026.6.26.0000. Nenhum processo/ato foi lido nessa consulta. Autorização para completar o desafio foi solicitada no chat; não houve contorno.

## Revisão e aceite

Stefan forneceu aceite técnico no chat em 18/09/2026 ("211 ok") antes desta coleta. Isso não comprova revisão deste dossiê ou das vigências. O responsável revisa identidades, casos históricos, períodos documentados e escolha SP; registra as exceções aceitas com justificativas, sem marcar relação incompleta como comprovada. O gate humano de B02 e sua conclusão continuam pendentes.

Regra do [AGENTS.md](../../../AGENTS.md): "Nenhum agente aprova o próprio human gate." Para verificar a entrega técnica, usar [B02-verification.json](B02-verification.json); para executar/coletar novas revisões, usar o [contrato/runbook](../back/B02-contract.md).
