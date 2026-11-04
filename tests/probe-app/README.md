# App-sonda — o teste decisivo

`tests/device/probe-catalog.sh` provou que os apps de streaming **aceitam**
ser abertos por qualquer remetente. O que ele **não** prova é que o *nosso*
app consegue declarar o módulo e enviar a mensagem. Esses são os riscos R1 e
R2 do relatório, e são os dois únicos que ainda podem matar o projeto.

O app-sonda não é o portal. É um app descartável cuja única tela mostra uma
tabela:

```
Prime Video    pkg://com.amazon.frenchpress.main          canOpenURL: true    [Abrir]
Netflix        pkg://com.netflix.kepler.main              canOpenURL: true    [Abrir]
Apple TV       pkg://com.apple.atve.amazon.appletv.main   canOpenURL: true    [Abrir]
Pluto TV       pkg://tv.pluto.android.main                canOpenURL: true    [Abrir]
App inexistente pkg://com.exemplo.naoexiste.main          canOpenURL: false   —
```

Isso é um para um com a tela da imagem de referência: a coluna `canOpenURL`
é o selo **INSTALADO**, e o botão é o **Abrir no app**.

## Resultado (executado em 2026-11-03)

| Portão | Resultado |
|---|---|
| **G1.** `vega build` aceita `[[wants.module]]` de terceiros | ✅ `manifest.toml is valid`, 0 erros; os 8 módulos sobrevivem no `.vpkg` |
| **G2.** instala e roda sem negativa de privilégio | ✅ |
| **G3.** `canOpenURL` distingue disponível de ausente | ✅ 6/6 — **lançando exceção**, não devolvendo `false` |
| **G4.** `openURL` traz o app para a frente | ✅ Prime Video e Netflix; caso negativo rejeita sem crash |
| **G5.** build aceita módulo **inexistente** no sistema | ✅ 8/8 — é o que permite pré-declarar provedores |
| **G6.** manda para a página do app na Appstore | ✅ do próprio app, sem privilégio extra; BACK volta sem crash |

Análise completa em [`research/01-resultado-app-sonda.md`](../../research/01-resultado-app-sonda.md).

### O detalhe que muda o código do portal

`Linking.canOpenURL()` **lança** para URI que não pode abrir, em vez de
devolver `false`. Sem `try/catch` o portal quebra na primeira ausência:

```ts
try {
  available = await Linking.canOpenURL(uri);
} catch {
  available = false;
}
```

E o segundo controle negativo mostrou que `canOpenURL` responde *"consigo
falar com este app?"*, não *"este app existe?"*: `com.amazon.tigris.main`
está instalado e ainda assim lançou, porque o módulo dele não está no nosso
manifesto. Ou seja — **esquecer um `[[wants.module]]` esconde o provedor de
todo mundo**, e só se corrige republicando o app. É o que
`tests/unit/catalog.test.mjs` trava.

### O detalhe que muda o catálogo

Quando o app não está instalado, o cartão manda para a loja com
`amzn://apps/android?p=<storeId>`. O `storeId` é o mesmo package id do Vega
(`uri` é sempre `pkg://<storeId>.main`), e **tem de estar confirmado**: um
package errado não rejeita a promise, a loja só pinta uma tela de Erro por
cima do portal. Pior ainda, um package de outra plataforma
(`com.netflix.ninja`) abre a página certa com o botão "Indisponível" — parece
sucesso. Por isso o critério é abrir a página num aparelho e **ler o botão**,
e por isso `storeId: null` faz o cartão dizer "Sem link na loja" em vez de
chamar a loja.

## Estrutura

```
manifest.toml                      declara os [[wants.module]] — o teste G1/G5
package.json                       alinhado por `vega project install --fix`
src/
  theme.ts                         escala, cores, piso de 32px, MAIN_X
  App.tsx                          composicao da tela
  layout/Main.tsx                  a coluna de conteudo
  components/
    Rail.tsx                       faixa de cartoes — fica FORA da Main
    ProviderCard.tsx               selo + acao
    SectionHeader.tsx              titulo + contador de posicao
    Diagnostics.tsx                a saida do teste, desenhada na tela
    RefreshButton.tsx              "Reler agora" — reexecuta o G3 na sessao
  data/providers.ts                catalogo: id, modulo, storeId, expectativa
  probe/useProviderProbe.ts        G3, G4 e G6, sem nenhuma UI dentro
```

