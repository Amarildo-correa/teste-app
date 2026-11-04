# Resultado do app-sonda — R1, R2 e o caminho da loja fechados

Executado em 2026-11-03 no Fire TV Stick HD (Vega OS 2.0, `<serial-omitido>`,
`192.168.1.2:5555`). Build no container `vega-sdk-dl` com SDK 2.0.13986,
RN 0.83, Node 22. Pacote `armv7`, Release.

**Os dois riscos que podiam matar o projeto estão fechados. O portal é viável,
e o caminho "não tenho o app → instalar" também foi medido.**

| Portão | Pergunta | Resultado |
|---|---|---|
| G1 | O build aceita `[[wants.module]]` de outro fornecedor? | **Sim** — `manifest.toml is valid`, 0 erros |
| G2 | Instala e roda sem erro de privilégio? | **Sim** |
| G3 | `canOpenURL` distingue disponível de ausente? | **Sim** — 6/6, com uma ressalva importante |
| G4 | `openURL` traz o app de streaming para a frente? | **Sim** — Prime Video e Netflix |
| G5 | O build aceita `[[wants.module]]` de módulo **inexistente** no sistema? | **Sim** — e é o que permite pré-declarar provedores |
| G6 | Dá para mandar o usuário para a página do app na Appstore? | **Sim** — do próprio app, sem privilégio extra |

## G1 — o build aceita módulos de terceiros

Declarei no `manifest.toml` do app-sonda sete módulos que pertencem a outros
fornecedores (Prime Video, Netflix, Apple TV, Pluto TV, YouTube, Amazon Music
e a Appstore). Nem o `vega project doctor` nem o `vpt validate` reclamaram:

```
✅ OS versions valid: min=2.0, target=2.0
✅ Deprecated APIs: None
manifest.toml is valid
manifest validation found 0 errors
```

Os oito `[[wants.module]]` sobreviveram no manifesto gerado dentro do
`.vpkg` — não são removidos pelo remapeador do build.

## G2 — instala e roda

`vega device install-app` → `success`. O app sobe, desenha e fica `VISIBLE`
no `vlcm list`. Nenhuma negativa de privilégio no log.

## G3 — o selo INSTALADO funciona, mas por exceção

Este é o achado que muda o código do portal.

```
Prime Video: true      Netflix: true      Apple TV: true     Pluto TV: true
Pacote inexistente: excecao               Modulo nao declarado: excecao
```

`Linking.canOpenURL()` **não devolve `false`** para o que não pode abrir —
ele **lança**. Discrimina do mesmo jeito, mas só se o chamador usar
`try/catch` e tratar a exceção como "não disponível":

```ts
let available: boolean;
try {
  available = await Linking.canOpenURL(uri);
} catch {
  available = false;   // <- sem isto o portal quebra na primeira ausência
}
```

Um `canOpenURL` solto, sem `catch`, derruba a renderização da lista inteira.

### O segundo controle negativo e o que ele revela

`Modulo nao declarado` aponta para `pkg://com.amazon.tigris.main` — um app
que **está instalado** no aparelho, mas cujo módulo **não** foi declarado no
nosso manifesto. Ele também deu exceção.

Então `canOpenURL` responde "eu consigo falar com este app?", não "este app
existe?". As duas coisas coincidem quando declaramos todos os provedores do
catálogo — que é o desenho proposto. Mas a consequência operacional é dura:

> **Esquecer um `[[wants.module]]` faz o provedor aparecer como NÃO
> INSTALADO para todos os usuários, mesmo quem tem o app.** E só dá para
> corrigir republicando o app, não pelo backend.

Por isso o teste `tests/unit/catalog.test.mjs` cruza o catálogo com o
manifesto: é a trava contra esse erro.

## G4 — abrir funciona

| Ação | `vlcm list` logo depois |
|---|---|
| OK em Prime Video | `com.amazon.frenchpress.main` **VISIBLE** |
| OK em Netflix | `com.netflix.kepler.main` **VISIBLE** |
| OK em `Modulo nao declarado` | app-sonda continua **VISIBLE**, sem crash |

