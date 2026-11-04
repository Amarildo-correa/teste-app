# Migrar a navegação do portal para React Navigation nativo

Migre a navegação do portal (`tests/probe-app`) para uma pilha nativa, de modo que o catálogo preserve estado e foco sem restauração manual. Depois, faça as melhorias que essa migração destrava.

Este projeto deve evoluir para um produto robusto e escalável, de nível big tech. Hoje o `CLAUDE.md` o define como pesquisa de viabilidade, "não um produto": atualize essa definição como parte do trabalho, sem apagar o histórico.

Antes de tudo, leia o `CLAUDE.md` e todo o `research/`. Use a skill `amazon-devices-vega-navigation`. Consulte a documentação da Amazon pelo MCP `amazon-devices-buildertools-mcp` (chame `set_project_context` primeiro).

## Estado atual

- **Navegação:** `src/App.tsx` troca de tela com um `useState` (`catalog | title | probe`). Abrir um título desmonta o `CatalogScreen`.
- **Restauração manual, a ser eliminada se a migração passar:**
  - `App.tsx` guarda `restore` (trilho + índice) e `cachedRails`;
  - `CatalogScreen` recebe essas props e calcula o `stackOffset` inicial;
  - `PosterRail` usa `preferredIndex`, `initialStartIndex` e `RailPosition`.
- **Funciona hoje, medido no aparelho:** a volta do título restaura o foco no mesmo trilho e poster, inclusive no último poster de um trilho e em trilho já rolado. Isso é a régua: a migração não pode piorar.
- **Stack:** RN 0.83, `@amazon-devices/react-native-kepler ~4.0.0`, `@amazon-devices/vega-carousel ~1.0.1`. Nenhum pacote de navegação instalado.
- **Git:** repositório iniciado em 2026-11-04, branch `main`. O commit inicial registra o estado daquela data, então as mudanças recentes da tela do título e da restauração de foco não têm histórico próprio.

## O que a pesquisa encontrou (confirme, não confie)

- **Pacotes:** `vega-api/2.0/react-navigation-8-0-0` lista `@amazon-devices/react-navigation__native` e `__native-stack` (`~8.0.0`), e `@amazon-devices/react-native-screens` `~3.0.0` para RN 0.83. Confirme as versões para 0.83 e se o `-8-0-0` é a página certa.
- **Risco de crash no Release:** https://community.amazondeveloper.com/t/release-build-crashes-with-unknown-module-error-when-using-createnativestacknavigator-from-amazon-devices-react-native-screens/25224
- **Foco perdido na volta:** https://community.amazondeveloper.com/t/focus-not-persisted-on-back-navigation-with-nested-stack-navigators/24739. O relato é que `hasTVPreferredFocus` na tela de origem rouba o foco na volta, e o portal usa essa prop no primeiro poster.
- **Tela viva ao voltar:** https://community.amazondeveloper.com/t/how-to-return-focus-to-a-card-when-navigating-back-from-pages/27553 sugere native stack e, se as telas estiverem sendo desmontadas, desativar `detachInactiveScreens`.
- **Ponto em aberto:** o `import` correto (`react-navigation__native-stack` ou `react-native-screens/native-stack`) precisa sair da medição.

## Fase 0: linha de base

1. O `git init` e o commit do estado atual na `main` já foram feitos. Confira se o `.gitignore` cobre `src/config/tmdbKey.ts` e segredos, e trabalhe em uma branch. Não faça push.
2. Anote a régua: tempo de abertura, tempo de volta e memória do app com o catálogo carregado, usando a ferramenta que a documentação do Vega indicar. Registre comando e valores.

## Fase 1: prova de viabilidade (pode reprovar)

Instale os pacotes e faça a migração mínima, das três telas, em **build Release armv7 no Fire TV físico**. Debug não conta. Ainda não remova a restauração manual dos commits anteriores; desligue-a para medir.

O teste passa só se **todos** os casos abaixo passarem **sem nenhum código de restauração manual**:

| # | Caso | Esperado |
|---|---|---|
| 1 | Abrir o app | sem crash; `vlcm crash-history` sem nova entrada do portal; foco no 1º poster |
| 2 | 3º poster de "em alta" → Back | foco no mesmo poster |
| 3 | 2º poster de "séries" → Back | mesmo poster, pilha rolada, sem animação de subida |
| 4 | Último poster de um trilho → Back | mesmo poster |
| 5 | Depois de voltar, direcional | navega normalmente |
| 6 | Depois de voltar, sem rede | catálogo continua de pé, sem nova busca |
| 7 | Menu → Diagnóstico → Back | volta ao catálogo; defina e registre a posição correta |
| 8 | Back na raiz | sai do app, uma única vez |
| 9 | Título → OK → Netflix → voltar ao portal | foco no título; **uma pessoa precisa olhar a TV** |
| 10 | Foco na tela do título | direcional não alcança nada da tela escondida por baixo |
| 11 | Abrir e voltar 30 vezes | memória estabiliza; sem crash |

Compare a memória com a régua: manter o catálogo vivo significa manter dezenas de posters carregados no armv7. Se piorar muito, pare e me mostre os números.