A separação que importa: **`Main` define a coluna de conteúdo e o `Rail` fica
fora dela.** É isso que deixa os peeks correrem até as bordas da tela
enquanto o cartão em foco permanece alinhado com o logo, o título e o painel
— o rail se realinha sozinho usando o mesmo `MAIN_X` do tema.

### A largura do cartão não foi escolhida, foi deduzida

Duas regras de layout, em `theme.ts`:

1. A `Main` tem a largura de exatamente **3 cartões + 2 vãos**, e é centrada.
   Assim o painel de diagnóstico termina no mesmo x que o terceiro cartão.
2. O peek visível, nas duas pontas, é **metade de um cartão**.

As duas juntas fixam a largura do cartão; não sobra escolha. Com vão `G`,
cartão `W` e tela `S`:

```
MAIN_W  = 3W + 2G
goteira = (S − MAIN_W) / 2
peek    = goteira − G

peek = W/2   ⟹   (S − 3W − 2G)/2 − G = W/2   ⟹   W = S/4 − G
```

Com `S = 1920` e `G = 24`: **W = 456**, `MAIN_W = 1416`, goteira `252`,
peek `228` — que é exatamente `W/2`. Medido na tela: confere.

Mexer só em `BASE_GAP` reajusta o resto sozinho. Nenhum número mágico.

`useProviderProbe` não conhece a interface, e os componentes não sabem medir
nada. Dá para trocar a tela inteira sem tocar no teste, e vice-versa.

## A tela

Só componentes do React Native for Vega (`View`, `Text`, `Pressable`,
`Animated`, `Linking`, `Dimensions` e `TVFocusGuideView` do kepler).

- **Piso de 32px em todo texto.** Foi isso que ditou a largura do cartão:
  com 380px o selo "NAO INSTALADO" truncava. Cabem 3 inteiros, não mais.
- **Rail de borda a borda, com foco fixo.** O cartão em foco não se mexe; a
  trilha desliza por baixo (`Animated.timing`, 220 ms, driver nativo). A
  viewport do rail tem a largura inteira da tela, então os peeks são
  cortados pela borda do painel e não pela margem do conteúdo. No índice 0 a
  goteira da esquerda fica vazia — é o preço de manter o foco sempre no
  mesmo lugar.
- **Foco com quatro sinais redundantes**, nunca só cor: borda de 6px,
  superfície mais clara, ação em destaque e selo invertido.
- Área segura de 5% para overscan; contraste mínimo de 7:1 em todo texto;
  `accessibilityRole`/`accessibilityLabel` com nome, estado e ação.

## Como rodar

```bash
# 1. gerar o esqueleto a partir do template oficial, dentro do container
docker exec -it vega-sdk-dl bash -lc \
  'cd /root && vega create app --template helloWorld portal-probe'

# 2. aplicar os arquivos daqui
#    manifest.toml  -> substitui o do template
#    src/           -> substitui o src/ do template (apagar os exemplos)

# 3. build armv7 (Fire TV Stick) — ver skill vega-os-windows, assets/vega-build.yml
# 4. instalar e abrir
tests/device/run-probe.sh 192.168.1.2:5555 <caminho>/portal-probe_armv7.vpkg

# 5. ler o resultado na TV e no log
docker exec vega-sdk-dl bash -c 'export PATH=/root/vega/bin:$PATH
  vega exec vda shell loggingctl log --vpkg com.portalprobe.app' | grep PROBE
```

O `README` da skill `vega-os-windows` tem o passo a passo de build e de
screenshot (`scripts/vega-tv.sh shot`).

## Cuidados

- O app-sonda **abre apps de verdade na TV do usuário**. Avise antes.
  Depois de um `openURL`, o controle sai do app-sonda — é preciso reabri-lo
  (`vlcm launch-app orpheus://com.portalprobe.app.main`) antes de mandar
  mais teclas.
- Se a tela sair preta no screenshot, provavelmente é a Netflix na frente
  com DRM. Confira com `vlcm list` qual app está `VISIBLE`.
- Desinstale a sonda ao terminar: `vega device uninstall-app --appName com.portalprobe.app`.
