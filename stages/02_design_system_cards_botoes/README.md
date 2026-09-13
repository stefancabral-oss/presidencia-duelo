# ICM 02 — Design system, cards e botões

Issue principal: #84

## Estado

Em execução.

## Primeira fatia implementada

- `front/src/design-system.css` com tokens claros/porcelana, malaquita, ouro e Chromas.
- Sistema base de botões PoliMatch (`primary`, `secondary`, `ghost`, `icon`, `danger`).
- Topic chip reutilizável.
- Card TCG vertical compartilhável por duelo/coleção.
- Anatomia do card com slots para:
  - marca;
  - raridade;
  - foto/arte;
  - nome;
  - quem é/cargo;
  - descrição curta;
  - meta/partido.
- Estados visuais de raridade, incluindo Chroma, Suprema e Comemorativa.
- `reduced-motion` contemplado.
- PWA e front carregam o design system por último na cascata.

## Importante

Os dados editoriais (`role`, `summary`, etc.) não serão inventados no componente. A modelagem e cobertura dos textos ficou separada na Issue #93.

## Próximos passos dentro do ICM 02

1. Criar playground visual dos componentes (#98).
2. Ajustar proporções com viewport real.
3. Migrar botões existentes gradualmente para classes do novo sistema.
4. Validar card regular vs Chroma/Suprema/Comemorativa.
5. Reduzir dependência de CSS legado (#99).
6. Preencher HANDOFF/verification e levar para human gate.
