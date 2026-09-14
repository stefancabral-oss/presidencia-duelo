# Auditoria de importação — 1.500 Chromas

## Resultado estrutural

- 5 partes recebidas.
- 1.500 registros.
- 125 pessoas únicas, todas presentes no catálogo mestre.
- Exatamente 12 Chromas por pessoa.
- Numeração completa de 1 a 12 em cada conjunto.
- Nenhum título duplicado para a mesma pessoa.
- Raridades recebidas: Comum, Incomum, Rara, Épica, Lendária e Meme.

## Separação aplicada

O catálogo foi normalizado em `output/chromas-catalog-draft.json`, mas não é carregado automaticamente nos duelos. Todas as entradas permanecem com:

- `status: draft`;
- `artworkUrl` vazio;
- vínculo estável com a pessoa;
- efeito de jogo preservado apenas como texto editorial, sem efeito real no Elo ou no voto.

## Gate de fontes

- 702 Chromas possuem uma URL HTTP(S) no campo de fonte.
- 798 usam notas genéricas como “perfil oficial”, “input” ou “cobertura”, sem URL verificável.
- Essas 798 foram marcadas com `sourceReviewStatus: source-required`.

Nenhuma Chroma deve ficar disponível por sorte ou compra até receber arte, conferência editorial e fonte verificável compatível com o momento descrito.

## Reprodução

```sh
npm run build:catalog --prefix back
```
