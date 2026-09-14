# PoliMatch — Especificação de UI Mobile (app real)

**Versão:** 1.0 · **Base:** iPhone 390 × 844 pt (iPhone 14/15/16) · **Idioma:** pt-BR
**Direção de arte:** aprovada (Malaquita 2026 · Digital First) — esta spec transforma a direção em sistema construtível, sem criar identidade alternativa.

---

## 1. Fundamentos

### 1.1 Canvas e áreas seguras

| Item | Valor |
|---|---|
| Canvas base | 390 × 844 pt (@2x = 780×1688, @3x = 1170×2532 px) |
| Safe area superior | 59 pt (status bar 47 + respiro do Dynamic Island) |
| Safe area inferior | 34 pt (home indicator) |
| Margem lateral | 16 pt (largura útil: 358 pt) |
| Máximo de coluna de leitura | 480 pt (centralizada em telas maiores) |

Conteúdo sempre dentro da safe area. Status bar com conteúdo claro (branco) sobre malaquita. Fundo global M900.

### 1.2 Tokens de cor

| Token | Hex | Uso |
|---|---|---|
| **Malaquita** | | |
| M900 | `#002B24` | Fundo global, tela de revelação |
| M800 | `#00382E` | Superfícies base, tab bar, header |
| M700 | `#004236` | Cards de destaque, botões secundários (extração da parede malaquita) |
| M600 | `#0D5C4B` | Bordas ativas, texto-verde sobre placa clara |
| M500 | `#1B7A64` | Ilustrações/ícones de apoio |
| Verde Comum (raridade) | `#4CAF50` | Raridade COMUM, selo verde |
| **Ouro** | | |
| Ouro 300 | `#F9E498` | Brilho, texto dourado sobre fundo escuro (iluminações) |
| Ouro 400 | `#E8CE7E` | Texto dourado legível sobre malaquita (AA ≥ 4.5:1) |
| Ouro 500 | `#D4AF37` | Ouro principal: bordas, selos VS, gradientes (extração) |
| Ouro 600 | `#A9852B` | Hover/pressionado de elementos ouro |
| Ouro 700 | `#7D611D` | Texto dourado sobre mármore claro (AA ≥ 4.5:1) |
| **Mármore / claros** | | |
| Placa | `#F7F4EC` | Placa inferior do card, fundo de sheets (quente, com veios `#E3DCCB`) |
| Branco | `#FFFFFF` | Texto principal sobre escuro |
| Fumaça | `#F2F2F2` | Extração de referência; superfícies alternativas |
| Tinta | `#12201B` | Texto sobre claro |
| **Apoio** | | |
| Azul Rara | `#4A90E2` | Raridade RARA |
| Branco 72% | `rgba(255,255,255,.72)` | Texto secundário sobre escuro |
| Branco 50% | `rgba(255,255,255,.50)` | Hint, placeholders |
| Divisor escuro | `rgba(255,255,255,.12)` | Hairlines |
| Scrim | `rgba(0,21,16,.72)` | Backdrop de sheets/modal |
| Sucesso / Alerta / Erro | `#3DD68C` / `#FFC24B` / `#FF6B6B` | Estados (raros; identidade pede ouro+verde) |
| **Chroma prismático** | | |
| Prisma 6 paradas (refinado) | `#FFD84D → #FF6B4A → #E6388E → #8B5CF6 → #38B6FF → #00E0A8` | Borda/comemorativa, arco animado |
| Prisma puro (referência da arte) | `#00FFFF → #FF00FF → #FFFF00 → #7B61FF` | Kilómetros de origem, não usar em texto |

**Regras de cor:**
- Texto dourado somente sobre fundos escuros (M900/M800). Sobre mármore, usar Ouro 700.
- Verde M600 para o país/estado na placa (como na arte aprovada), nunca branco puro nesse slot.
- Ouro 500 é para estrutura (bordas, selos, ícones), não para texto pequeno (< 12 pt).

### 1.3 Tipografia

**Famílias:** Inter (UI e cards, conforme mockup aprovado) + Instrument Serif (momentos de colecionável premium: ficha, revelação Chroma, números de ranking). Nenhuma fonte decorativa adicional.

| Estilo | Família/Peso | Tamanho/Linha | Tracking | Uso |
|---|---|---|---|---|
| Serif Grande | Instrument 400 | 28 / 34 | 0 | Nome na revelação Chroma |
| Serif Título | Instrument 400 | 24 / 30 | 0 | Nome na ficha, números de posição |
| Título de tela | Inter 700 | 20 / 24 | +0.5 | RANKING, COLEÇÃO |
| Cabeçalho de seção | Inter 800 | 14 / 18 | +1.5 | UPPERCASE, seções |
| Corpo | Inter 400 | 15 / 22 | 0 | Biografias, descrições |
| Legenda | Inter 400 | 12 / 16 | 0 | Apoio |
| Micro | Inter 600 | 10 / 14 | +1 | UPPERCASE, chips, selos |
| Botão | Inter 800 | 14 / 18 | +1 | UPPERCASE |
| Tab bar | Inter 800 | 10 / 12 | +0.5 | UPPERCASE |
| Nome no card | Inter 600 | 17 / 20 | 0 | Placa do card (sans, como no arte-final) |
| Sub nome do card | Inter 800 | 8 / 10 | +1.2 | UPPERCASE — BRASIL / PARTIDO |
| Stats do card | Inter 800 | 9 / 12 | +0.5 | 78 ATQ · 82 DEF · 65 VEL (valores 9, rótulos 6.5) |

