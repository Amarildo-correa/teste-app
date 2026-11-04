# App Portal de Streamings no Vega OS — viabilidade de descobrir e abrir apps

Pesquisa feita em 2026-11-03 contra o aparelho físico.

> **Escopo (ajustado durante a pesquisa).** O portal precisa só de duas coisas
> por provedor: **mostrar se o app está instalado** (selo INSTALADO) e **abrir
> o app** (Abrir no app). Não precisa cair direto no título. Isso tira do
> caminho o único ponto que exigiria acordo comercial — ver §4.2 — e deixa o
> projeto apoiado inteiramente nos riscos R1 e R2, que o app-sonda fecha.

> **Atualização de 2026-11-04.** O escopo acima descreve a decisão de 2026-11-03 e mudou: a interface do produto não diz mais se o app está instalado. O botão tem rótulo fixo ("Abrir app Netflix e assistir"), e a detecção continua rodando sem aparecer: com o app, abre o título; sem o app, abre a página na loja. O selo só existe na tela de diagnóstico, e o destino só é dito no `accessibilityHint` do botão. Abrir o título também saiu do "fora do escopo" da §4.2, com o `kcp-launch` da Netflix (`research/02-deeplink-netflix.md`).

| | |
|---|---|
| Aparelho | Fire TV Stick HD, Vega OS 2.0, armv7 |
| Serial / IP | `<serial-omitido>` / `192.168.1.2:5555` |
| Via | container `vega-sdk-dl`, `vega exec vda` |
| App de terceiros usado como cobaia | `com.helloworldtv.app` (distributor: **Third Party**) |

A cobaia importa: ela tem exatamente o mesmo nível de privilégio que o
app-portal terá. Os apps do sistema são assinados por
`CN=Platform Distributor CA, OU=Orpheus, O=Amazon Inc` — nós não somos.

---

## Resposta curta

| Pergunta | Resposta |
|---|---|
| O portal consegue **descobrir** os apps instalados? | **Não.** Não há API de enumeração para apps de terceiros. |
| O portal consegue **abrir** outro app? | **Sim**, via `pkg://<component-id>` + `[[wants.module]]` no manifesto. |
| Dá para saber se um app específico está instalado? | **Sim, indiretamente** — é o efeito colateral do `[[wants.module]]`. |
| Dá para abrir direto num **filme** dentro do app? | Só com contrato por parceiro — **fora do escopo atual.** |
| Links `https://` abrem o app (Netflix, Prime)? | **Não.** Vão para o navegador padrão. |

Ou seja: o layout da imagem de referência é viável, **com uma mudança de
arquitetura** — o catálogo "Assistir agora nos apps" não pode ser
descoberto, tem que ser curado e embarcado no app.

---

## 1. Descoberta: por que não dá

A única API de enumeração é o package manager. A documentação do
`security-manager-lib` é explícita:

> This method requires the **`com.amazon.privilege.package.query`** run-time
> privilege due to the fact that it allows the caller to determine what apps
> a user has installed, which is a privacy concern. **This privilege requires
> the calling app to have a platform signature.**

Reforços encontrados:

- `@amazon-devices/package-manager-lib` **não existe no npm público** — a
  própria Amazon confirmou isso num tópico da comunidade, respondendo que a
  documentação está errada ao mandar instalá-lo.
- No aparelho, quem enumera é o binário de sistema `vpm` (`vpm list apps`),
  rodando fora do sandbox do app. Dentro do sandbox do app o shell nem
  enxerga `/var/lib/appfwkcfgsvc/`.

**Consequência de projeto:** o portal embarca um catálogo estático de
provedores (id, nome, logo, módulo) e atualiza esse catálogo pelo backend,
não pelo aparelho.

## 2. Abertura: por que dá

`vmsgr check-access` mostra, para cada URI, o que o OS exige de quem envia.
Rodado a partir de `com.helloworldtv.app`:

```
--- pkg://com.netflix.kepler.main
    Required Module: /com.netflix.kepler.module@IMod1   [FAIL]
    Required Sender Privilege(s): *
    Sender Privilege Check:                             [FAIL]
```

Os dois pontos que importam:

1. **`Required Sender Privilege(s): *`** — o app-alvo aceita mensagem de
   qualquer remetente. Netflix, Apple TV, Pluto, YouTube, Prime Video e
   Amazon Music, todos com `*`. Não há lista branca de parceiros.
2. O `[FAIL]` é só porque o manifesto da cobaia **não declara dependência do
   módulo**. Isso é uma linha no nosso `manifest.toml`, não uma permissão da
   Amazon.

E os módulos existem no registro do sistema (`vpm list modules`, 380
módulos), então são declaráveis.

### `[[wants.module]]` é a peça central

A documentação do manifesto define `[wants]` como dependências **opcionais**:

> Application packages are expected to continue to function if the wanted
> module is not available on a Vega system. Developers may use this
> capability to light up optional features when it is available.

Isso resolve dois problemas de uma vez: autoriza o envio quando o app está
instalado, e não quebra o portal quando não está. **É a nossa descoberta
indireta**, provedor a provedor, a partir do catálogo curado.

## 3. Catálogo real do aparelho

