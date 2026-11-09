# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Pesquisa de viabilidade e desenvolvimento de produto em produção — para um "Portal de Streamings" no Vega OS (Amazon Fire TV). Cada afirmação aqui foi **medida contra um Fire TV Stick físico**; o repositório é o registro dessas medições.

```
research/     os achados, em prosa — leia antes de mexer em qualquer coisa
tests/unit/   invariantes do catálogo, rodam sem aparelho
tests/device/ premissas do aparelho, só leitura
tests/probe-app/  o app-sonda: React Native for Vega que prova os portões G1–G6
```

Aparelho de referência: Fire TV Stick HD, Vega OS 2.0, armv7, `192.168.1.2:5555`. O IP vem de DHCP e muda.

## Git

Repositório iniciado em 2026-11-04, branch padrão `main`, com remoto **público** em https://github.com/Amarildo-correa/teste-app. O que veio antes dessa data não tem histórico. `tests/probe-app/src/config/tmdbKey.ts` guarda a chave do TMDB e é ignorado pelo `.gitignore`; só o `tmdbKey.example.ts` é versionado.

Por ser público, o serial do aparelho não entra no repositório: nos documentos e fixtures ele aparece como `<serial-omitido>`.

## Comandos

```bash
node --test tests/unit/*.test.mjs                        # 26 testes, instantâneo
node --test --test-name-pattern "storeId" tests/unit/*.test.mjs   # um teste só
tests/device/probe-catalog.sh [IP:PORTA]                 # ~40 s, não toca na tela
```

### Build, instalação e execução — rodam no container, não no WSL

`tests/probe-app/` **não tem `node_modules` nem `tsconfig.json`**. É a fonte da verdade do código; o projeto que compila vive em `/root/work` dentro do container Docker `vega-sdk-dl`. O ciclo:

```bash
cd tests/probe-app
docker cp src/. vega-sdk-dl:/root/work/src/
docker cp manifest.toml vega-sdk-dl:/root/work/manifest.toml
docker cp assets/. vega-sdk-dl:/root/work/assets/   # ícone e fontes

docker exec vega-sdk-dl bash -lc 'export PATH=/root/vega/bin:/root/vega/node22/bin:$PATH
  cd /root/work
  node node_modules/typescript/bin/tsc --noEmit
  node node_modules/.bin/eslint src --ext .ts,.tsx
  node node_modules/.bin/react-native build-vega --build-type Release
  vega device install-app -p build/armv7-release/portalprobe_armv7.vpkg
  vega device launch-app --appName com.portalprobe.app.main'
```

Armadilhas do container, todas já pagas uma vez:

- O Node fica em `/root/vega/node22/bin` e **não está no PATH**. Sem isso, `npx` e `react-native` respondem *command not found* e o `.bin/tsc` falha com `/usr/bin/env: 'node': No such file or directory`.
- `vega device launch-app` quer `--appName <componente>`, com o `.main`.
- `eslint` emite ~7 *warnings* conhecidos (biblioteca SDL, props de
  acessibilidade depreciadas). O que importa é **0 errors**.
- O ícone do `manifest.toml` (`assets/image/app_icon.png`, exatamente 512×512) também é o tile do app sideloaded em "Seus aplicativos e canais", onde aparece cortado em faixa horizontal: só o miolo vertical do quadrado fica visível (medido em 2026-11-04). O conteúdo precisa ficar centralizado.
- A imagem de capa do launcher (app em foco) não sai do pacote: é asset da ficha na Appstore. Sideloaded mostra fundo preto. Ver
  `research/03-capa-launcher.md`.

### Ver a interface sem o aparelho

O Vega Virtual Device roda em outro container, `vega-vvd-gpu`, com janela no Windows, e usa o `.vpkg` `x86_64` que o mesmo build gera. Serve para ver a interface; as medições continuam no Fire Stick. O screenshot abaixo gera PNG de 0 byte no VVD; lá ele sai pelo console do emulador. Receita em `research/05-vega-virtual-device-wsl.md`.