Escala responsiva: −1 pt por degrau abaixo de 375 pt de largura (mínimos: corpo 14, botão 13, nome do card 15); +1 pt opcional em telas ≥ 414 pt.

### 1.4 Grade, espaçamento, raios e elevação

- **Escala de espaçamento:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72 pt (múltiplos de 4, nunca ímpares).
- **Grid:** 1 coluna, margens laterais 16 pt; grids internos: 2 colunas (238 + 100) nos sheets, 3 colunas na Coleção.
- **Raios:** card 14 pt · placa inferior 12 pt (inferiores) · sheet 20 pt (superiores) · botões 14 pt (pill opcional `999`) · chips 16 pt · VS 22 pt (círculo).
- **Elevação/sombras:** cards não flutuam — luz vem do brilho da raridade: `box-shadow: 0 8 24 rgba(0,0,0,.35)` de contato + glow por tier (§3). Na revelação, `0 24 80 rgba(0,0,0,.5)`.
- **Hairlines:** 1 pt `rgba(255,255,255,.12)` sobre escuro; `#E3DCCB` sobre mármore.
- **Gradientes:** Ouro de botão/selo = `linear 135° Ouro 300 → Ouro 500 → Ouro 600` (radial para o pill primário, como o botão INICIAR DUELO aprovado); aura de card = `radial 50% rgba(249,228,152,.25) → transparente`.

### 1.5 Logotipo e linguagem visual

- **Diamante PoliMatch:** losango formado por 4 facetas (2 doradas + 2 verde-malaquita), 20 × 20 pt na navegação, 16 pt no card, 40 pt no verso do Chroma.
- **Wordmark:** "PoliMatch" Inter 800, tinta sobre claro / branco sobre escuro; nunca em gradiente.
- **Chips de categoria:** COMUM = círculo `●` verde · RARA = losango `◆` azul · CHROMA = hexágono `⬡` ouro/prisma (ícones geometric stroke 1.5 pt, como na arte).
- Vocabulário: "molduras facetadas", "placa clara", "fotografia dominante" são regras de anatomia (§3), não decoração.

---

## 2. Sistema de raridades (9 tiers, 3 famílias)

| Família | Tier | Borda | Efeito | Estrelas |
|---|---|---|---|---|
| COMUM | Básica | 1.5 pt verde sólido `#4CAF50` | — | — (selo: ponto) |
| COMUM | Incomum | 1.5 pt verde | Neon glow `0 0 8 rgba(76,175,80,.25)` | 1 (branca) |
| RARA | Rara | 2 pt `#0D5C4B` + padrão facetado geométrico | Brilho direcional | 1 (azul, em círculo) |
| RARA | Rara Dupla | 1 pt ouro fino `#D4AF37` (gold-tinted) | Cintilação fina | 2 (ouro) |
| RARA | Ultra | 2 pt ouro + aura | Glow `0 0 16 rgba(212,175,55,.45)` | 2 (ouro, em moldura) |
| CHROMA | Ilustrada | Verde + listras diagonais ouro (45°) | Movimento sutil das listras | 1 (ouro) |
| CHROMA | Especial | Ouro + aura circular | Aura pulsante `6 s` | 2 (ouro) |
| CHROMA | Suprema | 3 pt ouro ornamentado | Glow radiante + partículas | 3 (ouro) |
| CHROMA | Comemorativa | Iridescente prisma animado (6 paradas, loop 6 s) | Holográfico total; retrato vira ilustração | 1 (grande, prisma, em círculo) |

- **Selo de estrelas:** círculo 22 pt com fundo da cor da família (opacidade 90%) e 1–3 estrelas de 10 pt (preenchidas); Star level = nível do tier. O selo é o único indicador de raridade **no canto superior direito** do card; família também é sempre escrita na placa (nunca confiar só na cor — acessibilidade).
- Ordenação de coleção: Básica → Incomum → Rara → Rara Dupla → Ultra → Ilustrada → Especial → Suprema → Comemorativa.

---

## 3. Anatomia do card (formato Duelo, 148 × 222 pt — 2:3)

```
┌─────────────────┐ 148
│ ●●           ★★ │  ← selo estrelas 22 @ (8,8) direita; diamante 16 @ (8,8) esquerda
│                 │
│    FOTO (73%)   │  0 → 168  (dominante, full-bleed, scrims: topo 24, base 40)
│    ————————     │
│ ▍▍▍▍▍▍▍▍▍▍▍▍▍▍ ▕ │  168 → 222  PLACA MÁRMORE (54 pt = 24% da altura)
│ ANA VILHENA     │   nome Inter 600 17/20, tinta, top 5
│ BRASIL          │   sub Inter 800 8/10 UPPER +1.2, M600 (verde, como na arte)
│ 78 · 82 · 65    │   stats 3 col (44 pt cada): valor Inter 800 9 Ouro 700 / rótulo 6.5
└─────────────────┘
```