Ids coletados do próprio Fire Stick (`vpm list apps --category=com.amazon.category.main`
e `vpm info <pkg> --package`). Note que **nenhum deles é adivinhável** —
"Prime Video" é `com.amazon.frenchpress`.

| App | Package | Componente | Módulo a declarar |
|---|---|---|---|
| Prime Video | `com.amazon.frenchpress` | `com.amazon.frenchpress.main` | `/com.amazon.frenchpress.main@IDeeplinks` |
| Netflix | `com.netflix.kepler` | `com.netflix.kepler.main` | `/com.netflix.kepler.module@IMod1` |
| Apple TV | `com.apple.atve.amazon.appletv` | `com.apple.atve.amazon.appletv.main` | `/com.apple.atve.amazon.appletv@IMod1` |
| Pluto TV | `tv.pluto.android` | `tv.pluto.android.main` | `/tv.pluto.android.module@ISomeUri1` |
| YouTube | `com.amazon.firetv.youtube` | `com.amazon.firetv.youtube.main` | `/com.amazon.firetv.youtube.module@IMod1` |
| Amazon Music | `com.amazon.music.kepler` | `com.amazon.music.kepler.main` | `/com.amazon.music.kepler.module@IAmazonMusicModule1` |
| Appstore (página do app) | `com.amazon.appstorevegatv` | `com.amazon.appstorevegatv.details` | `/com.amazon.appstorevegatv@IDeepLinkAccessModule` |
| Appstore (home) | `com.amazon.appstorevegatv` | `com.amazon.appstorevegatv.main` | — (já passa sem módulo) |

Lista completa dos 57 componentes lançáveis em
[`tests/device/expected-catalog.json`](../tests/device/expected-catalog.json).

## 4. Dois enganos que custariam retrabalho

### 4.1 `https://` não abre o app

Qualquer URI `https://` é canonizada para `https://` e cai no navegador:

```
--- https://www.netflix.com/title/81234567
    Canonical Uri: https://
    Required Module: /com.amazon.kepler.os_messages@IOsMessageModule  [PASS]
    Required Receiver Privilege(s): com.amazon.messaging.privilege.assume-default-browser-role
```

O mesmo vale para `app.primevideo.com`, `tv.apple.com`, `pluto.tv`,
`youtube.com`. E o esquema `netflix://` do Fire OS retorna
`No module found` — não está registrado no Vega.

Então **todo deep link copiado de um app Android TV / Fire OS não funciona
aqui.** Tem que ser `pkg://`.

### 4.2 Abrir o app ≠ abrir o filme

`pkg://<pkg>.main` abre o app na home dele. Para cair direto no Oppenheimer
é preciso a URI de conteúdo de cada parceiro, que é contrato privado — os
nomes dos módulos já entregam isso (`@IDeeplinks` no Prime Video e no
Amazon Music, `@IPlutoDefault` no Pluto).

O caminho oficial da Amazon para "abrir conteúdo X no app Y" é o
**Content Launcher**, mas ele é documentado só pelo **lado provedor**: o app
de streaming se registra como provider para que a Alexa e a busca da Fire TV
o invoquem. O lado cliente (`/com.amazon.kepler.media.content_launcher@IClient1`)
é das superfícies da própria Amazon.

**Implicação para o produto — já resolvida.** Sem acordo com os parceiros, a
linha "ASSISTIR AGORA NOS APPS" entrega *abrir o app*, não *abrir o título*.
O escopo foi ajustado exatamente para isso: selo INSTALADO + "Abrir no app".
Fica registrado aqui como o custo de uma evolução futura, não como pendência.

## 5. Riscos em aberto (o que os testes vão fechar)

| # | Risco | Como fecha |
|---|---|---|
| R1 | O build do Vega pode recusar um manifesto de terceiros que declare o módulo de outro fornecedor. **É o risco que mata o projeto.** | `tests/probe-app` |
| R2 | Não se sabe se `Linking.canOpenURL()` reflete a ausência do módulo (nossa detecção de "instalado"). | `tests/probe-app` |
| R3 | Ids de módulo não são API pública (`ISomeUri1` tem cara de interno) e podem mudar numa atualização do app. | catálogo remoto + fallback |
| R4 | Política da Appstore sobre um app que lança concorrentes. | consulta à Amazon |

**R1 e R2 só fecham construindo o app-sonda.** Toda a análise acima está
confirmada no aparelho; essas duas ficam como hipótese bem fundamentada até lá.

## 6. Arquitetura recomendada

```
catálogo curado (backend)
   └─> lista de provedores: { nome, logo, pkg, componente, módulo }
         └─> manifest.toml: um [[wants.module]] por provedor
               └─> runtime: Linking.canOpenURL('pkg://<componente>')
                     ├─ true  -> "[OK] Abrir"  -> Linking.openURL(...)
                     └─ false -> "Instalar"    -> pkg://com.amazon.appstorevegatv.details
```

O manifesto é estático: adicionar um provedor novo exige **republicar o
app**, não dá para fazer só pelo backend. Então a lista de `[[wants.module]]`
deve ser generosa desde a primeira versão — declarar módulos de apps que o
usuário não tem é inofensivo, é esse o contrato do `wants`.
