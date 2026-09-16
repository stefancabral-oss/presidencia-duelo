# HANDOFF — #176 · piloto de arte de carta

## Status

- Estado: `lote de oito gerado; teste humano pendente`
- Issue: https://github.com/stefancabral-oss/presidencia-duelo/issues/176
- Branch: `icm/12-u05-card-art-pilot-176`

## Entregue

- Guia de neutralidade anterior à encomenda.
- Seleção auditável das oito pessoas e protocolo cego.
- Critérios quantitativos de reconhecimento e neutralidade.
- Oito artes de piloto isoladas do catálogo público, com manifesto, referências e checksums.
- Formulário offline randomizado para coletar respostas sem exibir os nomes.
- Teste automatizado de integridade, estado, dimensões, proporção, referências e checksums.

## Verificação técnica

- `npm test --prefix app`: 42/42 testes aprovados.
- `npm run build --prefix app`: aprovado; o piloto não é importado pelo bundle.
- Oito PNGs em 1122 × 1402, proporção 4:5 dentro da tolerância.

## Fora deste corte

- Publicar as artes no jogo.
- Alterar o portão de elegibilidade.
- Separar o modelo `cardArt`/`profilePhoto`, que só deve ser ativado junto da governança editorial da #171 e após o piloto.
- Declarar aprovação sem participantes humanos externos.

## Próximo passo

Executar o formulário `references/card-art-pilot-176.html` com pelo menos 20 pessoas externas, consolidar os JSONs e registrar a decisão humana na issue.
