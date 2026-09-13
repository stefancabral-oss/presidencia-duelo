# Migração do CSS legado — ICM 02

## Objetivo

Evitar que o novo frontend continue crescendo como uma pilha infinita de `styles.css + malaquita.css + malaquita-shell.css + overrides`.

## Estratégia desta etapa

O ICM 02 não remove globalmente o CSS antigo porque Home, Torneio, Ranking, Créditos e modais ainda dependem dele. Em vez disso:

1. `design-system.css` passa a ser o contrato dos componentes novos.
2. `design-system-states.css` concentra estados de interação e raridade.
3. `design-system-bridge.css` neutraliza apenas as regras antigas que conflitam com componentes já migrados.
4. Cada ICM posterior remove fisicamente o CSS legado da tela que estiver reconstruindo.

## Componentes já migrados

- card de duelo (`.poke-card.pm-card`);
- anatomia interna do card;
- topic chips;
- tabs/navegação;
- mode switch;
- botões primary/secondary/ghost/icon/danger;
- home shortcuts/tile buttons;
- botão Ver ficha;
- Pular;
- estados pending/win/lose do card;
- layout central do Duelo em mobile/desktop.

## Regras legadas neutralizadas pelo bridge

- padding, borda e box-shadow antigos do `.poke-card`;
- hover/focus dourado antigo do card;
- estilos antigos de `.card-info`;
- estilos antigos de `.topic-btn`;
- estilos antigos de `.tab`;
- aparência antiga de VS/Pular no Duelo;
- cores antigas do progress bar dentro do Duelo.

## Remoção física planejada

- ICM 03: remover regras antigas específicas do Duelo após reconstrução do shell.
- ICM 05: remover regras antigas de coleção/raridade quando a Galeria Chroma entrar.
- ICM 06: remover regras antigas de Home, Ranking e Torneio.
- ICM 07: procurar seletores órfãos e duplicações restantes.

## Regra

Nenhuma nova feature deve adicionar mais uma folha de estilo temática global sobre a anterior. Componentes novos entram pelo design system ou por CSS localizado do estágio correspondente.
