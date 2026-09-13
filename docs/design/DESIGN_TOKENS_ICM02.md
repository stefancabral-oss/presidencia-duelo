# PoliMatch Design Tokens — ICM 02

Issue: #100

## Princípio visual

O shell deve ser silencioso. O card, especialmente Chroma, deve carregar a maior parte da personalidade visual.

## Cores

### Base
- Fundo claro: `#FAF8F3`
- Superfície: `#FFFFFF`
- Porcelana: `#F7F3E8`
- Borda neutra: `#DEDBD2`
- Texto principal: `#10211A`
- Texto secundário: `#617068`

### Malaquita
- 950: `#05241A`
- 900: `#073326`
- 800: `#0B4B37`
- 700: `#126247`

Uso: estrutura, navegação ativa, ícones importantes, estados funcionais. Não usar como grande fundo dominante em todas as telas.

### Ouro
- 500: `#D4AF37`
- 400: `#E8CC6D`
- 200: `#F4E8B7`

Uso: ação primária, raridade e recompensa. Não usar em todos os controles simultaneamente.

### Chroma
- Ciano: `#00C9D8`
- Violeta: `#8B5CF6`
- Magenta: `#E657A6`

Uso: apenas em raridade/foil, recompensas raras e momentos especiais.

## Espaçamento

Escala: 4, 8, 12, 16, 20, 24, 32px.

## Raios

- XS: 8px
- SM: 12px
- MD: 18px
- LG: 24px
- Pill: 999px

Cards usam raio próprio visual próximo de 19px no desktop e 15px no mobile.

## Botões

Altura mínima: 44px.

Famílias:
- Primary: ouro, uma ação dominante por área.
- Secondary: superfície clara + borda discreta.
- Ghost: ação de baixa prioridade.
- Icon: circular, 44x44.
- Danger: destrutiva.
- Topic chip: filtro/navegação contextual.

Estados obrigatórios: default, hover, pressed, focus-visible, disabled e loading quando aplicável.

## Card

Proporção base: `5:7`.

- Media: 63% da altura.
- Informação: 37%.
- Ordem: foto -> nome -> papel/cargo -> descrição -> metadado.
- Raridade no canto superior direito.
- Marca discreta no canto superior esquerdo.

## Motion

- Rápido: 120ms.
- Médio: 220ms.
- Easing: `cubic-bezier(.2,.8,.2,1)`.
- Foil Chroma: até 650ms e apenas em interação relevante.
- `prefers-reduced-motion` desativa efeitos decorativos.

## Regra de densidade

Se um elemento não ajuda a escolher, entender a pessoa, navegar ou perceber um estado, ele não deve competir visualmente na tela do Duelo.
