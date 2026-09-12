# Presidência Duelo 2026

Jogo web casual estilo **Facemash**: dois candidatos à Presidência do Brasil (2026) lado a lado; você escolhe um; surge o próximo par aleatório; o ranking Elo fica salvo no `localStorage` do navegador.

> **Não é pesquisa oficial.** Não mede intenção de voto real. É só entretenimento.

## Como abrir

1. Abra o arquivo `index.html` no navegador (duplo clique ou “Abrir arquivo”).
2. Funciona **offline** depois que as fotos em `candidates/` já estão no disco.
3. Opcional (servidor local):

```bash
cd /workspace/presidencia-duelo
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

## Funcionalidades

- UI em **português**, mobile-first
- Cards com visual inspirado em cromos / Pokémon
- 12 chapas (presidente + vice)
- Dois modos: duelo de **presidentes** e duelo de **vices**, com rankings separados
- Ranking **Elo** + taxa de vitórias
- **Raridade de cromo** por Elo: Comum, Raro, Épico e Lendário
- Efeito **holográfico** nos cards Épico e Lendário
- Dados só no seu aparelho (botão para zerar)

## Modos de duelo

O seletor **Duelando: Presidentes / Vices** troca quem entra em campo. Cada
modo tem seu próprio Elo, suas próprias vitórias e seu próprio contador de
duelos, então votar num vice não mexe no ranking dos presidentes. O botão
**Zerar ranking** limpa só o modo aberto no momento.

Os vices ainda não têm foto: cada card usa as iniciais sobre uma cor própria,
gerada a partir da posição na lista para que as doze fiquem bem distintas.
Para dar rosto a um vice, basta colocar a imagem em `candidates/`, apontar o
campo `photo` dele em `app.js` e registrar o crédito em `CREDITS.md`.

## Raridade dos cards

A raridade sai só de dados do próprio jogo (Elo e número de duelos). Nenhum
atributo político entra na conta.

| Raridade | Elo | Visual |
|---|---|---|
| Comum | abaixo de 1040 | moldura cinza |
| Raro | 1040 a 1099 | moldura azul |
| Épico | 1100 a 1179 | moldura roxa + foil holográfico |
| Lendário | 1180 ou mais | moldura dourada + foil + aura pulsante |

O líder isolado da tabela também recebe Lendário e a coroa (♛), desde que
tenha ao menos 6 duelos e Elo acima dos 1000 iniciais. Empate no topo não
coroa ninguém.

O foil holográfico acompanha o ponteiro do mouse e, em celulares Android,
o giroscópio. No iOS o sensor exige uma permissão explícita, então o card
usa apenas a varredura animada. Quem ativa `prefers-reduced-motion` no
sistema vê os cards sem animação.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `index.html` | Página principal |
| `styles.css` | Estilos |
| `app.js` | Lógica do duelo e Elo |
| `candidates/` | Fotos públicas baixadas |
| `CREDITS.md` | Atribuição das imagens |

## Candidatos incluídos

1. Lula (PT) — Geraldo Alckmin (PSB)
2. Flávio Bolsonaro (PL) — Alfredo Gaspar (PL)
3. Ronaldo Caiado (PSD) — Gilberto Kassab (PSD)
4. Romeu Zema (Novo) — Eduardo Girão (Novo)
5. Renan Santos (Missão) — Aroldo Medina (Missão)
6. Augusto Cury (Avante) — Júlio Delgado (Avante)
7. Rui Costa Pimenta (PCO) — Antônio Carlos (PCO)
8. Samara Martins (UP) — Raquel Brício (UP)
9. Hertz Dias (PSTU) — Vanessa Portugal (PSTU)
10. Edmilson Costa (PCB) — Cleusa Santos (PCB)
11. Wilson Grassi (Democrata) — Suêd Haidar (Democrata)
12. Clariana Barão (DC) — Fabiana Torquato (DC)

Pablo Marçal **não** está na lista.

## Privacidade

Nenhum servidor recebe seus votos. Tudo fica em `localStorage` (`presidencia-duelo-v1`).

## Licença do código

Código deste jogo: use livremente. Fotos: veja `CREDITS.md` (licenças CC / Attribution).

