# PoliMatch — espaços de retrato

## Objetivo

Permitir que uma fotografia seja substituída sem editar o componente da carta ou o catálogo de pessoas.

## Regra única

Cada pessoa usa o `personId` do catálogo como nome de arquivo, sempre com três dígitos:

- pessoa 1: `app/public/portraits/001.jpg`
- pessoa 55: `app/public/portraits/055.jpg`
- pessoa 125: `app/public/portraits/125.jpg`

Ao receber uma foto nova, substitua somente o JPG daquele espaço e faça uma nova build. A build cria uma versão nova do endereço da imagem para impedir que Safari, CDN ou navegador mantenham a fotografia anterior em cache.

## Padrão de entrega

- JPG em sRGB;
- 1200 × 1500 px;
- proporção 4:5;
- qualidade entre 88 e 94;
- rosto identificável;
- enquadramento de busto;
- margem acima da cabeça;
- sem texto, logo, moldura ou efeito de Chroma incorporado;
- fundo e recorte podem ser tratados, mas a carta básica aplica sua própria malaquita, estrutura e verniz.

Se o arquivo ainda não existir ou falhar ao carregar, o app preserva o espaço da carta e mostra as iniciais da pessoa.

## Conferência

`npm run portraits:check --prefix app` informa quantos espaços já possuem arquivo. Use `npm run portraits:check --prefix app -- --strict` somente quando as 125 fotos forem obrigatórias.

Substituir uma foto significa que a curadoria autorizou sua identidade, qualidade e direito de uso. O validador estrutural não concede essa aprovação editorial.
