# Handoff — PR #201 / issue #177

Corrigidos: revalidação de escopo após leitura assíncrona, identidade específica
de implantação via AGGREGATE_DEPLOYMENT_ID, retirada de escalares globais legados
da projeção pessoal e reconsulta de capabilities ao recuperar foco/visibilidade.

Integração solicitada pelo responsável em 17/09/2026. Validações humanas das
unidades integradas continuam abertas. Keyring produtivo continua vazio.
O gate editorial deve continuar retendo registros sem aprovação externa.

As PRs #195 e #200 foram mescladas primeiro nas bases #191 e #194. A PR #201
contém os commits dessas bases e da #199; a mescla final por merge commit preserva
essa ancestralidade para integrar todas na main.

Conflitos resolvidos preservando os slots de DOM, retorno de foco sem timer que
interrompa Tab, taxonomia e filtros, fotos documentais separadas da arte editorial,
votos V2, autorização após I/O e todos os workflows. O texto da busca no artefato
de copy foi atualizado para refletir nome, partido e área.

A geometria móvel do formulário bloqueado do piloto agora segue a carta acessível
de 236 px, com placa de 88 px. Fixtures sintéticas acompanham a geometria; nenhum
resultado real, licença ou decisão de aprovação foi criado ou revalidado.

Ver verification.json. O CI da PR executa também PostgreSQL, prova de abuso,
Chromium, WebKit e build Docker. Gates humanos continuam pendentes.
