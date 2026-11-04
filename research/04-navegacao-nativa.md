# Navegação nativa: a pilha substitui a restauração manual? — medição de 2026-11-04

Aparelho: Fire TV Stick HD, Vega OS 2.0, build Release armv7. Escopo reduzido a pedido do responsável pelo projeto: migração com um teste rápido no aparelho, sem a bateria completa de 11 casos nem a comparação de tempos e memória.

## Veredito

**Sim, nos casos medidos.** O catálogo mantém foco, rolagem e dados na volta sem código de restauração. `restore`, `cachedRails`, `RailPosition`, `preferredIndex` e os `BackHandler` das telas saíram.

| Caso | Resultado | Evidência |
|---|---|---|
| Abrir no Release | sem crash | `vlcm crash-history` sem entrada nova, portal `VISIBLE` |
| 3º poster de "em alta" → Back | mesmo poster | screenshot antes e depois |
| 2º poster de "séries" → Back | mesmo poster, pilha rolada | screenshot depois |
| Último poster de "séries" → Back | mesmo poster | screenshot antes e depois |
| Direcional depois de voltar | navega | RIGHT andou até o fim do trilho |
| Menu → Diagnóstico → Back | volta ao catálogo na mesma posição | screenshot depois |
| Back na raiz | sai para o launcher com um Back | `vlcm list` |

Os PNGs de antes e depois têm md5 diferente mesmo com a tela igual à vista: a comparação foi feita olhando, não por pixel.

## Pacotes

Versões da Package Version Matrix para RN 0.83: `react-navigation__native` e `__native-stack` `~8.0.9000000001`, `react-native-screens` `~3.0.9000000001`, `react-native-safe-area-context` `~8.0.9000000001`.

O import é `@amazon-devices/react-navigation__native-stack`. Com ele o Release abriu sem declarar módulo novo no `manifest.toml`, ao contrário do relato de crash na comunidade, que usava `react-native-screens/native-stack` no SDK 0.21.

## O que não funcionou

As ferramentas de medida da documentação não rodam neste ambiente:

| Ferramenta | Resultado |
|---|---|
| `vega exec perf`, SDK 2.0.13986 | não inicia: `TypeError: readonly attribute` |
| `perf` do SDK 0.24.12112 + bibliotecas instaladas no container | `doctor` funciona; `kpi-visualizer` conclui 0 iterações |
| `memory-monitor` e `activity-monitor` do mesmo SDK | `list index out of range` |
| `/proc/<pid>` no shell do aparelho | invisível: não há memória por processo |
| `/proc/meminfo`, app fechado menos app carregado | -28 MB numa leitura: o ruído do sistema é maior que o app |

## Catálogo reciclado: milhares de cards

A pilha de navegação não resolve escala: ela mantém o catálogo vivo, e todos os trilhos montavam juntos. A pilha vertical animada à mão virou um `Carousel` vertical com os trilhos dentro, o padrão aninhado do `vega-carousel` (`uniqueId`). Só 4 trilhos ficam na árvore. O prompt indicava FlashList; o Carousel foi escolhido por já cuidar do D-pad, e a FlashList não foi testada.

Três defeitos apareceram na troca, todos medidos no aparelho e corrigidos:

| Defeito | Causa | Correção |
|---|---|---|
| Cabeçalho do trilho focado apagado | o Carousel não redesenha item montado quando o `renderItem` muda | `RailFocusContext` |
| Trilho reciclado voltava ao 1º poster | a posição morre com a reciclagem | `selectedIndexes` + `initialStartIndex` |
| Subir pulava para "em alta" | o 1º trilho remontava com `hasTVPreferredFocus` | só a primeira montagem pede foco |

`selectedIndexes` é uma memória de posição escrita à mão, a única que restou: cobre a reciclagem, não a navegação.

Teste de carga, em build só de teste: 2000 títulos sintéticos em cada um dos 6 trilhos da Netflix. 100 RIGHT, abrir e voltar, 13 DOWN e 13 UP: sem crash, portal `VISIBLE`, posição preservada.