| Elemento | Medida | Regra |
|---|---|---|
| Moldura | faixa 1.5–3 pt (cor por tier) | Cantos com **corte facetado**: chanfros de 8 pt em 45° nos 4 cantos; a foto respeita a máscara chanfrada |
| Foto | 168 pt (73%) | Foto real, rosto centrado em 60–75% da moldura superior, nunca tocando a placa |
| Placa | 54 pt (24%), `#F7F4EC` + 1 veio `#E3DCCB` | Cantos inferiores 12 pt, superiores 8 pt; vaza 0 pt (contida na moldura) |
| Nome | 17/20 Inter 600 | 1 linha, ellipsis; nunca em caixa alta |
| Sub | 8/10 Inter 800 UPPER | PAÍS · PARTIDO (2 itens, separados por `·`) |
| Stats | 3 colunas + rótulos (ATQ/DEF/VEL) | Valores extraídos da ficha do candidato; ocultos no card da Coleção (tamanho menor) |
| Selo de raridade | 22 pt círculo @ topo-direito | Estrelas 10 pt; tier Básica usa ponto 6 pt |
| Glow | por tier (§2) | Fora da moldura, nunca dentro da foto |

**Variações de tamanho:** Coleção 108 × 162 (placa 40: nome 11, sub 6.5, sem stats) · Ficha/detalhe 180 × 270 (à mostra em superfície maior) · Revelação 190 × 285 (hover com brilho próprio).

---

## 4. Estados de toque, motion e háptico

| Estado | Card (alvo de voto) | Botão "QUEM É?" / CTAs | Chip / tab |
|---|---|---|---|
| Idle | — | Pill outline ouro 45% | Outline branco 40% |
| Pressed (toque) | `scale .97` + brilho −15% · 120 ms | Fill malaquita 700 40%, texto ouro 300, `scale .98` | Fill branco 12% |
| Votado (feedback) | Anel ouro 2 pt + selo check 28 pt (fundo ouro, losango tinta) + glow | — | — |
| Oponente | Dim opacity .30 + recua 8 pt (300 ms) | — | — |
| Disabled | Opacity .35, sem touch | Opacity .35 | Opacity .35 |
| Loading | Skeleton = placa de mármore com shimmer ouro 10% | Spinner 16 pt ouro | — |

- **Motion tokens:** 120 ms (press) · 200 ms (chip/tab/fade) · 300 ms (sheet, transições de estado) · 500 ms (troca de duelo) · 900 ms (flip do Chroma). Easing padrão `cubic-bezier(0.22,1,0.36,1)`; revelação usa spring (stiffness 260, damping 20).
- **Háptico:** press = `UIImpactFeedbackGenerator(.light)` · voto registrado = `.medium`/success · Chroma revelada = success + notification · erro = warning.
- Redução de movimento (sistema): todas as animações viram fades ≤ 200 ms; flip do Chroma vira fade+scale.

---

## 5. Acessibilidade

- **Contraste AA (4.5:1)** para todo texto; regras do §1.2 (ouro só sobre escuro; Ouro 700 sobre mármore).
- **Alvos de toque ≥ 48 × 48 pt.** Card inteiro é um alvo (148×222 ✓). "QUEM É?" tem 148×40 visual + área de toque estendida para 56 pt.
- **VoiceOver:** cada card expõe rótulo composto: "Ana Vilhena, Brasil, Democrata, raridade Rara, toque para votar". Raridade sempre narrada em texto (nunca só cor). Sheet da ficha anuncia papel `sheet`; revelação usa `live region` ("Chroma Comemorativa desbloqueada").
- **Dynamic Type:** corpos, legendas e títulos escalam até +200% (ficha e resultados reorganizam em pilha). Cards conservam proporção fixa — texto da placa aceita 2 linhas com ellipsis e tooltip.
- **Motion:** respeitar `prefers-reduced-motion` (§4).
- Foco visível em navegação por teclado/switch (anel ouro 2 pt + halo).

---

## 6. Responsividade

| Largura | Ajustes |
|---|---|
| 320 pt (SE 2ª/3ª) | Margens 12; cards 118 × 177; VS 36; fontes −1 pt; Coleção em 2 colunas (cards 138 × 207); ficha em pilha total |
| 375 pt | Base com cards 141 × 212 |
| 390–393 pt | **Base da spec** (cards 148 × 222) |
| 414–430 pt (Pro Max) | Margens 16–20; cards 158 × 237; conteúdo centralizado em coluna máx. 480 pt |
| Landscape / tablet | Coluna central máx. 560 pt; duel com cards 168 × 252; ranking pode abrir 2 colunas (pódio à esquerda) |

Princípio: **o par de cards, o VS e o botão sempre 100% visíveis sem scroll** — as transições de breakpoint reescalam o card, nunca escondem elementos. Em telas < 320 pt (não suportado), cards 108 × 162 com hint oculto.

---

## 7. Navegação global (tab bar)

Barra inferior fixa: **altura 64 pt de conteúdo + 34 pt de safe area** (98 pt total). Fundo M900 sobre blur 12%, hairline superior `rgba(255,255,255,.10)`. 3 abas (condensam o mock aprovado de 5 itens: Home → Duelos, Eventos → dentro de Eleições 2026, Perfil → Ranking pessoal):

