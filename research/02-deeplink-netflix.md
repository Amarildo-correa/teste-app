# Netflix: dá para abrir direto na tela do conteúdo? — medição de 2026-11-03

Pergunta: com o app Netflix já instalado, existe caminho para o portal abrir
**o título** (como em `page-midia.png`), e não só a home do app?

Aparelho: Fire TV Stick HD (`192.168.1.2:5555`, Vega OS 2.0). A tela foi lida
**por uma pessoa na frente da TV** em todos os casos em que o screenshot não
servia — ver §5.

## Resposta curta

**Sim, por `kcp-launch`.** A URI é

```
pkg://com.netflix.kepler.main?kcp-launch=<comando Matter Content Launcher em JSON>
```

Ela foi **capturada do card da busca do Fire TV** e depois **reenviada por
`vmsgr send`, fora da Alexa, abrindo o mesmo título**. É `pkg://` comum — o
transporte que o portal já usa.

| Forma | Entregue ao app? | Onde caiu |
|---|---|---|
| **`pkg://com.netflix.kepler.main?kcp-launch={…}`** | sim | **o título** (Narcos, tocou) |
| `pkg://com.netflix.kepler.main/title/80057281` | sim (`/title/80057281`) | home |
| `pkg://com.netflix.kepler.main?v=80057281` | sim (`?v=80057281`) | home |
| `amzns://apps/android?asin=…#Intent;S.intentToFwd=…` | ASIN sim, **fragmento descartado** | home |
| DIAL `POST /apps/Netflix` payload `v=80057281` | sim (`?v=…&DIAL_ADDITIONAL_DATA_URL=…`) | não lido |
| `netflix://`, `nflx://` | não resolve | — |

## 1. O que o card da busca realmente manda

Capturado com `vlcm list` logo após clicar no card ("narcos na netflix"),
na coluna de URI de lançamento:

```
pkg://com.netflix.kepler.main?kcp-launch={"revision":1,"action":8,
  "transaction_id":13617,"fabric_index":1,"source_node":1,
  "destination":{"Node":1},"suppress_response":false,"timed_request":false,
  "invoke_requests":[{"command_path":{"cluster_path":{
     "target":{"Endpoint":{"node":1,"endpoint_id":15}},
     "cluster":1290},"command":0},
   "command_fields":{ … }}]}
```

- `cluster 1290` = **0x050A, Content Launcher do Matter**; `command 0` =
  `LaunchContent`. `endpoint_id 15` = o Content App do Netflix.
- Os campos vão como arrays de bytes ASCII. Decodificados:

| Campo | Valor |
|---|---|
| `ENTITY_ID` | `amzn1.p11cat.merged-video.9516b1e0-5532-58a0-a4b3-7b18963 82add` |
| `netflix_global` | `80025172` ← **o id de `netflix.com/title/<id>`** |
| `amzn_id` | `80025313` |
| busca (tipo 16) | `narcos na netflix` |

O `netflix_global` é o id público da URL do Netflix — mas **ele não é o que
resolve o título**: o §6 mostra, por experimento 2×2, que quem manda é o
texto da busca.

## 2. Reprodução fora da Alexa — o teste que decide

A mesma URI, byte a byte, mandada por `vmsgr send` a partir do shell:

```
$ sh /tmp/kcp.sh
--- enviando
Sending: pkg://com.netflix.kepler.main?kcp-launch={…}
exit=0
```

Resultado lido na TV: **abriu o Narcos**. Não é privilégio da Alexa nem da
superfície de busca — é uma URI que qualquer remetente autorizado pode mandar.

### O que falta para o portal (não é permissão)

`vmsgr check-access --package=com.helloworldtv.app` na mesma URI:

```
Canonical Uri: pkg://com.netflix.kepler.main
Required Module: /com.netflix.kepler.module@IMod1   [FAIL]
Required Sender Privilege(s): *
```

O `[FAIL]` é o de sempre — a cobaia não declara o módulo. **O portal já
declara `/com.netflix.kepler.module@IMod1` no `manifest.toml`**, e o
privilégio de remetente é `*`. Pela camada de mensagens, passa. Falta provar
de dentro do app, com `Linking.openURL`.

## 3. Por que as outras formas falham

O registro do sistema explica: Prime Video publica
`/com.amazon.frenchpress.main@IDeeplinks`, Amazon Music idem — **o Netflix
publica só `/com.netflix.kepler.module@IMod1`**. Não há contrato de deep link
por path/query. O `kcp-launch` não é deep link de URL: é **RPC do Matter
serializado na query string**, e o Netflix o trata porque implementa o cluster
Content Launcher (o serviço `com.netflix.kepler.interface.provider`, que o
pacote oferece).

