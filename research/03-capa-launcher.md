# Imagem de capa no launcher do Vega

Pergunta: como fazer o launcher mostrar uma imagem quando o tile do Portal
recebe foco em "Seus aplicativos e canais"?

Resposta curta: **não é pelo pacote**. A imagem é um asset da ficha do app na
Appstore (*Background Image*, em Fire TV assets). Enquanto o Portal for
sideloaded, o launcher mostra fundo preto.

## O que foi medido

Fire TV Stick HD, Vega OS 2.0, 2026-11-04, foco em cada tile por 5 s:

| App | Instalado por | `store id` | Imagem no foco | Título no launcher |
|---|---|---|---|---|
| YouTube | Appstore | `B07T771SPH` | sim | YouTube |
| Pluto TV | Appstore | `B00KDSGIPK` | sim | **Pluto TV – TV Ao vivo e Filmes** |
| Portal Probe | `vega device install-app` | vazio | **não** | Portal Probe |
| Hello World TV (controle) | `vega device install-app` | vazio | **não** | Hello World TV |

O título do Pluto é a evidência mais forte: o manifesto do pacote diz só
`Pluto TV`, conforme `vpm info`. O texto mais longo não está no pacote, então
vem do catálogo.

`vpm info --package` também não mostra campo de imagem nos apps da loja. Os
`extras` de YouTube e Netflix só trazem `dial_*`. Os arquivos dos pacotes não
são legíveis com o usuário do modo desenvolvedor, então isso não foi conferido
dentro dos pacotes.

## O que a documentação diz

- `[package]` só aceita `id`, `title` e `icon`. `icon` é 512×512 PNG.
  ([manifest-package](https://developer.amazon.com/docs/vega/latest/manifest-package.html))
- *Background Image*: 1920×1080, JPG ou PNG 24-bit sem transparência, aparece
  no canto superior direito da mini-página de detalhes. O assunto principal deve
  ficar na área segura de 1214×830.
  ([appstore-details](https://developer.amazon.com/docs/app-submission/appstore-details.html))
- A mesma página marca a imagem como obrigatória. Um artigo da comunidade a
  marca como opcional.
  ([comunidade](https://community.amazondeveloper.com/t/what-images-and-videos-are-needed-for-fire-tv-apps/3749))
- Live App Testing **não** oferece os Fire TV assets na submissão: só depois de
  promover o app.
  ([live-app-testing](https://developer.amazon.com/docs/vega/2.0/live-app-testing))

## Área visível (inferência, não medida com imagem própria)

Nas capturas, a arte ocupa de x≈960 a 1920 e de y=0 a ≈545, com degradê para
preto à esquerda e embaixo. São cerca de 960×540, ou seja 16:9, o que sugere a
imagem inteira reduzida à metade. Só uma submissão real confirma.

## Em aberto

- Não foi testado se um campo não documentado no manifesto teria efeito. Não há
  nome de campo para testar, e os apps da loja não mostram nenhum.
- Não foi medido quanto tempo a imagem leva para chegar ao aparelho depois de
  publicada.