O caso negativo é tão importante quanto os positivos: `openURL` rejeita a
promise, o app trata e segue vivo (`vlcm crash-history` sem entrada para
`com.portalprobe.app`). Dá para transformar essa rejeição num "Instalar na
loja" sem risco de derrubar a tela.

## G5 — streamings que o usuário não tem

O controle inicial era um pacote falso. Trocado por streamings reais
confirmados ausentes deste aparelho (`vpm list packages`): **Disney+, Max e
Globoplay**. Com eles o teste virou o caso de produção, não um artifício.

Resultado com oito cartões: **8/8 como esperado, discrimina SIM.**

```
Prime Video: true   Netflix: true   Apple TV: true   Pluto TV: true
Disney+: excecao    Max: excecao    Globoplay: excecao
Modulo nao declarado: excecao
```

OK no cartão do Disney+: `openURL rejeitou Disney+ (sem crash)`, o app-sonda
seguiu `VISIBLE`, sem entrada em `vlcm crash-history`.

E o ponto que o G5 fecha: os três foram declarados em `[[wants.module]]`
mesmo **não existindo** no sistema, e o build passou sem erro. Sem isso o
portal só poderia listar o que o usuário já tem — nada de "Instalar na loja".

## G6 — o caminho da loja

Segunda rodada, mesmo dia. A pergunta: quando o usuário **não** tem o app, dá
para levá-lo à tela onde existe o botão de instalar?

**Dá.** O alvo é um componente próprio da Appstore, `com.amazon.appstorevegatv.details`.
O `vpm info` dele declara os URIs que aceita:

```
message targets:
  uris:  amzn://apps, amzns://apps,
         http://www.amazon.com/gp/mas/dl/android,
         https://www.amazon.com/gp/mas/dl/android
```

A chamada que abre a página de um app:

```
amzn://apps/android?p=<packageId>
```

Medido **de dentro do app-sonda**, com `Linking.openURL`, sem privilégio novo
— o `/com.amazon.appstorevegatv@IDeepLinkAccessModule` que já estava no
manifesto como "fallback" era o que faltava usar. OK no cartão do Disney+:

| Verificação | Resultado |
|---|---|
| Página abre | **Sim** — "Disney+", Disney Electronic Content, botão **Baixar** |
| Portal sai da frente | `com.portalprobe.app.main` → `NOT_VISIBLE` |
| BACK volta ao portal | **Sim** — `VISIBLE` de novo |
| Crash | nenhum (`vlcm crash-history` vazio) |

Para o cartão sem `storeId`, o OK não chama a loja e o painel reporta
`sem storeId, loja nao chamada` — o portal nem pisca.

### Os três modos de falha, e por que a guarda tem de ser no catálogo

Nenhum dos três rejeita a promise. O código **não consegue** detectá-los
depois do `openURL`; por isso o `storeId` tem de estar certo antes.

| Entrada | O que acontece |
|---|---|
| Package inexistente (`com.wbd.stream`) | A loja abre e pinta **"Erro / Ocorreu um erro. Tente novamente / Go Back"** em tela cheia, por cima do portal |
| Package de **outra plataforma** (`com.netflix.ninja`, entrada Android TV) | Abre a página certa do Netflix com o botão **"Indisponível"**. Parece sucesso e não é — o pior dos três |
| Busca (`amzn://apps/android?s=<termo>`) | Entra na loja e fica num **spinner que não termina** (esperei 14 s). Não serve de plano B |

Por isso `storeId: null` existe no catálogo: sem id confirmado, o cartão diz
"Sem link na loja" e o portal não chama a loja. Prometer "Instalar na loja" e
entregar tela de erro é pior do que não oferecer o caminho.

### O critério de aceitação é o botão

Abrir a página não basta — `com.netflix.ninja` abre. O que separa acerto de
erro é **ler o botão**:

- **"Abrir"** → é o app certo e está instalado
- **"Baixar" / "Comprar"** → é o app certo e não está instalado
- **"Indisponível"** → package de outra plataforma, não serve
- tela de Erro → package não existe

### storeId **é** o packageId — e foi isso que achou dois ids errados

