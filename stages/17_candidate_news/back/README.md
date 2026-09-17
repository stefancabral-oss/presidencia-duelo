# BACK — execução do épico #206

Issue principal: [#207](https://github.com/stefancabral-oss/presidencia-duelo/issues/207). Implementar a base de dados, importação oficial, proveniência, coleta permitida, agrupamento editorial, APIs públicas e operação auditável das áreas Candidatos e Notícias, preservando integralmente o jogo e cobrindo Presidência e as 27 UFs ao concluir o épico.

Leia [agente.md](agente.md) antes da primeira microissue. Os códigos ordenam o roteiro; dependências definem quando iniciar. Pré-requisitos adicionais de conclusão constam do Markdown individual. Estado de execução é acompanhado no GitHub.

| Código | Issue | Passo a passo | Depende de |
| --- | --- | --- | --- |
| B01 | [#210](https://github.com/stefancabral-oss/presidencia-duelo/issues/210) | [[Back B01] Definir contratos, esquema próprio e fixtures eleitorais/editoriais](microissues/B01.md) |  |
| B02 | [#211](https://github.com/stefancabral-oss/presidencia-duelo/issues/211) | [[Back B02] Importar candidaturas oficiais, chapas temporais e cobertura nacional](microissues/B02.md) | B01 |
| B03 | [#212](https://github.com/stefancabral-oss/presidencia-duelo/issues/212) | [[Back B03] Vincular propostas, afirmações e fotografias com proveniência revisável](microissues/B03.md) | B01, B02 |
| B04 | [#213](https://github.com/stefancabral-oss/presidencia-duelo/issues/213) | [[Back B04] Cadastrar veículos e coletar matérias por fontes permitidas](microissues/B04.md) | B01 |
| B05 | [#214](https://github.com/stefancabral-oss/presidencia-duelo/issues/214) | [[Back B05] Modelar acontecimentos, três perspectivas e deduplicação editorial](microissues/B05.md) | B01, B04 |
| B06 | [#215](https://github.com/stefancabral-oss/presidencia-duelo/issues/215) | [[Back B06] Expor APIs públicas e fluxo editorial autenticado de publicação/correção](microissues/B06.md) | B01, B02, B03, B04, B05 |
| B07 | [#216](https://github.com/stefancabral-oss/presidencia-duelo/issues/216) | [[Back B07] Preparar jobs, segurança, frescor e custos para operação editorial](microissues/B07.md) | B02, B03, B04, B05, B06 |

[Voltar ao índice do estágio](../README.md).
