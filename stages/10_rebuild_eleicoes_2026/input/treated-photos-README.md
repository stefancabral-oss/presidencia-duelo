# PoliMatch — fotos tratadas (125)

Padrão aplicado a todas (somente correção fotográfica; rosto, cabelo, roupa e expressão intactos):
- recorte 4:5 (1200×1500) com rosto a ~36% do topo, altura do rosto ≈ 30% do quadro (ombros para cima)
- recorte de fundo por segmentação de pessoa (u2net_human_seg) + limpeza de elementos soltos
- fundo malaquita em degradê radial (#165E46 → #051E16), grão fino, sombra suave do sujeito
- luz dourada de contorno (#E2B84A) vinda do alto-direita
- exposição/contraste normalizados por percentis, saturação −8%, balanço de branco levemente quente, altas luzes douradas e sombras esverdeadas
- fade inferior nos últimos 14% para esconder o corte da foto original

Arquivos: `NNN_nome.png` (master) e `jpg/NNN_nome.jpg` (q90, leve).
`_relatorio.csv`: fonte usada, tamanho do rosto, flags técnicas, licença do catálogo e coluna `revisao_manual`.
`_prancha_01..05.jpg`: pranchas de conferência.

Numeração segue o pacote de fotos (001–125). O documento de prompts usa 000–124: id_foto = id_prompt + 1.
