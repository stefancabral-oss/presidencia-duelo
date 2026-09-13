# Inventário atual do frontend

## Entradas e shell

- `front/src/main.js`: inicia o jogo e carrega estilos/camadas de enhancement.
- `app/src/main.js`: wrapper PWA do mesmo front.
- `front/src/game.js`: shell principal, navegação, Duelo, Torneio, Ranking, Créditos, modais, onboarding e integração com API.
- `front/src/frontend-enhancements.js`: melhorias adicionadas sobre a UI existente.
- `front/src/styles.css`: sistema visual legado/base.
- `front/src/malaquita.css`: primeira camada visual Malaquita.
- `front/src/malaquita-shell.css`: segunda camada de shell Malaquita.

## Componentes principais

### Duelo
- `duel-card.js`: anatomia/renderização da carta.
- `pick.js`, `pick-feedback.js`, `online-vote.js`, `vote-session.js`: fluxo de escolha e feedback.
- `matchmaking.js`: escolha do par.
- `quick-controls.js`: teclado/swipe.
- `skip-duel.js`: pular duelo.
- `progress.js`, `achievements.js`, `rarity.js`: progresso, combo, conquistas e raridade.

### Tópicos
- `topic-selector.js`.
- `shared/topics.js`.

### Torneio
- `tournament.js`.
- `tournament-pick-lock.js`.
- `restart-confirm.js`.

### Ranking e coleção parcial
- `ranking.js`.
- `rarity.js`.
- `podium.js`.
- Ainda não existe a nova experiência de coleção completa aprovada no ICM 05.

### API / estado
- `api.js`: timeout e classificação de falhas.
- `player-sync.js`: sincronização individual.
- `storage.js`: estado local.
- API agregada/backend em `back/`.

## Dívida visual atual

1. O frontend ainda é uma composição incremental de `styles.css` + `malaquita.css` + `malaquita-shell.css`.
2. Há componentes com linguagem visual herdada do design antigo.
3. A primeira tentativa de Malaquita foi parcial e dependente de cascata CSS.
4. Botões não nasceram de um design system único.
5. O modal de meta e elementos de status já ficaram visualmente invasivos no mobile.
6. O Duelo precisa ser reconstruído em torno do card, não apenas estilizado.
7. Coleção/Chromas ainda não são experiência de produto completa.
8. Não há sound design integrado como camada formal de UX.

## Regressões já observadas e que viram invariantes de teste

- tocar numa carta não pode mandar o usuário para Ranking;
- cards não podem ficar bloqueados indefinidamente por requisição pendente;
- respostas atrasadas não podem contaminar sessão/assunto diferente;
- duplo clique no Torneio não pode registrar duas escolhas;
- PWA não pode quebrar offline com erro de escopo;
- confirmação nativa bloqueante não deve ser usada para reiniciar Torneio;
- produção precisa ser comparada com o commit realmente implantado.

## Decisões de produto congeladas nesta rodada

- base clara/porcelana;
- malaquita como estrutura;
- ouro com contenção;
- Chromas concentram cor/foil/brilho;
- card vertical, alto, com proporção TCG;
- toque direto na carta para escolher;
- sem botão separado de escolher;
- card contém nome + quem é + o que faz + descrição curta;
- sistema próprio de botões;
- som/haptics são parte da interação;
- SSO real adiado.