| Aba | Ícone (stroke 1.5, 24 pt) | Rótulo |
|---|---|---|
| Duelos (1ª) | Dois cards sobrepostos + faísca ouro | DUELOS |
| Ranking (2ª) | Pódio de 3 barras | RANKING |
| Coleção (3ª) | Grade 2×2 | COLEÇÃO |

Ativo: ícone + rótulo em Ouro 400, losango 5 pt acima do rótulo. Inativo: branco 55%. Alvo mínimo 48 pt. Tab bar presente em **todas** as telas exceto sheet (ficha) e revelação Chroma (full-screen imersivo, sem barra — o retorno é pelos CTAs).

---

## 8. Telas

### Tela 1 — Escolha de assunto

**Objetivo:** escolher o assunto do duelo (só "Eleições 2026" ativo no lançamento) e entrar no fluxo de 5 escolhas.

```
┌──────────────────────────────┐
│ ◈ PoliMatch            [avatar]│ 59+56
│                              │
│  ELEIÇÕES 2026               │ serif 24/30
│  Colecione. Discuta.         │ corpo 15 mármore
│  Transforme.                 │
│  ┌──────────────────────────┐│
│  │ ELEIÇÕES 2026     ATIVO  ││ 358×140 mármore
│  │ ▓▓▓░░ 0/5 escolhas       ││ borda ouro 1pt
│  │ ┌─┐ ┌─┐ ┌─┐ (mini-cards) ││
│  │ [COMEÇAR DUELO]          ││ pill ouro 52
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ MUNICIPAIS 2028   EM BREVE││ 358×88 dim + cadeado
│  └──────────────────────────┘│
│  Votação lúdica. Não         │ micro 10, branco 50%
└──────────────────────────────┘
```

**Anatomia:** header 56 (diamante 20 + wordmark Inter 800 18; avatar 32 à direita) · título serif 24/30 a 32 pt do topo da área · card de assunto 358×140 (raio 16, mármore `#F7F4EC`, borda ouro 1 pt, sombra suave) · selo "ATIVO" (pill 48×24, fill M600, texto 10 UPPER branco) · progresso do assunto: 5 segmentos 4 pt + "0/5 escolhas" (micro) · mini-cards decorativos 3× 40×60 (silhuetas M500 30%) · CTA "COMEÇAR DUELO" pill 52, gradiente ouro radial + sombra `0 8 24 rgba(212,175,55,.35)` · futuros assuntos 358×88 (raio 12, opacity .45, cadeado 16) · no disclaim micro 10.

**Comportamento:** toque no CTA → fade 200 ms → Tela 2. Assuntos bloqueados mostram tooltip "Em breve". Pull-to-refresh mantém estado do progresso (persistido local).

**Acessibilidade:** card do assunto é grupo navegável; CTA rotulado "Começar duelo em Eleições 2026". Disclaim narrado como nota.

**Responsivo:** hero e card centralizam na coluna; em 320 pt, card de assunto vira 296×160 (empilha mini-cards).

---

### Tela 2 — Duelo

**Objetivo:** apresentar dois candidatos; o voto acontece **tocando no card**; "QUEM É?" abre a ficha sem votar. Dois cards 100% visíveis.

```
┌──────────────────────────────┐
│ ◈ PoliMatch   [ELEIÇÕES 2026] │ 59+56
│ ▓▓░░░ ──────── ESCOLHA 1 DE 5 │ 20
│                              │
│  ┌─────────┐  ◆VS◆  ┌─────────┐│
│  │ ANA     │        │ HENRIQUE││ y150–372
│  │ ★★●     │        │ ★★★●   ││  148×222
│  │▀▀▀▀▀▀▀▀▀│        │▀▀▀▀▀▀▀▀▀││
│  │ ANA V.  │        │ HENR. T.││  placa 54
│  │ BRASIL  │        │ BRASIL  ││
│  └─────────┘        └─────────┘│
│  [ QUEM É? ]        [ QUEM É? ]│ y388–428 (148×56)
│    toque no card para votar    │ hint 11
└──────────────────────────────┘
```

**Anatomia:**
- Header 56: diamante + wordmark (esquerda); chip "ELEIÇÕES 2026" (pill 132×28, borda Ouro 400 40%, texto 10 UPPER Ouro 300) à direita.
- **Progresso de 5 escolhas** (y 115–135): 5 segmentos de 64 × 4 pt, gap 4, raio 2 — concluídos = gradiente ouro; restantes = `rgba(13,92,75,.4)`. À esquerda, "ESCOLHA 1 DE 5" (12/16 Inter 800 UPPER +1, Ouro 400).
- Cards 148×222 (esq. x=16, dir. x=226), centralizados verticalmente no espaço livre (§3).
- **VS:** círculo 44 pt central entre os cards (x = 16+148+9 = 173), texto "VS" Inter 900 14 Ouro 300 com bevel (highlight Ouro 300 no topo), fundo M900, anel 2 pt Ouro 500, glow `0 0 12 rgba(212,175,55,.45)`.
- Botões "QUEM É?" 148×56 (área de toque; visual 40 pt) sob cada card: pill outline ouro 45%, fill M700 40% press, texto 11/16 Inter 800 UPPER Ouro 300.
- Hint central "toque no card para votar" 11/16, branco 50%.

