# Guia de arte neutra para as cartas

Versão: `pilot-2`
Issue: [#176](https://github.com/stefancabral-oss/presidencia-duelo/issues/176)

## Finalidade

A arte da carta serve ao jogo. Ela deve tornar a pessoa reconhecível em tamanho pequeno sem funcionar como elogio, crítica ou caricatura. A fotografia documental continua sendo um ativo separado, reservado ao perfil e acompanhada de fonte, crédito e licença.

Este guia cobre somente o piloto de oito retratos sintéticos. A versão `pilot-2` é a especificação prévia para uma **nova geração**. Nenhuma imagem entra no catálogo público antes do teste cego, das revisões de identidade e dignidade, da regularização de proveniência e do gate humano.

## Não conformidade do primeiro lote

A versão `pilot-1` foi registrada antes da primeira geração e exigia fundo malaquita uniforme. As imagens P01–P08 foram geradas com gradiente. Depois de observar esse resultado, o texto foi alterado para `pilot-2` e passou a admitir um gradiente radial controlado.

Essa alteração posterior não valida retroativamente o lote. P01–P08 ficam preservadas apenas como evidência de não conformidade, com coleta humana e decisão `seguir` bloqueadas. O próximo lote deve ser gerado do zero sob esta versão já registrada; somente ele poderá avançar ao teste cego.

## Gramática visual invariável

- Proporção 4:5, retrato do tórax para cima, cabeça inteira e margens iguais.
- Câmera na altura dos olhos e rosto em três quartos suave, voltado 15 graus para a direita da pessoa.
- Olhar para a câmera, boca fechada, expressão atenta e neutra.
- Luz principal ampla no alto à esquerda da câmera, preenchimento uniforme e contraste moderado.
- Fundo malaquita escuro, sem bandeira, arquitetura, multidão, slogan, número, brasão ou símbolo partidário. `pilot-2` admite um gradiente radial discreto, mais claro atrás da cabeça e mais escuro nas bordas, desde que direção, intensidade e contraste permaneçam equivalentes em todas as pessoas. `#103f36` é referência cromática, não promessa de cor chapada pixel a pixel.
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

## Natureza sintética e disclosure

- A saída é uma imagem sintética com aparência fotográfica, gerada por IA a partir de referência de identidade; não é fotografia documental nem registro de um encontro, roupa ou pose reais.
- Em teste cego, o disclosure aparece depois da última resposta para não influenciar reconhecimento ou neutralidade.
- Em qualquer uso editorial futuro, `Retrato sintético gerado por IA` deve aparecer junto da imagem e a fotografia documental deve continuar separada no perfil.
- Não descrever a saída como `foto`, não atribuir a pose ao retratado e não usar a arte como prova de fato biográfico.

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
- Arquivos cegos: `stages/12_quality_gate_main/evidence/card-art-pilot-176/P01.png` a `P08.png`.
- Armazenamento: evidência de teste fora de `app/public`; o build deve falhar se qualquer hash do lote aparecer em `app/dist`.
- Estado editorial do primeiro lote: `pilot-invalidated-regeneration-required`, nunca `approved` e nunca apto a coleta.
- Estado editorial de uma futura regeneração: `pilot`, ainda não `approved`.
- Proveniência obrigatória: SHA-256 da arte e da referência, caminho exato da referência, prompt, data, ferramenta, fonte fotográfica, autoria e licença quando documentadas.
- `license-pending` é obrigatório quando origem fotográfica, autoria ou licença do arquivo efetivamente usado não estiverem documentadas. Uma ficha editorial de outra fotografia da mesma pessoa não sana essa lacuna.

## Regra de aprovação

Uma arte só pode mudar de `pilot` para `approved` depois de:

1. reconhecimento cego individual de pelo menos 70%;
2. ausência de sinal consistente de favorecimento ou prejuízo no teste de neutralidade;
3. revisão de identidade e dignidade por uma pessoa responsável registrada;
4. licença documentada para todas as referências efetivamente usadas;
5. decisão humana explícita, datada e assinada de seguir com a linguagem visual.

Falha de qualquer pessoa do lote interrompe a escala. O piloto é corrigido e testado novamente; não se reduz o limiar para acomodar o resultado.