**O que esse teste não prova:** os títulos repetem os mesmos 12 posters, então não mede memória com milhares de imagens diferentes; as teclas iam a cerca de uma por segundo, então não mede repetição rápida; e não houve medida de latência. O app real continua limitado a 12 títulos por trilho, porque a busca no TMDB não pagina.

## Em aberto

- **Memória e tempos antes e depois:** não comparados. Antes da migração, com marcas no log: abrir título 74 ms e voltar 433 ms (mediana, n=10). Não há o número equivalente depois.
- **Catálogo vivo em uso longo:** 30 ciclos de abrir e voltar não foram rodados.
- **Título → Netflix → voltar ao portal:** precisa de uma pessoa olhando a TV, por causa do DRM.
- **Foco sem rede depois de voltar:** não testado.

## Paginação dos trilhos — 2026-11-04

Para o catálogo crescer até milhares de cards sem carregar tudo: cada trilho tem um paginador (`src/data/railPager.js`) que pede a próxima página do TMDB quando faltam 8 cartões para o fim do que já chegou. A página nova entra por `notifyDataChange`, não por prop, porque o Carousel de fora não redesenha um item montado. O teto de 12 títulos por trilho saiu. O pôster do trilho passou de `w500` para `w342`.

| Caso, Release armv7 | Resultado | Evidência |
|---|---|---|
| 130 cartões para a direita e 130 de volta, por script | sem crash, portal `VISIBLE` | `vlcm list`, `vlcm crash-history` |
| Passar do 20º pôster, abrir título e voltar, trocar de trilho e voltar, ir ao início | ok | lido na TV, no controle, pelo responsável pelo projeto |
| Paginador: em voo, repetidos, última página, erro, página vazia | 8 testes, 6 mutações detectadas | `tests/unit/railPager.test.mjs` |

Controle negativo no aparelho: nenhum. O caso de erro de rede foi coberto só por teste de unidade.

Em aberto: o TMDB entrega no máximo 500 páginas por consulta, e os títulos já carregados ficam em memória enquanto o catálogo estiver aberto. O consumo real de memória não foi medido, pelos motivos da tabela de ferramentas acima.

## Animação ao abrir e voltar — 2026-11-04

Com o Carousel vertical, o OK encolhia o trilho inteiro: para o Carousel de fora, o item pressionado é o trilho, e `pressedItemScaleFactor` vale 0,8 por padrão. Agora ele é 1 nesse Carousel, e só o de dentro anima.

Lido na TV pelo responsável pelo projeto: ao apertar OK, o card encolhe; ao voltar, o mesmo card cresce. **Isso é desejado, não efeito colateral:** mostra ao usuário de qual card veio a página. Mudar o `pressedItemScaleFactor` do Carousel de dentro remove esse sinal.

A tela do título agora abre 200 ms depois do OK (150 ms do encolher do card mais uma folga), para a animação aparecer inteira. Aprovado na TV pelo responsável pelo projeto.

Não testado: as guardas de segundo OK e de Menu durante a espera. Cada tecla por `inputd-cli` leva cerca de 390 ms, mais que a janela, então nenhuma delas disparou. Fora da janela, o segundo OK aciona o botão da tela do título e abre o Netflix (medido); isso já valia antes da espera.

## Transição entre telas — 2026-11-04

| Tentativa | Resultado na TV |
|---|---|
| `animation: 'fade'` na pilha | rejeitada: feia |
| `animation: 'default'` na pilha | rejeitada: só a coluna de dados do título piscava |
| `Animated` do React Native na tela do título: escala de 90% a 100% com opacidade, 200 ms, nos dois sentidos | aprovada |

Com a animação, o fundo branco do tema padrão do navegador aparecia como um flash. O tema e o `contentStyle` agora usam `C.bg`, e o flash sumiu, conferido na TV.

O Back espera a saída por `beforeRemove`. O segundo Back durante os 200 ms não foi testado: cada tecla por script leva cerca de 390 ms. O custo da animação no armv7 não foi medido.

A espera entre o OK e a abertura do título passou de 200 ms para 150 ms, a pedido do responsável pelo projeto, sem novo teste.