**Comportamento:**
1. Press no card → scale .97 (120 ms) + háptico light. Soltar = **voto** (háptico success).
2. Feedback 300 ms: card votado ganha anel ouro 2 pt + selo check 28 pt (canto superior direito do card, sobre o selo de raridade); oponente dim .30 e recua 8 pt; o VS vira losango solido com check.
3. Transição 500 ms → **Tela 4 (Resultado)**. Não há confirmação extra — tocar no card É votar (gesto primário).
4. "QUEM É?" abre a **Tela 3** como sheet; não vota. O voto pode ser feito de dentro da ficha ("VOTAR NESTE CARD"). Após votar em um confronto, a ficha do outro fica acessível mas sem CTA de voto.
5. Fim da 5ª escolha → Resultado final + Ranking pessoal atualizado; se nova Chroma coletada, dispara a **Tela 8**.

**Acessibilidade:** toque duplo com VoiceOver vota; "QUEM É?" é ação separada. Confronto anunciado: "Duelo 1 de 5: Ana Vilhena, Rara, contra Henrique Tavares, Suprema".

**Responsivo:** cards e VS reescalam juntos (§6); aba Duelo da tab bar tem badge de progresso (losango 5 pt) com 1–5 segmentos.

---

### Tela 3 — Ficha "QUEM É?"

**Objetivo:** conhecer o candidato **sem votar** (ou votar deliberadamente). Sheet de fundo claro com altura 82% (692 pt).

```
┌──────────────────────────────┐ y152 (raio sup. 20)
│ ── (handle 36×4)             │
│ ┌───────────────────────────┐│
│ │ (foto 72) ANA VILHENA     ││ 96 band mármore
│ │           BRASIL · DEMOCRATA││
│ └───────────────────────────┘│
│ BIO (3 parágrafos, 15/22)    │
│ DADOS-CHAVE                  │
│  Partido · Coligação         │ label 10 + valor 15
│  Cidade · Edição             │
│ CITAÇÃO “...”                │ serif 18/26, aspas ouro
│ ATRIBUTOS 78/82/65 (barras)  │ 3 barras 6 pt
│ ┌───────────────────────────┐│
│ │[VOTAR NESTE CARD]         ││ footer fixo 72
│ │  VOLTAR AO DUELO          ││
└──────────────────────────────┘
```

**Anatomia:** backdrop scrim 72% · sheet 692 pt, raio superior 20, fundo Placa `#F7F4EC` · handle 36×4 (tinta 30%) a 8 pt do topo · band 96 pt: foto 72 pt redonda (borda ouro 1 pt), nome serif 24/30, sub 12/16 UPPER (BRASIL · PARTIDO · CARGO) em Ouro 700 · chips de família (COMUM/RARA/CHROMA, 20 pt) · corpo scrollável (margens 16): bio 15/22 tinta 85% (≈ 600 caracteres), seção "DADOS-CHAVE" com 4 linhas (label micro 10 tinta 55% + valor 15/22 Inter 600), citação serif 18/26 com aspas ouro 500 e barra lateral 2 pt ouro, atributos 3 barras horizontais 6 pt (gradiente ouro, valor 12 bold Ouro 700) · footer fixo 72 pt (hairline superior `#E3DCCB`): CTA primário "VOTAR NESTE CARD" pill 52 gradiente ouro + link "VOLTAR AO DUELO" (14/18 Inter 800 UPPER, tinta 70%).

**Comportamento:** swipe down ou tap no backdrop ou Esc fecha (300 ms, ease-out). Conteúdo scrolla sob o footer (footer sempre visível). "VOTAR NESTE CARD" registra o voto e fecha o sheet com o estado de votado da Tela 2, seguindo para a Tela 4. Se o candidato já foi votado, o botão vira "VOTO REGISTRADO" (disabled) e resta só "VOLTAR AO DUELO".

**Acessibilidade:** papel `sheet`, foco preso, anúncio de abertura; rolagem por leitor de tela natural; contraste Ouro 700 sobre Placa ✓.

**Responsivo:** em 320 pt, band colapsa (foto 56, nome 20); footer empilha (CTA 48 + link 16). Em Dynamic Type +200%, conteúdo vira pilha completa.

---

### Tela 4 — Resultado do voto

**Objetivo:** confirmar o voto com recompensa visual e avançar para o próximo confronto.

```
┌──────────────────────────────┐
│   ✦ (raios ouro, girando)    │ fundo M900 + radial ouro 12%
│  ┌────────────────────────┐  │
│  │  VOTO REGISTRADO       │  │ chip 10 UPPER ouro
│  │  ┌──────────────┐      │  │ 180×270 card
│  │  │ ANA (anel    │      │  │ anel ouro 2 + glow
│  │  │      ouro)   │      │  │
│  │  └──────────────┘      │  │
│  │ ANA VILHENA             │  │ serif 24/30
│  │ Ficha adicionada à      │  │ 13 mármore 70%
│  │ coleção · RARA          │  │
│  │ ●●●○○  ESCOLHA 2 DE 5   │  │ 5 dots 8 pt
│  │ [PRÓXIMO DUELO]         │  │ pill ouro 52
│  │     VER FICHA           │  │ link 14
└──────────────────────────────┘
```

