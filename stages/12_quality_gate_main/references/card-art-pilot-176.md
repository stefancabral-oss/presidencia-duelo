# Protocolo do teste dos oito — Issue #176

Versão: `card-art-pilot-176-v2`
Estado: `lote de evidência gerado; teste humano externo pendente`

## Hipótese

Uma arte editorial uniforme e não caricatural consegue manter reconhecimento suficiente até na cauda do catálogo, no recorte e no tamanho em que a pessoa realmente aparece no jogo, sem comunicar favorecimento político.

## Lote e cegamento

| pessoa | personId | papel no teste |
|---|---:|---|
| Luiz Inácio Lula da Silva | 001 | reconhecimento nacional muito alto |
| Jair Bolsonaro | 063 | reconhecimento nacional muito alto |
| Marina Silva | 033 | reconhecimento nacional alto |
| Michelle Bolsonaro | 028 | reconhecimento nacional médio/alto |
| Tabata Amaral | 084 | reconhecimento político médio |
| Sônia Guajajara | 052 | reconhecimento político médio |
| João Campos | 017 | reconhecimento regional/médio |
| Douglas Ruas | 019 | cauda regional; teste mais difícil |

O lote equilibra quatro mulheres e quatro homens e inclui diferentes regiões, idades, tons de pele, tipos de cabelo, níveis de fama e posições no debate público. Essas categorias orientam a cobertura; não são rótulos exibidos no produto.

Os arquivos entregues ao formulário chamam-se somente `P01.png` a `P08.png`. A relação entre código e pessoa fica no manifesto de evidência, que o aplicador não deve entregar nem mostrar ao participante. O formulário embaralha os oito códigos em cada execução e nunca contém nomes de pessoa em caminhos, texto alternativo ou ordem fixa.

## Cenários efetivos de carta

Cada pessoa vê o lote inteiro uma única vez, em apenas um cenário. O aplicador balanceia os grupos usando o parâmetro `scenario` do formulário:

- `?scenario=mobile-390x844`: simula o breakpoint de 390 × 844 CSS px, carta de 184,5 × 246 px, imagem efetivamente visível de 168,5 × 230 px, `object-fit: cover`, topo central e placa sobre os 76 px inferiores;
- `?scenario=desktop-1000x800`: simula o início desktop de 1000 × 800 CSS px, carta de 226 × 316,4 px e imagem efetivamente visível de 204 × 187,4 px, `object-fit: cover` e topo central.

O modo sem parâmetro sorteia um cenário e serve apenas para inspeção. Na coleta oficial, o aplicador deve usar o parâmetro explícito para fechar exatamente os dois estratos. O formulário não apresenta o PNG em 28 rem nem em resolução mestre.

Se a anatomia de carta da #165 ou os breakpoints da #168 mudarem essas medidas antes do teste, este protocolo e o formulário precisam ser atualizados antes de recrutar participantes.

## Participantes

- Mínimo total: 40 adultos que não participaram da geração, curadoria nem revisão das imagens.
- Mínimo por cenário: 20 em `mobile-390x844` e 20 em `desktop-1000x800`.
- Recrutar pessoas de macrorregiões e níveis de familiaridade política variados.
- Não informar quais nomes aparecem antes do teste.
- Não mostrar fotografia de referência, manifesto nem mapeamento dos códigos.

## Execução cega

1. Abrir o formulário com o parâmetro do cenário designado ao participante.
2. Entregar o dispositivo sem DevTools, explorador de arquivos ou manifesto abertos.
3. Para cada arte, perguntar em campo livre `Quem é esta pessoa?`.
4. Depois da resposta, perguntar se a imagem `favorece`, trata de forma `neutra` ou `prejudica` a pessoa.
5. Não corrigir respostas e não permitir voltar para rever imagens anteriores.
6. Somente depois da oitava imagem, mostrar o disclosure de retrato sintético e coletar familiaridade ampla e macrorregião.
7. Salvar o JSON local. O formulário não envia dados a servidor algum.

## Privacidade e estratos

- Não coletar nome, e-mail, cidade, estado, IP, organização ou texto livre sobre o participante.
- Familiaridade usa somente `baixa`, `média`, `alta` ou `prefiro não informar`.
- Região usa somente as cinco macrorregiões, `exterior` ou `prefiro não informar`.
- O consolidado não contém registros individuais, horários, identificadores nem respostas textuais.
- Só publicar uma célula regional ou de familiaridade com pelo menos cinco participantes; células menores entram apenas em `suppressedCount`, sem rótulo.
- Não publicar cruzamento região × familiaridade.
- Depois de conferir o consolidado, apagar os JSONs individuais usados na agregação.

## Métricas e limiares

- Reconhecimento por pessoa e cenário: respostas corretas / respostas válidas.
- Nome civil, nome público ou sobrenome inequívoco contam como correto.
- `Não sei` conta como não reconhecido; uma pessoa diferente conta como erro.
- Cada uma das oito pessoas precisa atingir pelo menos 70% em **cada** cenário, não apenas no total combinado.
- Neutralidade: registrar percentuais `favorece`, `neutra` e `prejudica` por imagem.
- Revisão obrigatória se mais de 20% perceber favorecimento ou mais de 20% perceber prejuízo em qualquer imagem.
- Comparar também o saldo `favorece - prejudica`; discrepância superior a 20 pontos percentuais entre imagens impede a escala.
- Diferença de reconhecimento superior a 15 pontos percentuais entre os dois cenários exige revisão de recorte, mesmo quando ambos superem 70%.

## Revisões humanas e decisão

O consolidado deve obedecer a `card-art-pilot-results.schema.json` e conter, para cada código:

- revisão de identidade com `status`, `reviewedBy`, `reviewedAt` e `notes`;
- revisão de dignidade com os mesmos campos;
- contagens brutas e taxas de reconhecimento e neutralidade.

A decisão do lote exige `seguir`, `iterar` ou `abandonar`, acompanhada por `decidedBy`, `decidedAt` e justificativa. O agente que preparou o piloto não pode preencher a amostra, assinar as revisões humanas nem decidir o próprio gate.

Além dos limiares, `seguir` continua bloqueado enquanto qualquer referência tiver `licenseStatus: license-pending`. Isso hoje vale para cinco arquivos editados recebidos do usuário; o registro de uma fonte editorial anterior não substitui a licença da fotografia efetivamente usada.

## Registro esperado

Os resultados devem ser anexados à issue #176 e copiados para `stages/12_quality_gate_main/output/card-art-pilot-results.json`, validados contra o schema. O arquivo consolidado não existe enquanto o teste humano estiver pendente; não se cria resultado vazio ou hipotético.

O formulário offline está em `references/card-art-pilot-176.html`. As oito imagens e o manifesto ficam em `evidence/card-art-pilot-176/`, fora de `app/public` e fora do build Vite.
