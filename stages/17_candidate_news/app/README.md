# APP — execução do épico #206

Issue principal: [#209](https://github.com/stefancabral-oss/presidencia-duelo/issues/209). Integrar as novas áreas no app existente com navegação e estado isolados, cache/revogação seguros, leitura pública anônima, acessibilidade e regressão verificadas, culminando em piloto real e reconciliação nacional do diretório.

Leia [agente.md](agente.md) antes da primeira microissue. Os códigos ordenam o roteiro; dependências definem quando iniciar. Pré-requisitos adicionais de conclusão constam do Markdown individual. Estado de execução é acompanhado no GitHub.

| Código | Issue | Passo a passo | Depende de |
| --- | --- | --- | --- |
| A01 | [#223](https://github.com/stefancabral-oss/presidencia-duelo/issues/223) | [[App A01] Integrar shell, rotas, deep links e contrato de montagem sem perder a rodada](microissues/A01.md) | B01 |
| A02 | [#224](https://github.com/stefancabral-oss/presidencia-duelo/issues/224) | [[App A02] Conectar API, estado público e preferência de UF com leitura anônima](microissues/A02.md) | B01 |
| A03 | [#225](https://github.com/stefancabral-oss/presidencia-duelo/issues/225) | [[App A03] Isolar cache/PWA, flags e privacidade preservando disponibilidade do jogo](microissues/A03.md) | B01, A01, A02 |
| A04 | [#226](https://github.com/stefancabral-oss/presidencia-duelo/issues/226) | [[App A04] Integrar as três frentes e comprovar E2E, acessibilidade e regressão](microissues/A04.md) | A03, B06, F02, F03, F04, F05, F06 |
| A05 | [#227](https://github.com/stefancabral-oss/presidencia-duelo/issues/227) | [[App A05] Conduzir release gradual, piloto de sete dias e reconciliação nacional](microissues/A05.md) | B01, B02, B03, B04, B05, B06, B07, F01, F02, F03, F04, F05, F06, A01, A02, A03, A04 |

[Voltar ao índice do estágio](../README.md).