**Anatomia:** fundo M900 + radial ouro 12% + 8 raios cônicos (op .15) rodando 24 s · card vencedor 180×270 central (y ~110–380; foto 202 + placa 68 com nome 20/24) com anel ouro 2 pt e glow `0 0 24 rgba(212,175,55,.5)` · chip "VOTO REGISTRADO" (48×24, fill ouro 15%, borda ouro 40%, texto Ouro 300) · nome serif 24/30 branco · linha 13/18 mármore 70%: "Ficha adicionada à coleção · RARA" · **progresso**: 5 dots 8 pt (feitos = gradiente ouro + scale 1.1; próximos = branco 25%) + "ESCOLHA 2 DE 5" (12 UPPER Ouro 400) · CTA "PRÓXIMO DUELO" pill 52 gradiente ouro (háptico light; carrega 300 ms com shimmer) · link "VER FICHA" abre a Tela 3.

**Comportamento:** entra com zoom-in 300 ms do card + confete sutil (6 partículas ouro, 800 ms). CTA avança para a Tela 2 (próxima rodada). Na **5ª escolha**, o CTA vira "VER RESULTADOS" → Ranking pessoal, e se uma nova Chroma foi coletada, a revelação (Tela 8) abre antes. Sem auto-avanço (decisão explícita do usuário).

**Acessibilidade:** live region "Voto registrado em Ana Vilhena"; dots narrados como "escolha 2 de 5".

**Responsivo:** card 180×270 → 150×225 em 320 pt; em 430 pt, 200×300.

---

### Tela 5 — Ranking geral

**Objetivo:** posição de cada candidato por votos da comunidade.

```
┌──────────────────────────────┐
│ RANKING                      │ 20/24 · header gradiente 96
│ ELEIÇÕES 2026                │ 11 UPPER ouro
│ [GERAL ][PESSOAL]            │ segmented 2×171×40
│ ┌──────────────────────────┐ │
│ │ #42  SUA POSIÇÃO  12,4%  │ │ card sua posição 358×72
│ │ ▓▓▓▓▓▓▓░░░░ (barra)      │ │ mármore, raio 16
│ └──────────────────────────┘ │
│      [2º] [1º] [3º]  pódio   │ avatars 56 + medalhas
│ 01 ┌●●┐ NOME         12,4%  │ rows 64, hairline
│ 02  ...
└──────────────────────────────┘
```

**Anatomia:** header 96 (gradiente M900→M800, raio inferior 24): título "RANKING" 20/24 Inter 700 + sub "ELEIÇÕES 2026" 11 UPPER Ouro 400 · **segmented control** 2 segmentos 171×40 (pill 999, ativo = fill ouro + texto tinta 800; inativo = outline branco 30% + texto branco 70%), com "PESSOAL" levando à Tela 6 · card "sua posição" 358×72 (mármore, raio 16, borda ouro 1 pt): "#42" serif 24 (Ouro 700), label micro "SUA POSIÇÃO", barra 6 pt (fill gradiente ouro, w = %) + % 12 bold · **pódio** top 3: avatars 56 círculo (1º borda ouro 2 pt + medalha 18 ouro; 2º prata `#C9CDD4`; 3º bronze `#B07A4A`), nome 12, % 12 bold ourown; 1º elevado 16 pt, entrada stagger 60 ms · **lista** rows 64: rank 16 Inter 800 (top-3 em Ouro 700 com medalha; demais branco 60%), avatar 44 (raio 22, borda raridade 1 pt), nome 15/20 Inter 600, partido 11 branco 55%, barra 4 pt flex + % 12 · hairline `rgba(255,255,255,.12)` · filtro chip "ELEIÇÕES 2026" acima da lista (chip 32) · pull-to-refresh.

**Comportamento:** animação de entrada com stagger 40 ms (pódio → rows); toque na row → ficha resumida (sheet estendido da Tela 3). Atualização ao vivo a cada voto (websocket/refetch), com flash da linha movimentada (fundo ouro 12%, 600 ms).

**Acessibilidade:** tabela semântica (posição, nome, percentual); medalhas têm rótulo textual ("1º lugar, ouro").

**Responsivo:** 430 pt → rows 72; tablet → pódio em coluna esquerda fixa 240 pt + lista à direita.

---

### Tela 6 — Ranking pessoal

**Objetivo:** o progresso do usuário no assunto (5 escolhas), fichas coletadas e posição. Mesmo shell da Tela 5 (header, segmented GERAL|PESSOAL).

```
┌──────────────────────────────┐
│ RANKING · [GERAL][PESSOAL]   │
│ SEU DUELO                    │ seção 14 UPPER
│ (1)(2)(3)(4)(5)              │ 5 circles 36: feito=ouro+✓
│                              │
│ [DUELOS 3/5][FICHAS 12]      │ métricas 2×171×84
│ [% 38,2% ][POSIÇÃO #42 ▲3]   │
│ SUAS FICHAS  →               │ header + ver todas
│ (card)(card)(card)(card)     │ scroll horizontal 84×126
│ COLEÇÃO DO SET: 9/12 ▓▓▓░░  │ barra 4 pt
└──────────────────────────────┘
```

