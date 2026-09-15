# CONTEXT — ICM 10 · Fundação Eleições 2026

## Objetivo

Substituir o frontend anterior por uma fundação limpa para a edição `Eleições 2026`, preservando apenas contratos necessários do backend e preparando o catálogo curado de 125 pessoas.

## Entradas aprovadas

- Frontend anterior rejeitado.
- Catálogo com 125 pessoas após curadoria: 100 nomes políticos e 25 influenciadores; a edição principal expõe somente quem já tem fotografia aprovada, independentemente do grupo.
- Gate visual antes da publicação das fotografias tratadas.
- Menu preparado para assuntos futuros.
- Duelo, educação, ranking e coleção formam o núcleo.
- Aplicação online-only.
- Direção visual aprovada: `Malaquita 2026 / Digital First`, conforme imagens em `references/approved-art-direction/`.
- Especificação mobile externa incorporada com ressalvas em `references/UI_MOBILE_ADOPTION.md`; a fonte integral está em `references/source-ui-mobile-v1.md`.
- Chromas são opcionais, pessoais e equipáveis; o duelo é contínuo e o ranking só abre quando o usuário pedir.

## Escopo desta etapa

- Inventariar contratos do backend usados pelo produto novo.
- Remover importações e camadas visuais do frontend anterior.
- Criar shell novo e independente.
- Implementar a navegação mínima da edição.
- Criar estados de assunto, duelo, perfil, ranking e coleção com o catálogo novo.
- Importar 100 nomes políticos e preparar 25 influenciadores; por decisão posterior do usuário, incluir na edição principal todos os perfis que já tenham fotografia aprovada.
- Preservar as 1.500 Chromas recebidas como rascunho separado da carta padrão.
- Manter acessibilidade e responsividade desde a fundação.

## Fora de escopo

- Tratamento das 375 fotografias-fonte.
- Edições independentes Influenciadores e Escândalos.
- Login social e publicação automática.
- Deploy definitivo em produção antes do gate visual.

## Critérios de aceite

1. Nenhum CSS ou componente visual legado é importado pelo app novo.
2. O shell reproduz a direção malaquita escura, detalhes dourados e cards premium aprovados.
3. A tela de assuntos apresenta `Eleições 2026` e sinaliza expansões futuras.
4. Um duelo pode ser compreendido e votado por toque na carta.
5. A ficha educativa abre e fecha sem perder o duelo.
6. Ranking e coleção são navegáveis.
7. Falha de API não aceita voto e apresenta uma ação clara.
8. Build e testes essenciais passam.

## Gate humano

O usuário aprova a direção visual e os retratos tratados antes da publicação; dados editoriais e Chromas permanecem em revisão até seus próprios gates.