Nos oito provedores medidos, a Appstore usa o mesmo package id do Vega:
`uri` é sempre `pkg://<storeId>.main`. Isso não é uma simetria bonita, é um
detector: quando os dois discordam, um deles foi chutado.

Foi o que aconteceu. Os ids hipotéticos de Max e Globoplay **estavam errados**:

| Provedor | Era (palpite) | É (confirmado na loja) |
|---|---|---|
| Max | `com.wbd.stream` — tela de Erro | **`com.hbo.hbonow`** — "HBO Max", WarnerMedia |
| Globoplay | `com.globo.globoplay` | **`com.globo.globotv`** — "Globoplay", Globo |
| Disney+ | `com.disney.disneyplus` | `com.disney.disneyplus` — já estava certo |

Corrigidos em `providers.ts`, `manifest.toml` e `expected-catalog.json` —
`uri`, `storeId` e o nome do módulo. Os quatro instalados também tiveram a
página aberta e o botão lido: `com.amazon.frenchpress`, `com.netflix.kepler`,
`com.apple.atve.amazon.appletv`, `tv.pluto.android`.

> **O que continua hipótese.** `idVerified` segue `false` nos três ausentes.
> O `packageId` deixou de ser palpite — cada um foi aberto na loja —, mas o
> `componentId` e o `module` não foram lidos de um aparelho que tenha o app:
> são o packageId + `.main` e um `@IMod1` no padrão dos confirmados. Com o app
> ausente, id certo e id errado dão o mesmo `canOpenURL`; só a instalação
> distingue.

## Botão de reler

O app-sonda ganhou um botão **"Reler agora"** no painel, que reexecuta o G3
sem reinstalar nem reabrir. O painel mostra `leitura #N` — é a prova, no
screenshot, de que a releitura rodou.

Foi assim que o Disney+ sumindo do aparelho virou evidência em vez de ruído:
leitura com o app instalado deu `Disney+: true`, e depois da desinstalação
deu `excecao`, na mesma sessão.

Enquanto mede, o botão continua **focável** e só ignora o OK. Usar `disabled`
o tiraria da árvore de foco no meio da interação, e o foco cairia num vizinho
sozinho — pior que um OK sem efeito.

**Nota de ferramenta:** a tecla de OK do `inputd-cli` é `KEY_ENTER`.
`KEY_SELECT` é aceito sem erro e **não dispara nada** — custou um ciclo de
teste até perceber.

## O que ainda não foi testado

- ~~Um provedor com id confirmado e ausente.~~ **Fechado.** O Disney+ foi
  desinstalado do aparelho no meio da sessão: `packageId` confirmado (a página
  dele abre na loja) **e** ausente. Deu `excecao` no `canOpenURL` e mandou
  para a loja corretamente.
- **O componentId e o module dos três ausentes.** Só saem de um aparelho que
  tenha o app instalado — ver o box acima.
- **R3 — estabilidade dos ids de módulo.** `/tv.pluto.android.module@ISomeUri1`
  tem cara de interno. Só o tempo diz; mitigação é o catálogo vir do backend
  e o `[[wants.module]]` ser generoso desde a v1.
- **R4 — política da Appstore** sobre um app que lança concorrentes. É
  consulta à Amazon, não teste.
- **Estabilidade do deep link da loja.** `amzn://apps/android?p=` é o esquema
  clássico da Amazon e está declarado nos message targets do componente, mas
  não é contrato publicado para Vega. Mesma mitigação do R3.

## Reproduzir

```bash
tests/device/probe-catalog.sh          # premissas, sem build
node --test tests/unit/*.test.mjs      # invariantes do catálogo (18 testes)
# app-sonda: ver tests/probe-app/README.md
```

Verificar um `storeId` sem escrever código — abre a página e mostra o botão:

```bash
vega exec vda shell "vlcm launch-app amzn://apps/android?p=<packageId>"
vega exec vda shell "gwsi-tool-screenshooter /tmp/s.png"
```

O app-sonda continua instalado no aparelho como `com.portalprobe.app`.
Para remover: `vega device uninstall-app --appName com.portalprobe.app`.
