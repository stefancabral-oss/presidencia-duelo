# HANDOFF — ICM 09

## Status

- Estado: pronto para aceite final
- Issue: #91
- PR: #113
- Release: `082c80eca21ebd3a9af7c4ea55261034c7c8705b`

## Entregue

- Frontend Malaquita consolidado, online-only e publicado.
- 360 pessoas, cinco assuntos, descrições editoriais, coleção, Chromas e fichas.
- Duelo, Ranking e Torneio integrados à API e ao PostgreSQL.
- Testes locais, CI, Chromium/WebKit e persistência real aprovados.

## Bugs conhecidos

- Corrigido no hotfix `hotfix/layout-panels-overflow-nav-gzip` (13/09, pós-release): as regras `.pm-home-v2`, `.pm-ranking-v2` e `.pm-tournament-v2 {display:grid}` venciam `.panel{display:none}` e deixavam Início, Torneio e Ranking sempre visíveis (empilhados); a coluna implícita dos painéis em grid crescia até o min-content do seletor de assunto (overflow horizontal de 747 px em 390 px); a navegação principal usava `position:sticky; bottom` num elemento que nasce no topo e sumia ao rolar; o nginx do PWA servia JS/CSS sem gzip e sem `Cache-Control`. O smoke e2e passou a verificar `display` computado, `scrollWidth` e navegação visível, além da classe `active`.
- Fotos remotas podem acionar fallback quando o provedor limita requisições.

## Backlog pós-v1

- SSO real e recuperação de conta assistida.
- Analytics de produto e observabilidade de exceções.
- Novas artes e momentos Chroma pelo pipeline editorial.

## Human gate

- Decisão: pendente do aceite visual do usuário na URL pública.
