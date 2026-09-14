# Auditoria das 125 fotos tratadas

## Resultado

O pacote está tecnicamente íntegro, mas ainda não está integralmente aprovado para publicação.

- 125 masters PNG em 1200×1500.
- 125 derivados JPG em 1200×1500.
- Nenhum arquivo ilegível ou duplicata binária entre os JPGs.
- 5 pranchas de conferência presentes.
- 82 fotos sem marcação editorial, técnica ou de licença foram liberadas para a prévia do app.
- 43 fotos permanecem em fallback até a correção ou liberação.

## Pendências do relatório recebido

- 17 registros têm `revisao_manual`.
- 20 registros têm `flag_tecnica`.
- 19 registros têm `flag_licenca`.

Bloqueios inequívocos:

- `055-carmen-lucia`: a própria revisão informa que a pessoa retratada está errada.
- `097-camilo-santana`: a própria revisão informa que a pessoa retratada está errada.
- `068-antonio-rueda`: uso restrito e dependente de autorização.

Outros registros marcados continuam fora da publicação até revisão humana, substituição da fonte de baixa resolução ou confirmação de licença. O app não tenta carregar esses arquivos e conserva o fallback com iniciais.

## Decisão de integração

As imagens são apresentadas como cartas padrão, sem Chroma. O nome do arquivo público usa apenas o identificador numérico (`/portraits/NNN.jpg`), e uma lista explícita no frontend impede a publicação acidental dos registros ainda bloqueados.