**Iterar no VVD, Fire Stick só na reta final.** Layout, foco e erros de JS se conferem no VVD: screenshot pelo console do emulador, teclas por `inputd-cli` e logs por `loggingctl log -f` (`journalctl` é recusado e o histórico do `loggingctl` guarda poucas linhas; capture ao vivo). O Fire Stick fica para o que o VVD não reproduz: `canOpenURL` dos provedores, abrir outros apps, loja, desempenho armv7 e a conferência final na TV.

### Ver a tela e apertar botões

```bash
# screenshot: tira no aparelho, puxa para o container, copia para o WSL
vega exec vda shell "gwsi-tool-screenshooter /tmp/s.png"
vega exec vda pull /tmp/s.png /root/s.png

vega exec vda shell "inputd-cli button_press KEY_ENTER"   # OK do controle
vega exec vda shell "vlcm list"                           # o que está rodando
vega exec vda shell "vlcm crash-history"                  # vazio = sem crash
vega exec vda shell "vlcm launch-app <uri>"               # aceita URI arbitrária
```

- **`KEY_ENTER` é o OK.** `KEY_SELECT` é aceito sem erro e **não dispara
  nada** — custou um ciclo de teste descobrir.
- Pipes e aspas **não sobrevivem** ao `vda shell`. Para qualquer coisa
  composta, mande um script como arquivo — é o que `probe-catalog.sh` faz com
  a função `on_device`.
- A TV entra em protetor de tela sozinha. Um screenshot de golfinhos
  significa que a medição não aconteceu; acorde com `KEY_DOWN` e repita.
- Páginas da loja rendem PNG de 0,9–2 MB; a tela de erro dá ~30 KB e o
  spinner ~10 KB. Dá para triar pelo tamanho, **mas o tamanho não separa
  página certa de página errada** — para isso só olhando.

## A ideia central, que não está em nenhum arquivo isolado

**Não existe API para enumerar apps instalados** por um app de terceiro (exige assinatura de plataforma). Todo o portal se apoia num efeito colateral:

1. Cada provedor é declarado em `[[wants.module]]` no `manifest.toml`.
2. `Linking.canOpenURL('pkg://<componente>')` responde se dá para falar com aquele app — o que, para os provedores declarados, equivale a "instalado".
3. `Linking.openURL(...)` traz o app para a frente.

Três consequências que mandam no código:

- **`canOpenURL` lança exceção em vez de devolver `false`.** Sem `try/catch` tratando a exceção como "ausente", a primeira ausência derruba a renderização da lista inteira.
- **Esquecer um `[[wants.module]]` faz o provedor ser tratado como ausente para todos os usuários**, inclusive quem tem o app: o botão vai para a loja em vez de abrir o título — e só se corrige republicando, não pelo backend. `tests/unit/catalog.test.mjs` existe por causa disso.
- **A interface do produto não diz se o app está instalado.** O botão tem rótulo fixo e a detecção só decide o destino: título com o app, loja sem ele. O selo só existe na tela de diagnóstico, atrás do Menu.
- Só `pkg://` abre app. `https://` vai para o navegador padrão e esquemas do Fire OS (`netflix://`) não resolvem. Os dois estão travados em teste de regressão; se um deles passar a funcionar, a arquitetura mudou.

### O caminho da loja (provedor ausente)

`amzn://apps/android?p=<storeId>` abre a página do app na Appstore, do próprio app, sem privilégio extra. O `storeId` **é o mesmo package id do Vega** — `uri` é sempre `pkg://<storeId>.main`, e quando os dois discordam um deles foi chutado (foi assim que dois ids errados do catálogo apareceram).

Nenhum dos modos de falha rejeita a promise, então **a guarda tem de estar no catálogo, antes do `openURL`**:

| Entrada | O que acontece |
|---|---|
| package inexistente | loja pinta "Erro / Go Back" em cima do app |
| package de outra plataforma (`com.netflix.ninja`) | página certa, botão "Indisponível" — parece sucesso |
| busca (`?s=<termo>`) | spinner que não termina |

Critério de aceitação de um `storeId` novo: abrir a página num aparelho e **ler o botão** — "Abrir" (instalado), "Baixar"/"Comprar" (ausente),
"Indisponível" (errado), tela de Erro (não existe).

## Os três arquivos que precisam andar juntos

Mudar um provedor significa mudar os três; o teste de unidade é a trava:

| Arquivo | Papel |
|---|---|
| `tests/probe-app/src/data/providers.ts` | catálogo que o app desenha (`uri`, `storeId`, `expectAvailable`, `idVerified`) |
| `tests/probe-app/manifest.toml` | os `[[wants.module]]`, um por provedor |
| `tests/device/expected-catalog.json` | fixture lida do aparelho; é o que os testes conferem |

## Disciplina do projeto

Isto é o que distingue este repositório de um protótipo, e o que mais importa
preservar:

- **Simples primeiro.** Proponha antes a solução mais simples que resolve o pedido, em resposta curta. Pacote novo, troca de arquitetura e bateria de testes só se o simples falhar. O que é visual, peça para uma pessoa conferir na TV.
- **Não escreva na mão o que já existe pronto.** Use componentes prontos e bibliotecas em vez de implementação própria.
- **Teste que não morde não vale.** Ao acrescentar invariante, verifique por mutação: quebre o dado de propósito, confirme que o teste falha, restaure.
- **Os documentos preservam o histórico.** A tabela de portões diz "6/6" no G3 e "8/8" no G5 porque o catálogo cresceu entre as duas medições. Não reescreva números antigos para ficarem bonitos; acrescente a medição nova.
- **Caso negativo vale tanto quanto o positivo.** Todo portão fechado aqui tem um controle que deveria falhar — e falhou.

## Navegação

`@amazon-devices/react-navigation__native-stack` (rotas em `tests/probe-app/src/navigation/routes.ts`). O catálogo fica montado por baixo do título, então trilho, poster e rolagem voltam como estavam sem nenhum código de restauração. O Back é do navegador: **não registre `BackHandler` em tela**. Medido em Release armv7 em 2026-11-04, ver `research/04-navegacao-nativa.md`.

Os trilhos paginam sob demanda (`tests/probe-app/src/data/railPager.js`, em JS com tipos em `.d.ts` porque o Node do WSL não carrega `.ts`). Página nova entra por `notifyDataChange`, nunca por prop: o Carousel de fora não redesenha item montado.

A troca de tela usa o `Animated` do React Native em `TitleScreen.tsx`: escala com opacidade, 200 ms, `useNativeDriver`. A opção `animation` da pilha fica em `none`: ela não tem escala, e `fade` e `default` foram rejeitados na TV (no `default`, só a coluna de dados piscava). O fundo da navegação usa `C.bg` no tema e no `contentStyle`; sem isso, a transição pisca em branco.

No container, `npm install` exige `--legacy-peer-deps`: o conflito de `@typescript-eslint` já existia e não tem relação com os pacotes do app.

## Estado conhecido

G1–G6 fechados (detalhe em `research/01-resultado-app-sonda.md`). 
Em aberto:
`componentId` e `module` dos três provedores ausentes (só saem de um aparelho que tenha o app) e R4 (política da Appstore sobre lançar concorrentes — consulta, não teste).

R3 (ids de módulo não são API pública) é risco aceito: se um id mudar, o Portal manda para a página do app na loja e o usuário aperta o botão de lá, perdendo só o atalho até o título.

`tests/README.md` está desatualizado: fala em 12 testes de unidade e 5 portões, números anteriores ao caminho da loja.
