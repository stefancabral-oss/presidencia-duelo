# Programa ICM — Frontend PoliMatch

Este diretório organiza a reconstrução do frontend em estágios sequenciais e revisáveis.

## Sequência

1. `01_baseline_e_contrato` — congelar decisões, inventário e critérios.
2. `02_design_system_cards_botoes` — tokens, botões, cards e estados visuais.
3. `03_duelo_mobile_first` — nova experiência de duelo, clique direto na carta e responsividade.
4. `04_sound_haptics_engagement` — sons, haptics e feedback de ranking/progresso.
5. `05_colecao_chromas` — coleção, raridades e foco visual em Chromas.
6. `06_home_ranking_torneio` — unificar telas restantes no novo sistema.
7. `07_acessibilidade_performance_qa` — a11y, performance, regressões e dispositivos.
8. `08_release_deploy_observabilidade` — release, Dokploy, smoke tests e sinais de produção.
9. `09_validacao_final_handoff` — QA completo, documentação final e próximos passos.

## Regra de dependência

Cada estágio depende do anterior, salvo correção crítica explicitamente marcada como hotfix.

## Definição de concluído por estágio

Um estágio só fecha quando existem:

- código/documentação entregues;
- testes previstos executados;
- `output/HANDOFF.md` preenchido;
- `output/verification.json` válido;
- PR associado;
- decisão humana registrada como aprovada.

## Branches

Formato sugerido:

`icm/NN-descricao-curta`

## Pull Requests

Cada PR deve citar a Issue ICM correspondente e listar:

- o que mudou;
- o que não mudou;
- testes;
- riscos;
- screenshots quando houver UI;
- instrução de rollback quando houver risco de produção.
