# PoliMatch — Design Validator

Issue: #103

Este documento é um gate obrigatório. CI verde sozinho não aprova UI.

## Referência visual

A direção aprovada é:

- shell claro / porcelana;
- malaquita estrutural;
- ouro restrito;
- Chromas concentram cor, foil e brilho;
- cartas verticais com proporção TCG, próximas das referências de cards colecionáveis;
- foto dominante;
- informação legível dentro da carta;
- experiência mobile-first.

## Critérios bloqueantes

### Estrutura

- [ ] Duelo não pode ser apenas o shell antigo com CSS novo.
- [ ] Navegação principal precisa ter anatomia nova e consistente.
- [ ] O card deve ser um componente estrutural novo, não o `.poke-card` antigo maquiado.
- [ ] Nenhum modal de conquista pode ocupar o centro da tela durante o Duelo.

### Cards

- [ ] Proporção vertical TCG.
- [ ] Duas cartas ficam empilhadas e legíveis em iPhone; no desktop, permanecem lado a lado.
- [ ] Imagem ocupa aproximadamente 60–70% da carta.
- [ ] Espaço interno para nome, papel/cargo, resumo e meta.
- [ ] Ícones e badges não competem com o rosto.
- [ ] Não existe botão separado “Escolher”. O card inteiro é a ação.
- [ ] A ficha abre ao segurar; a dica fica dentro da placa e nenhum botão externo rouba foco.

### Hierarquia

- [ ] `VS` é pequeno e secundário.
- [ ] `Pular` é discreto.
- [ ] Progresso/meta ocupam pouco espaço vertical.
- [ ] Um único CTA dominante por área.
- [ ] Ouro não aparece em todos os componentes simultaneamente.

### Chroma

- [ ] Regular é visualmente silencioso.
- [ ] Chroma é claramente mais especial.
- [ ] Suprema usa 3 estrelas douradas.
- [ ] Comemorativa usa estrela prismática/colorida.
- [ ] O shell não compete com o acabamento das Chromas.

### Mobile

- [ ] Viewport de referência: 390×844.
- [ ] Nenhum overflow horizontal.
- [ ] Nenhum controle crítico fica atrás da barra do Safari.
- [ ] Texto essencial permanece legível sem zoom.
- [ ] Cards não viram miniaturas comprimidas.

### Feedback

- [ ] Estados de pending/success/error são discretos e claros.
- [ ] Reduced motion é respeitado.
- [ ] Som/haptic serão plugados por estado de jogo, não por identidade política.

## Critérios automáticos mínimos

Os testes devem falhar se:

- o Duelo voltar a depender de botão textual “Escolher”;
- o novo shell não possuir estrutura própria;
- o card novo não possuir `aspect-ratio` vertical;
- o modal de meta voltar a ser um bloco central dominante;
- o viewport mobile perder suporte a safe-area;
- o CSS novo depender de seletores de override sobre `.poke-card` como arquitetura principal.

## Human gate

Antes de mergear qualquer reconstrução do Duelo:

1. gerar screenshot em viewport 390×844;
2. comparar com este checklist;
3. registrar PASS/FAIL por critério;
4. só então permitir merge.