`amzns://…#Intent;S.intentToFwd=…` (Featured Content) é outro mecanismo e não
serve: nesse, o ASIN é o **do próprio app** — serve para a Amazon mandar o
usuário para dentro do *seu* app. O fragmento foi descartado no caminho e o
Netflix recebeu só `/android?asin=B0DJQ2BS37`. (O ASIN saiu do
`installer metadata` do pacote, com `vpm info --package`.)

## 4. DIAL: portão aberto, efeito não lido

O Netflix declara `dial_origins = "https://*.netflix.com,package:*"` e o
`dial-service` escuta em `0.0.0.0:8009`. Medido com controle negativo:

| Requisição | Resposta |
|---|---|
| `GET /apps/Netflix` + `Origin: package:com.portalprobe.app` | 200, origem ecoada |
| `GET /apps/Netflix` + `Origin: https://evil.example.com` | **403** |
| `OPTIONS` + origem `package:` + `Request-Method: POST` | 204, `Allow-Methods: GET, POST, OPTIONS` |
| `POST /apps/Netflix` corpo `v=80025172` | 201 Created, `state` vira `running` |

A tela desse lançamento **não foi lida**. Com o `kcp-launch` resolvido, o DIAL
deixa de ser necessário — fica registrado como caminho alternativo, não como
pendência.

## 5. Armadilhas de método, todas pagas uma vez

- **Screenshot não serve para ler o Netflix.** `gwsi-tool-screenshooter` falha
  com `drm: atomic commit failed` e grava **0 bytes** sempre que há vídeo
  protegido na tela — e a **home** do Netflix toca preview. Bloqueio de DRM
  não distingue home, detalhe e reprodução: **não é evidência de nada.** Eu
  tratei o bloqueio como sinal de sucesso e errei; quem leu a tela corrigiu.
- **Relançar com o app aberto não reprocessa a URI** — volta na tela anterior.
  Todo teste de URI exige `vlcm terminate-app --pkg-id … --force` antes.
- **Matar o Netflix traz o app anterior para o primeiro plano** e o novo
  lançamento vai para background: use
  `vlcm trigger-app foreground --inst <inst>`.
- O seletor de perfil fica na frente de qualquer deep link.
- `#` e `;` não sobrevivem ao `vda shell`: mandar como arquivo de script.
- **`vlcm list` é o instrumento central**: a última coluna mostra a URI de
  lançamento que o app recebeu. Foi assim que o `kcp-launch` apareceu.

## 6. Qual campo resolve o título — experimento 2×2

Quatro envios, variando só duas coisas, com `vlcm terminate-app --force`
entre cada um. As telas foram comparadas por `md5sum` dos screenshots:

| `amzn_id` | texto da busca (campo tipo 16) | Tela | md5 |
|---|---|---|---|
| `80025313` (Narcos) | `narcos na netflix` | Narcos | `0ed01928…` |
| `80057281` (Stranger Things) | `narcos na netflix` | **Narcos** | `0ed01928…` |
| `80057281` | `stranger things` | Stranger Things | `0365d688…` |
| `80025313` | `stranger things` | **Stranger Things** | `0365d688…` |

**O valor do id é ignorado; quem resolve o título é o texto.** Os pares batem
byte a byte: trocar o id não muda nada, trocar o texto muda tudo.

Mas a **presença** do par `amzn_id` importa. Sem ele — só `netflix_global` e o
texto (`tests` kcp3) — o Netflix para na **lista de resultados de busca** por
"stranger things", com o título certo em foco. Com o par `amzn_id` presente,
com qualquer valor, ele **abre a tela do título**.

Receita mínima que funciona, então:

```
parâmetro tipo 13: { Value: "<nome do título>", ExternalIDList: [{ amzn_id, <qualquer> }] }
parâmetro tipo 16: { Value: "<nome do título>" }
```

### O resultado é REPRODUÇÃO, não a tela de detalhe

