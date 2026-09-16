# Guia de arte neutra para as cartas

Versão: `pilot-1`  
Issue: [#176](https://github.com/stefancabral-oss/presidencia-duelo/issues/176)

## Finalidade

A arte da carta serve ao jogo. Ela deve tornar a pessoa reconhecível em tamanho pequeno sem funcionar como elogio, crítica ou caricatura. A fotografia documental continua sendo um ativo separado, reservado ao perfil e acompanhada de fonte, crédito e licença.

Este guia cobre somente o piloto de oito retratos. Nenhuma imagem do piloto entra no catálogo público antes do teste cego e do gate humano.

## Gramática visual invariável

- Proporção 4:5, retrato do tórax para cima, cabeça inteira e margens iguais.
- Câmera na altura dos olhos e rosto em três quartos suave, voltado 15 graus para a direita da pessoa.
- Olhar para a câmera, boca fechada, expressão atenta e neutra.
- Luz principal ampla no alto à esquerda da câmera, preenchimento uniforme e contraste moderado.
- Fundo malaquita escuro uniforme (`#103f36`), sem bandeira, arquitetura, multidão, slogan, número, brasão ou símbolo partidário.
- Roupa civil lisa em carvão ou malaquita muito escura, sem gravata, joias chamativas, uniforme, insígnia ou cor de campanha.
- Realismo editorial com linha fina inspirada em gravura de cédula: textura controlada, poros e idade preservados, sem embelezamento, dramatização ou traço cômico.
- Mesma nitidez, saturação, contraste, tamanho de cabeça e quantidade de detalhe para todas as pessoas.
- Nenhum texto, logotipo, moldura, estrela, raridade, brilho Chroma ou marca d'água. Moldura e placa pertencem à interface.

## Identidade e dignidade

- A referência fotográfica é usada apenas para semelhança facial: formato do rosto, olhos, nariz, boca, cabelo e sinais distintivos permanentes.
- A pose, expressão, roupa, luz e fundo da referência não são copiados.
- Não afinar, rejuvenescer, embranquecer, escurecer, masculinizar, feminilizar ou alterar traços étnicos.
- Óculos de uso recorrente podem permanecer; chapéus, camisetas de seleção, cocares, adereços cerimoniais e símbolos religiosos ou políticos não entram no piloto uniforme.
- Deficiência, cicatriz ou traço permanente não é apagado nem enfatizado.
- A mesma instrução e o mesmo processo de revisão valem para todas as posições políticas e níveis de fama.

## Restrições de neutralidade

É proibido:

- sorriso aberto, carranca, olhar heroico, olhar abatido ou pose de confronto;
- ângulo baixo ou alto, contraluz, halo, fumaça, raios, palco ou iluminação cinematográfica;
- cores associadas a partido, campanha, seleção nacional ou movimento social;
- objetos de poder, dinheiro, arma, faixa presidencial, microfone ou plenário;
- exagero de maxilar, dentes, rugas, peso, cabelo, orelhas ou expressão;
- corrigir uma pessoa de modo mais favorável que outra.

## Especificação do arquivo piloto

- Fonte de geração: ferramenta de imagem integrada, com uma referência local de identidade por pessoa.
- Saída mestre: PNG ou WebP em retrato 4:5, sem transparência.
- Arquivos: `app/public/card-art/pilot/<personId>-<slug>-pilot-v1.png`.
- Estado editorial: `pilot`, nunca `approved`.
- Proveniência obrigatória: referência usada, prompt, data, ferramenta e resultado do teste humano.

## Regra de aprovação

Uma arte só pode mudar de `pilot` para `approved` depois de:

1. reconhecimento cego individual de pelo menos 70%;
2. ausência de sinal consistente de favorecimento ou prejuízo no teste de neutralidade;
3. revisão de identidade e dignidade por uma pessoa responsável registrada;
4. decisão humana explícita de seguir com a linguagem visual.

Falha de qualquer pessoa do lote interrompe a escala. O piloto é corrigido e testado novamente; não se reduz o limiar para acomodar o resultado.