**Se reprovar:** não force. Registre o que falhou, restaure a solução atual e me traga as opções. Manter a restauração manual é um resultado válido. Só use `FocusManager`/`useFocusEffect` para remendar se eu aprovar, porque isso é restauração manual de novo.

## Fase 2: migração completa (só se a Fase 1 passar)

- Remova `restore`, `cachedRails`, `RailPosition`, `preferredIndex` e o `stackOffset` inicial que só existia para a volta.
- Tipifique as rotas; `title` recebe parâmetros por rota.
- Tire `BackHandler` das telas se o navegador já cuidar disso. O Back não pode disparar duas vezes.
- Mantenha o `useProviderProbe` acima das telas e o botão Menu do controle (`useTVEventHandler`) funcionando.
- Mantenha intacta a lógica do botão: instalado abre o título, ausente abre a loja.
- Revise comentários que mencionam "sem biblioteca de navegação" e o custo do `stackKey`, que remonta a pilha.
- Atualize `package.json` e `manifest.toml`, e confira se o `tests/probe-app/README.md` e o `CLAUDE.md` continuam corretos.

## Fase 3: melhorias destravadas pela migração

Faça estas:
1. Tirar a busca do TMDB de dentro da tela, em uma camada de dados com estado de carregamento/erro definido, testável com `node --test`.
2. Parametrizar o provedor na tela do título. Hoje "Netflix" está fixo no texto, no deep link e no storeId. Não adicione provedores novos.
3. Carregar sob demanda as telas secundárias.
4. Usar FlashList na pilha vertical de trilhos. A biblioteca é o padrão: meça antes e depois, e **só mantenha a pilha atual se a medição mostrar piora**; nesse caso, registre os números e me mostre. A skill `amazon-devices-vega-app-performance` ajuda.
5. Trocar componentes próprios por componentes prontos onde houver equivalente: `Button.tsx` e `PosterCard.tsx` são os candidatos. `Rail.tsx` e `PosterRail` já usam o `Carousel` nativo e ficam fora. Pode executar sem minha aprovação, com um commit por componente.

Não execute o resto. Entregue uma lista priorizada, com custo e risco, para eu aprovar: CI, build reproduzível, telemetria de crash, testes de componentes, Diagnóstico fora de produção, renomear o pacote `com.portalprobe.app`.

## Não resolva sozinho: leve para mim

Para ser um produto, estes itens bloqueiam antes do código:

- **Ids de módulo (R3):** não são API pública.
- **Deep link da Netflix:** não é contrato público (`research/02`).
- **Provedores ausentes:** faltam `componentId` e `module` de três deles.

Liste-os com o que cada um exige e quem decide.

## Armadilhas já pagas

- O ciclo de build está no `CLAUDE.md`. `tests/probe-app` não tem `node_modules`; o projeto compila em `/root/work` no container `vega-sdk-dl`. Instale pacotes lá e **reflita no `package.json` da fonte**.
- Pacote nativo que declara módulo no próprio `kepler-system-conf.toml` não é propagado pelo `build-vega`: o app compila, instala e crasha ao abrir. Confira `vlcm crash-history` e declare à mão no manifesto. Este é um suspeito forte para o crash do item acima.
- O Carousel não move o foco real para o `Pressable` do cartão: use `onSelectionChanged`. Com `hasPreferredFocus` em todo trilho, nenhum cartão recebe foco.
- **Teste contaminado:** instalar ou encerrar o portal pode trazer o Netflix para a frente, e as teclas vão para ele. Antes de medir, rode `vlcm terminate-app --pkg-id com.netflix.kepler --force` e confira em `vlcm list` que o portal está `VISIBLE`.
- `gwsi-tool-screenshooter` grava 0 bytes ou um quadro de transição quando há vídeo protegido na tela. Para o Netflix, peça para uma pessoa olhar a TV.
- `KEY_ENTER` é o OK; `KEY_SELECT` não faz nada. O protetor de tela invalida a medição; acorde com `KEY_DOWN`.
- `vlcm crash-history` já tem crashes antigos do Netflix e do portal. Compare o `timestamp` antes de atribuir um crash ao seu build.

## Disciplina

- Tudo medido no aparelho, com controle negativo. Para cada caso da Fase 1, prove que o teste detecta falha, por exemplo com um build sem a pilha.
- Não escreva na mão o que já existe pronto: use componentes prontos e bibliotecas em vez de implementação própria.
- Teste que não morde não vale: verifique por mutação.
- Documentos preservam o histórico: acrescente medição nova, não reescreva a antiga.
- Comente o porquê das decisões, com a data da medição.
- Não misture refatoração sem relação. Um commit por passo. Sem push nem publicação sem eu pedir.

## O que entregar

1. Veredito da Fase 1: tabela com os 11 casos e, para cada um, evidência e resultado.
2. Comparativo com a régua: antes e depois em abertura, volta e memória.
3. `research/04-navegacao-nativa.md`, na mesma estrutura do `research/02`: veredito, medições, controles negativos, o que não funcionou, o que ficou em aberto.
4. `CLAUDE.md` atualizado.
5. A lista priorizada da Fase 3 e os bloqueios de produto.