> **Correção de 2026-11-04.** Este documento afirmou o contrário por algumas
> horas: que o payload entregava a tela de detalhe. A evidência eram dois
> screenshots — "NARCOS · 2017 · Drama · 3 temporadas · HD · A16" e
> "STRANGER THINGS · 2025 · Ficção científica · 5 temporadas · HD · AD · CC ·
> 16". Aquilo **não é a página do título**: é o cartão de pré-rolagem que o
> Netflix mostra enquanto o vídeo carrega. O screenshot só funcionou porque
> naquele instante o plano protegido ainda não estava composto — a mesma
> armadilha de DRM do §9, por outro ângulo.
>
> O sinal que eu tinha e não puxei: o payload capturado da Alexa já trazia
> `AutoPlay = false`, e pela Alexa o título **tocava**.

Medido com controle, no mesmo título (Narcos), lido na TV por uma pessoa:

| `AutoPlay` (campo `1`, TLV `0x10`) | Tela |
|---|---|
| `false` | **tocando o episódio** |
| `true` | **tocando o episódio** — idêntico |

Screenshot bloqueado por DRM em t+4 s, t+13 s e t+29 s nos dois casos.

**O Netflix ignora o `AutoPlay` do Matter: o `LaunchContent` dele sempre
reproduz.** Não há, portanto, caminho conhecido para a tela de detalhe:
`kcp-launch` toca, `pkg://` simples cai na home.

Consequência de produto: o botão "Abrir app e assistir" está correto no que
promete — ele assiste mesmo. Mas a tela de conteúdo que o `page-midia.png`
desenha (sinopse + "Abrir app e assistir" levando à página do título) não é
alcançável; o que o portal entrega é ir direto para o play.

## 7. Fechado: o envio a partir do app (2026-11-04)

O `kcp-launch` foi disparado **de dentro do portal**, com `Linking.openURL`,
num app de terceiro assinado por nós, sem Alexa e sem privilégio de
plataforma. O Netflix abriu **a tela do título** ("Colisão Implacável", lida
na TV). O que o app declara para isso é uma linha que já existia:

```toml
[[wants.module]]
id = "/com.netflix.kepler.module@IMod1"
```

Com isso o caminho está completo: catálogo (TMDB) → tela do título → Netflix
no título certo. O código vive em
`tests/probe-app/src/deeplink/netflixTitle.ts`.

### Duas armadilhas do aparelho, medidas no mesmo dia

- **Imagem remota que nunca termina.** O primeiro `<Image>` de um trilho
  ficava preto para sempre. Não é o arquivo (o mesmo JPEG abre fora) e não é
  falha: **`onError` nunca dispara** — o pedido fica pendurado. O RN não tem
  timeout para imagem, então o timeout é nosso: sem `onLoad` em 2,5 s,
  remonta o `<Image>` trocando a key. Três tentativas e depois cai para o
  nome do título.
- **Foco morre quando o esqueleto vira conteúdo.** Ao chegarem os dados, o
  esqueleto focável é desmontado e o sistema entrega o foco ao próximo
  focável — o trilho de baixo — e a tela rolava sozinha.
  `hasTVPreferredFocus` não resolve, porque só vale na montagem e até lá o
  foco já mudou de dono. A pilha inteira remonta com uma key nova numa única
  transição `loading -> ready`.

## 8. O que ainda não foi medido

1. **Risco de ambiguidade.** Como a resolução é por texto, um nome genérico
   pode cair no título errado — e nada rejeita a promise.

   > **Correção de 2026-11-04.** Este item dizia que cada título do catálogo
   > precisava de um `titleVerified` lido num aparelho, "igual ao
   > `storePageVerified`". Está errado e seria inviável: `storePageVerified`
   > cobre **oito provedores**; título são milhares por streaming. A regra
   > "nada entra sem ser medido" vale para o nível do **provedor** — package,
   > componente, módulo, forma do payload. No nível do **título** o que se
   > mede é o **padrão**, com uma amostra de 5 a 8 casos escolhidos para
   > quebrá-lo (nome curto e ambíguo, acento e pontuação, série contra
   > filme, título ausente do serviço). A partir daí a URI é gerada por
   > código, com teste de unidade comparando a saída do gerador com as
   > amostras que funcionaram no aparelho.

   O que falta de verdade aqui: a amostra ainda não foi feita para a
   Netflix, e **não se sabe qual é a taxa de erro** da resolução por texto
   em nomes curtos. É isso que decide se o portal precisa de uma estratégia
   de desambiguação ou não.
2. ~~Qual campo liga/desliga o autoplay~~ — **fechado**: nenhum. O `AutoPlay`
   do Matter é ignorado e o Netflix sempre reproduz (§6).
3. Prime Video: publica `@IDeeplinks` e o launcher declara querer
   `com.amazon.frenchpress.interface.provider`. Provável que aceite
   `kcp-launch` também.
