# [ICM 04] Som, haptics e engagement

## Objetivo

Usar áudio, haptics e microfeedback para deixar a experiência viva e estimular continuidade de uso sem favorecer candidato específico.

## Eventos mínimos

- tap;
- escolha de carta;
- troca de aba;
- abrir/fechar modal;
- sucesso;
- erro;
- combo;
- zebra;
- Chroma/recompensa rara;
- ultrapassagem;
- entrada no Top 10/Top 3/liderança;
- defesa de liderança;
- recuperação do último colocado/saída da lanterna.
- subida de faixa de Elo;
- queda de faixa de Elo;
- entrada na faixa mais baixa de Elo.

## Regras de neutralidade

- O mesmo estado de jogo gera o mesmo tipo de feedback para qualquer pessoa.
- Sons não podem sugerir aprovação ideológica ou moral de um candidato.
- Feedback de lanterna comunica recuperação e impacto do voto, não julgamento da pessoa.
- Feedback do líder comunica defesa de posição, não superioridade política.

## UX de áudio

- Sons curtos, graves e táteis, sem estética infantil, de cassino ou de arcade.
- Impacto baixo, atrito de carta e brilho metálico discreto formam a linguagem material.
- Humor leve pode acompanhar subida, queda e ultrapassagem, sem ridicularizar a pessoa pública.
- Toggle global de som persistente.
- Respeitar autoplay/restrições do navegador.
- Preferência por Web Audio/API ou arquivos pequenos e pré-carregados.
- Haptics apenas como enhancement quando suportados.

## Critérios de aceite

- Som pode ser totalmente desligado.
- Nenhuma interação crítica depende de áudio.
- Não há sobreposição caótica de sons em cliques rápidos.
- Eventos raros têm assinatura mais marcante que taps comuns.
- Vitória e derrota ficam legíveis nas próprias cartas com deltas reais de Elo.
- Transições de faixa têm respostas diferentes para subida, queda e Elo baixo.
