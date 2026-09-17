# ICM 15 — Recuperar fotografias e operação

Issue #202. Em 17/09/2026 Stefan solicitou construir as issues e recolocar o jogo em operação. Confirmou expressamente: “Restaurar as fotografias existentes nas cartas e deixar ilustrações para depois”. Essa decisão substitui a exigência de ilustração da #176 para a recuperação; não aprova biografias, alegações, taxonomia inferida nem resultados agregados.

## Unidade ativa: recuperação do serviço

- API e PWA devem usar o mesmo release, com identidade verificável.
- Restaurar o conjunto fotográfico já selecionado em `shared/curated-portraits.js`, usando os arquivos documentais correspondentes em `/portraits/`. Identidade, caminho e hash ficam fixados em manifesto; nenhuma imagem experimental entra.
- O catálogo mínimo de recuperação contém nome e fotografia. Biografia, pontos de atenção, fatos e classificações pendentes ficam retidos. O estado de revisão continua `pending`; não produzir recibos ou assinaturas de aprovação editorial.
- A autorização de restauração deve aparecer como `restored`, distinta de aprovação editorial integral. Um registro explicitamente rejeitado não pode ser restaurado automaticamente.
- Preservar jogadores, votos e snapshots históricos. Novos snapshots precisam preservar o contrato de publicação da fotografia.
- Validar API real com PostgreSQL, ciclo completo de sessão e carregamento das fotografias no navegador antes de promover.

## Próximas unidades, em dependência

1. #173: estrutura e proveniência já implementadas; revisão editorial humana permanece distinta.
2. #180: Espelho com pelo menos três eixos estruturados não sensíveis; sem inventar metadados para o acervo em revisão.
3. #184: linguagem compreensível e feedback por rodada.
4. #172/#182: formato binário explícito para abertura e desempate; migração e idempotência.
5. #181: descarte opcional separado da pontuação, após formato definido.
6. #183: coleção real; aquisição gratuita e independente da pessoa; nenhuma venda.
7. #151/#156/#166/#167: conferir implementação e registrar os testes/human gates restantes.
8. #175/#177: fechamento por evidências das unidades, nunca por contagem de PRs.
9. #176: ilustrações adiadas pela decisão expressa acima.

## Pronto

Fotos carregam; API inicia; contratos coincidem; jogador consegue terminar uma sessão; dados anteriores permanecem; relatório registra testes, release e pendências reais.
