# Governança do portão editorial

Este documento é a regra normativa para publicar uma pessoa no PoliMatch. O catálogo, a presença de um arquivo no repositório e o nome histórico de uma pasta ou constante nunca constituem aprovação.

## Estados independentes

Cada pessoa possui três decisões separadas:

| Dimensão | Estados possíveis | Efeito público |
|---|---|---|
| conteúdo | `pending`, `approved`, `rejected` | precisa estar `approved` |
| arte da carta | `missing`, `approved`, `rejected` | precisa estar `approved` |
| foto documental | `missing`, `approved`, `rejected` | não bloqueia a publicação |

Uma pessoa só é elegível para API, duelo e ranking quando **conteúdo e arte da carta estão aprovados e ainda correspondem aos respectivos fingerprints**. A foto documental é opcional: sem uma foto aprovada, o perfil mostra o placeholder neutro `Foto documental ainda não disponível`.

## Quem decide

O responsável editorial final é Stefan Cabral (`stefancabral-oss`). Uma decisão também pode ser tomada por uma pessoa delegada, desde que ela seja identificada nominalmente na revisão da PR e seu login real seja gravado em `decidedBy`.

As responsabilidades não são intercambiáveis por inferência:

- conteúdo: o responsável editorial ou revisor factual delegado confere o texto e cada afirmação relevante;
- arte da carta: o responsável editorial ou diretor de arte delegado faz uma decisão humana depois do gate visual da #176;
- foto documental: o responsável editorial ou produtor de direitos delegado confirma identidade, fonte e licença.

Um teste, um script, o autor da implementação ou a mera existência de um asset não pode ser registrado como aprovador. A aprovação é sempre uma decisão humana individual por pessoa e por dimensão.

## Base de evidência obrigatória

Toda decisão em `shared/editorial-publication-ledger.json` exige uma lista `basis` com `label` e `reference` verificáveis.

### Conteúdo

- conferir nome, filiação, cargo, resumo, biografia, relevância, fatos, destaque e controvérsia;
- usar fontes primárias ou oficiais para registro/cargo e fontes jornalísticas identificáveis para alegações contextuais;
- abrir as referências no momento da revisão e registrar, em `basis`, a URL ou o documento exato usado;
- registrar rejeição quando houver erro conhecido; deixar `pending` quando a verificação ainda não ocorreu.

### Arte da carta

- revisar visualmente o arquivo final e a versão candidata;
- registrar como evidência a entrega/gate humano da #176 e o caminho/versionamento do arquivo conferido;
- a pasta `chromas/approved`, os assets atuais, `approved-chromas.js` e nomes contendo `approved` são inventário legado e **não** aprovam a dimensão;
- alterações de bytes exigem uma nova decisão humana, mesmo que o caminho permaneça igual.

### Foto documental

- conferir se a pessoa retratada corresponde ao perfil;
- registrar a origem rastreável e a licença ou autorização de uso;
- gravar `source` e `license` no asset registry e as respectivas referências em `basis`;
- se fonte ou licença não estiverem demonstradas, usar `missing` ou `rejected`; isso não impede a publicação quando as outras duas dimensões estão aprovadas.

## Alteração exata dos dados

Uma promoção editorial é feita somente em PR, por pessoa e sem aprovações em massa:

1. Calcular o fingerprint do conteúdo atual:

   ```powershell
   npm run editorial:fingerprint --prefix back -- content <candidate-id>
   ```

2. Para arte ou foto, colocar o arquivo final sob `app/public`, calcular o fingerprint dos bytes e incluir/atualizar um item em `shared/editorial-asset-registry.json`:

   ```powershell
   npm run editorial:fingerprint --prefix back -- asset app/public/<caminho-do-asset>
   ```

   - arte: `candidateId`, `kind: "cardArt"`, `path`, `fingerprint` e `version`;
   - foto: `candidateId`, `kind: "documentaryPhoto"`, `path`, `fingerprint`, `source` e `license`.

3. Incluir/atualizar a decisão da dimensão em `shared/editorial-publication-ledger.json`, com:

   - `status` permitido para a dimensão;
   - `fingerprint` do conteúdo ou do registro completo do asset conferido (`missing` de asset não leva fingerprint);
   - `decidedBy` com o login do aprovador humano;
   - `decidedAt` em `AAAA-MM-DD`;
   - `basis` com evidência específica.

   Depois de preencher o asset registry, calcular o fingerprint editorial que assina bytes, caminho e metadados:

   ```powershell
   npm run editorial:fingerprint --prefix back -- registered-asset <candidate-id> <cardArt|documentaryPhoto>
   ```

4. Rodar testes e build, solicitar a revisão humana correspondente e mesclar somente depois dessa revisão.

Não se altera `reviewStatus`, `reviewedAt`, `photoApproved`, `eligible`, `cardArt` ou `photo` no catálogo. Esses campos são projeções calculadas a partir do ledger e do asset registry. Flags ou exceções no código são proibidas.

## Invalidação e falha fechada

- qualquer mudança em um campo público do perfil muda o fingerprint do conteúdo e o devolve efetivamente a `pending`;
- qualquer mudança nos bytes, caminho, versão, fonte ou licença de uma arte/foto invalida a decisão e devolve efetivamente o asset a `missing`;
- candidato desconhecido, ID duplicado, ledger malformado, asset inseguro, evidência vazia ou fingerprint inválido impedem a inicialização/build;
- ausência de decisão significa `pending` para conteúdo e `missing` para assets;
- nenhuma decisão de foto torna conteúdo ou arte aprovados por consequência.
- consumidores públicos nunca devem serializar o candidato interno do registry; devem usar `candidatePublicPayload`, cuja base `candidatePublicContent` é também a fonte única do fingerprint de conteúdo.

## Estado inicial desta unidade

O ledger e o asset registry de produção começam vazios. Portanto, os 125 perfis reais ficam em `pending`/`missing` e nenhum é exposto pela API até decisões humanas individualizadas. As fixtures aprovadas existem apenas em testes e smokes; não são importadas pelo runtime de produção.

O bloqueio humano remanescente é intencional: revisar cada conteúdo, decidir cada arte produzida no fluxo da #176 e, quando houver foto documental, verificar sua proveniência e licença.