**Anatomia:** seção "SEU DUELO" (14 UPPER Ouro 400) · 5 círculos 36 pt espaçados 8: feito = fill gradiente ouro + check 16 branco; pendente = outline branco 25% com número 12 · **métricas** 2 colunas (171×84, mármore placa, raio 16, gap 16): valor serif 22 + label micro 10 tinta 55% — DUELOS 3/5 · FICHAS 12 · SEU VOTO 38,2% · POSIÇÃO #42 com delta "▲ 3" (12, Sucesso `#3DD68C` para subir) · "SUAS FICHAS": horizontal scroll de mini-cards 84×126 (grid da Coleção, toque abre ficha) + "VER TODAS" (12 UPPER Ouro 700) · barra de set "ELEIÇÕES 2026 — 9/12" (4 pt) · **empty state** (sem votos): diamante ouro 40 central + "NENHUM VOTO AINDA" (16 Inter 700) + "Comece um duelo para desbloquear sua coleção" (13, branco 60%) + CTA pill 48 "COMEÇAR DUELO".

**Comportamento:** atualiza ao voltar do fluxo de duelo (ao vivo); delta anima (slide up + fade). Toque em círculo pendente → retoma o duelo naquela escolha.

**Acessibilidade:** métricas em lista ordenada; deltas narrados ("subiu 3 posições").

**Responsivo:** métricas viram pilha em 320 pt (cards 296×72); "SUAS FICHAS" mantém scroll horizontal.

---

### Tela 7 — Coleção

**Objetivo:** exibir as fichas coletadas (votadas, conquistadas em Chroma) com slots bloqueados.

```
┌──────────────────────────────┐
│ COLEÇÃO              12/20   │ 20/24 · contador serif
│ ▓▓▓▓▓▓▓▓▓░░  ELEIÇÕES 2026  │ 4 pt set
│ [TODAS][COMUM][RARA][CHROMA] │ chips 32, scroll h
│ RARA (4)                     │ seção sticky 12 UPPER
│ ┌──┐┌──┐┌──┐                │ 3 col, cards 108×162
│ │  ││  ││  │                │ gap 8
│ └──┘└──┘└──┘                │
│ COMUM (3)                    │
│ ┌──┐┌──┐┌──┐┌──┐┌┐??│        │ bloqueado: ? ◆
└──────────────────────────────┘
```

**Anatomia:** header 56: título "COLEÇÃO" 20/24 + contador serif 24 "**12**/20" (numerador branco, denominador 50%) · progresso do set 4 pt (gradiente ouro) + label micro "ELEIÇÕES 2026" · **filtros**: chips 32 (pill, UPPER micro): TODAS · COMUM · RARA · CHROMA — ativo = fill ouro, texto tinta; inativo = outline branco 30% · **grid 3 colunas**: card 108×162 (margem 16, gap 8; largura fluida `(W−32−16)/3`): anatomia reduzida (§3) — foto, moldura por tier, selo 18 (estrela 8), placa 40 (nome 11/14, sub 6.5/8) · **sessões por família** quando filtro TODAS (headers sticky 36, 12 UPPER Ouro 400, fundo M900 blur 90%) · **bloqueado**: fundo M800 com textura facetada (padrão de losangos 5%), diamante 24 Ouro 500 + "???" 10 UPPER, sem foto; slot revela ao votar no candidato ou ao coletar Chroma · contador de raridade na seção "RARA (4)".

**Comportamento:** entrada com flip frontal (500 ms, stagger 40 ms por linha). Toque em card aberto → sheet de detalhe (ficha resumida + "SOBRE ESTA EDIÇÃO": edição MALAQUITA 2026, número `014/250`, tier) · toque em bloqueado → tooltip "Vote no duelo para desbloquear" (com opção "IR PARA O DUELO"). Filtros animam 200 ms; ordenação fixa por raridade (§2).

**Acessibilidade:** grade como lista; bloqueado = "trava" + instrução; selo de raridade narrado em texto.

**Responsivo:** 320 pt → 2 colunas (138×207); 430 pt → 3 colunas com 118×177; Dynamic Type → nome do card até 2 linhas com ellipsis.

---

### Tela 8 — Revelação de Chroma

**Objetivo:** celebrar a conquista rara — momento premium, sem tab bar, imersivo.

```
┌──────────────────────────────┐
│    ✦ ✦ ✦ (partículas ouro)   │ fundo M900 + radial prisma
│    (raios cônicos girando)   │ 12 partículas, 6 s loop
│ ┌──────────────────────────┐ │
│ │        (verso)           │ │ card 190×285 sólido
│ │      ◆ POLIMATCH         │ │ flip 900 ms →
│ │         (frente)         │ │ prisma anima 6 s
│ └──────────────────────────┘ │
│ nova chroma · eleições 2026  │ chip 10 UPPER ouro
│ ANA VILHENA                  │ serif 28/34
│ CHROMA COMEMORATIVA          │ 12 UPPER ouro 400
│ Uma homenagem a quem         │ 15/22 mármore 80%
│ inspira novos futuros.       │
│ [ADICIONAR À COLEÇÃO]        │ pill ouro 52
│    VER NA COLEÇÃO            │ ghost
└──────────────────────────────┘
```

