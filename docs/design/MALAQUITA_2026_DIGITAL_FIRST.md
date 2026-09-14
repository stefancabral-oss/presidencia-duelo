# PoliMatch — Malaquita 2026 / Digital First

## Objetivo

Transformar o PoliMatch de uma interface funcional de votação em um produto visual proprietário, premium, colecionável e legível em mobile.

## Princípios

- A pessoa é o conteúdo principal da carta.
- A fotografia ocupa aproximadamente 60–68% da leitura visual.
- Nome, partido ou área, função atual e resumo curto permanecem dentro da placa da carta; biografia e fontes ficam na ficha completa.
- O painel inferior usa porcelana clara para nome e identificação.
- Malaquita escura é a base; ouro é usado apenas como metal/acento.
- A progressão de raridade cresce sem alterar a anatomia central da carta.
- O movimento entrega energia de jogo; a carta parada permanece sofisticada.

## Famílias públicas

### Comum
- Básica — `●`
- Incomum — `◆`

### Rara
- Rara — `★`
- Rara dupla — `★★`
- Ultra — `✦`

### Chroma
- Chroma ilustrada — `★`
- Chroma especial — `★★`
- Chroma suprema — `★★★` em ouro
- Chroma comemorativa — `★` prismática/colorida

A interface pode mostrar as nove gradações, mas a comunicação de onboarding deve priorizar as três famílias: **Comum, Rara e Chroma**.

## Chroma comemorativa

É o degrau visual posterior à Chroma suprema de três estrelas douradas.

Regras:
- uma única estrela prismática/colorida;
- moldura iridescente;
- tratamento visual comemorativo;
- linguagem ilustrativa como direção final de arte;
- toda Chroma parte de uma fotografia diferente da carta básica: nova pose, novo enquadramento ou outro momento verificável da pessoa;
- tratamento, fundo ou filtro sobre a mesma fotografia da carta básica é apenas estudo visual e nunca pode entrar no inventário;
- a origem distinta precisa estar registrada e aprovada antes de sorteio, compra ou equipamento da Chroma.

## Fotografia

O sistema utiliza os arquivos já cadastrados no catálogo do repositório. Nenhuma duplicação de cadastro é necessária. `candidate.photo` continua sendo a fonte da imagem e recebe o tratamento correspondente à raridade apenas na apresentação.

## Mobile first

No duelo, a ordem de importância é:

1. rosto;
2. nome;
3. raridade;
4. função e resumo curto;
5. dica para abrir a ficha completa.

Vice, Elo detalhado, taxa de vitória e demais informações ficam fora da área principal da carta e podem continuar acessíveis pela ficha/ranking.

## Cores-base

- Malaquita profunda: `#061A14`
- Malaquita: `#0B3325`
- Ouro: `#D8B85A`
- Ouro escuro: `#9F7D2F`
- Porcelana: `#F3F1E9`
- Texto claro: `#F6F5EF`

## Implementação

A primeira implementação fica isolada na branch `design/malaquita-digital-first` e não deve ser enviada para produção antes de revisão visual em dispositivo real.