**Anatomia:** fundo M900 + radial prisma 20% (paradas §1.2) + 12 partículas ouro 4 pt (drift 6 s) + 8 raios cônicos (op .15, rotação 24 s) · card 190×285 central (y ~90–375): **verso** = M700 com textura facetada + diamante 40 + "POLIMATCH" 10 track +2 · **frente** = arte completa do tier (placa 60 com nome 20/24 serif e tier 8 UPPER) · **flip**: rotateY 0→180 em 900 ms ease-out com spring de escala .85→1.02→1 (reduced motion: fade 300 ms) · após a virada, a borda prisma anima (posição do gradiente, loop 6 s) · chip "NOVA CHROMA · ELEIÇÕES 2026" (48×24, fill prisma 20%, texto Ouro 300) · nome serif 28/34 · tier "CHROMA COMEMORATIVA" 12 UPPER Ouro 400 · descrição 15/22 mármore 80% ("Uma homenagem a quem inspira novos futuros.") · CTA "ADICIONAR À COLEÇÃO" pill 52 gradiente ouro; ghost "VER NA COLEÇÃO" → vai à Tela 7 com o card em destaque; primário → confirmação 300 ms (check 28 no botão) e retorna ao fluxo.

**Comportamento:** dispara ao completar o set de 5 escolhas com Chroma nova coletada (fim da Tela 4 n.5). Sem tab bar; sem gesto de voltar (decisão explícita via CTA). Elementos entram em cascade (partículas 0 ms, verso 200 ms, chip 1100 ms, textos 1300 ms, CTA 1500 ms). Háptico success + notification.

**Acessibilidade:** live region anuncia tier e nome; sem dependência do efeito visual; reduced motion = fallback com fade; texto descritivo garante o storytelling.

**Responsivo:** card 190×285 → 150×225 em 320 pt; em 430 pt, 210×315.

---

## 9. Fluxo mestre do duelo

```
Escolha de assunto (T1)
  → Duelo rodada 1..5 (T2)
      ├─ tap no card → Resultado (T4) → PRÓXIMO DUELO → T2 (n+1)
      ├─ QUEM É? → Ficha (T3) → VOLTAR / VOTAR NESTE CARD → T4
      └─ após 5ª → [VER RESULTADOS] → T6
  → Chroma nova? → Revelação (T8) → ADICIONAR → T7 / VER NA COLEÇÃO → T7
```

Transições: T1→T2 fade 200 · T2→T4 zoom 300 · T4→T2 slide-up dos novos cards 500 · T2→T3 sheet 300 · T3→T4 sheet fecha 200 + zoom 300 · T4→T6 slide 300 · T6⇄T7 via tab · T8 cascade.

---

## 10. Microcopy (pt-BR, caixa alta em rótulos)

| Contexto | Texto |
|---|---|
| Header duelo | ESCOLHA 1 DE 5 · chip ELEIÇÕES 2026 |
| Hint duelo | toque no card para votar |
| Botões ficha | VOTAR NESTE CARD · VOLTAR AO DUELO |
| Resultado | VOTO REGISTRADO · Ficha adicionada à coleção · PRÓXIMO DUELO · VER FICHA · VER RESULTADOS |
| Ranking | SUA POSIÇÃO · ELEIÇÕES 2026 · GERAL / PESSOAL |
| Pessoal | SEU DUELO · DUELOS · FICHAS · SEU VOTO · POSIÇÃO · SUAS FICHAS · COLEÇÃO DO SET · NENHUM VOTO AINDA · Comece um duelo para desbloquear sua coleção |
| Coleção | COLEÇÃO · TODAS · COMUM · RARA · CHROMA · SOBRE ESTA EDIÇÃO · Vote no duelo para desbloquear · IR PARA O DUELO |
| Chroma | NOVA CHROMA · ADICIONAR À COLEÇÃO · VER NA COLEÇÃO |
| Legal (persistente, micro) | Votação lúdica. Não constitui pesquisa eleitoral. |
| Estados | EM BREVE · ATIVO · VOTO REGISTRADO · 1/5 · ▲ 3 |

Tom: institucional premium, frases curtas, imperativo nos CTAs. Nunca gírias, nunca emojis.

---

## 11. Checklist de aceite

- [ ] Contexto: dois cards inteiros + VS visíveis sem scroll em 320/375/390/430.
- [ ] Voto = toque direto no card (sem tela intermediária); háptico + feedback 300 ms.
- [ ] "QUEM É?" nunca vota; sempre acessível dentro e fora da ficha.
- [ ] Progresso de 5 escolhas visível em toda a Tela 2 e 4 (segmentos/dots + "N DE 5").
- [ ] Raridades com estrelas + texto + cor (nunca cor sozinha); 9 tiers ordenáveis.
- [ ] Placa clara com nome/sub/stats; moldura facetada em todos os tiers; foto dominante ≥ 73%.
- [ ] Cores conforme §1.2; contraste AA; alvos ≥ 48; Dynamic Type +200%; reduced motion.
- [ ] Tab bar DUELOS/RANKING/COLEÇÃO em todas as telas-pilha (exceto sheet e Chroma).
- [ ] Chroma prisma animada apenas em COMEMORATIVA e detalhes de celebração (nunca em UI de apoio).
- [ ] Assunto "Eleições 2026" com nota legal persistente.
- [ ] Empty/loading/error states especificados em Ranking e Coleção (skeleton mármore, shimmer ouro).